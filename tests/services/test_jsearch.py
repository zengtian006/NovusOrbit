"""Tests for the JSearch client and how Job Suggestions uses it (no network)."""

import asyncio

import httpx
import pytest

from src.services.jobs import jsearch

SAMPLE = {
    "status": "OK",
    "data": [
        {
            "job_id": "abc123",
            "job_title": "Senior Data Engineer",
            "employer_name": "Acme Corp",
            "employer_logo": "https://logo.example/acme.png",
            "job_publisher": "LinkedIn",
            "job_employment_type": "FULLTIME",
            "job_apply_link": "https://www.linkedin.com/jobs/view/1",
            "job_apply_is_direct": False,
            "apply_options": [
                {"publisher": "LinkedIn", "apply_link": "https://www.linkedin.com/jobs/view/1"},
                {"publisher": "Acme Careers", "apply_link": "https://acme.example/jobs/1"},
            ],
            "job_description": "Build data pipelines with Python, Spark and Airflow on AWS.",
            "job_is_remote": True,
            "job_posted_at_datetime_utc": "2026-11-20T10:00:00.000Z",
            "job_city": "Austin",
            "job_state": "TX",
            "job_country": "US",
            "job_min_salary": 150000,
            "job_max_salary": 190000,
            "job_salary_currency": "USD",
            "job_salary_period": "YEAR",
            "job_highlights": {"Qualifications": ["5+ years Python", "Spark"]},
        },
        {"job_id": "no-title"},
    ],
}


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("JSEARCH_API_KEY", "test-key")
    jsearch.clear_cache()
    yield
    jsearch.clear_cache()


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_normalize_job_maps_fields():
    job = jsearch.normalize_job(SAMPLE["data"][0])
    assert job["title"] == "Senior Data Engineer"
    assert job["company"] == "Acme Corp"
    assert job["source"] == "LinkedIn"
    assert job["location"] == "Austin, TX, US (Remote)"
    assert job["salary"] == "USD 150k–190k/yr"
    assert job["date_posted"] == "2026-11-20"
    assert job["url"] == "https://www.linkedin.com/jobs/view/1"
    assert len(job["apply_options"]) == 2
    assert "Spark" in job["description"]
    assert "Qualifications: 5+ years Python; Spark" in job["highlights"]


def test_v2_response_shape_and_salary_string():
    v2 = {"status": "OK", "data": {"jobs": [dict(SAMPLE["data"][0], job_salary_string="120K–170K a year")], "cursor": "x"}}
    paths = []

    def handler(request):
        paths.append(request.url.path)
        return httpx.Response(200, json=v2)

    async def run():
        async with _client(handler) as c:
            return await jsearch.search_jobs("data engineer", client=c)

    jobs = asyncio.run(run())
    assert paths == ["/search-v2"]
    assert jobs[0]["salary"] == "120K–170K a year"


def test_falls_back_to_legacy_path_on_404():
    paths = []

    def handler(request):
        paths.append(request.url.path)
        if request.url.path == "/search-v2":
            return httpx.Response(404, json={"message": "Endpoint '/search-v2' does not exist"})
        return httpx.Response(200, json=SAMPLE)

    async def run():
        async with _client(handler) as c:
            return await jsearch.search_jobs("x", client=c)

    assert len(asyncio.run(run())) == 1
    assert paths == ["/search-v2", "/search"]


def test_search_sends_params_skips_untitled_and_caches():
    calls = []

    def handler(request: httpx.Request):
        calls.append(request)
        return httpx.Response(200, json=SAMPLE)

    async def run():
        async with _client(handler) as c:
            first = await jsearch.search_jobs("data engineer", location="Austin, TX", country="US",
                                              date_posted="week", client=c)
            second = await jsearch.search_jobs("data engineer", location="Austin, TX", country="US",
                                               date_posted="week", client=c)
        return first, second

    first, second = asyncio.run(run())
    assert len(first) == 1 and first == second
    assert len(calls) == 1  # second call served from cache
    q = calls[0].url.params
    assert q["query"] == "data engineer in Austin, TX"
    assert q["country"] == "us"
    assert q["date_posted"] == "week"
    assert calls[0].headers["X-RapidAPI-Key"] == "test-key"


def test_remote_only_and_invalid_date():
    seen = {}

    def handler(request):
        seen.update(request.url.params)
        return httpx.Response(200, json={"status": "OK", "data": []})

    async def run():
        async with _client(handler) as c:
            return await jsearch.search_jobs("pm", location="Berlin", remote_only=True,
                                             date_posted="yesterday", client=c)

    assert asyncio.run(run()) == []
    assert seen["query"] == "pm"  # location not added for remote searches
    assert seen["work_from_home"] == "true"
    assert seen["date_posted"] == "all"


@pytest.mark.parametrize("status", [429, 403, 500])
def test_http_errors_raise(status):
    async def run():
        async with _client(lambda r: httpx.Response(status, text="nope")) as c:
            await jsearch.search_jobs("x", client=c)

    with pytest.raises(jsearch.JSearchError):
        asyncio.run(run())


def test_not_configured(monkeypatch):
    monkeypatch.delenv("JSEARCH_API_KEY")
    assert not jsearch.is_configured()
    with pytest.raises(jsearch.JSearchError):
        asyncio.run(jsearch.search_jobs("x"))


# --- Agent integration -------------------------------------------------------


def _agent():
    from src.agents.job_suggest.job_suggest_agent import JobSuggestAgent

    agent = JobSuggestAgent.__new__(JobSuggestAgent)  # skip LLM setup
    agent._country_cache = {}

    class _Log:
        def info(self, *a, **k): ...
        def warning(self, *a, **k): ...

    agent.logger = _Log()
    return agent


def test_find_jobs_prefers_jsearch_and_dedups(monkeypatch):
    agent = _agent()
    job = jsearch.normalize_job(SAMPLE["data"][0])

    async def fake_search(**kwargs):
        return [dict(job)]

    async def no_scrape(*a, **k):
        raise AssertionError("scrapers should not run when JSearch has results")

    monkeypatch.setattr(jsearch, "search_jobs", fake_search)
    monkeypatch.setattr(agent, "_scrape_jobs", no_scrape)
    jobs, status = asyncio.run(agent._find_jobs(["a", "b"], {"remote_only": "true"}))
    assert len(jobs) == 1  # same job from two queries is deduplicated
    assert status["jsearch"]["jobs"] == 1


def test_find_jobs_falls_back_to_scrapers(monkeypatch):
    agent = _agent()

    async def failing(**kwargs):
        raise jsearch.JSearchError("quota exceeded")

    async def scrape(queries, location, max_per_query=5):
        return [{"title": "Fallback job", "company": "X", "source": "Indeed"}], {"indeed": {"jobs": 1}}

    monkeypatch.setattr(jsearch, "search_jobs", failing)
    monkeypatch.setattr(agent, "_scrape_jobs", scrape)
    jobs, status = asyncio.run(agent._find_jobs(["a"], {}))
    assert jobs[0]["title"] == "Fallback job"
    assert status["jsearch"]["errors"] == 1 and "quota" in status["jsearch"]["last_error"]
    assert "indeed" in status


def test_prefilter_keeps_most_relevant():
    agent = _agent()
    profile = "Data engineer with Python, Spark, Airflow, AWS and SQL experience"
    jobs = [{"title": f"Sales associate {i}", "description": "retail customer service"} for i in range(20)]
    jobs.append({"title": "Data Engineer", "description": "Python Spark Airflow AWS pipelines"})
    kept = agent._prefilter_jobs(profile, jobs, limit=5)
    assert len(kept) == 5
    assert kept[0]["title"] == "Data Engineer"


def test_ranking_prompt_includes_listing_numbers_and_description():
    agent = _agent()
    job = jsearch.normalize_job(SAMPLE["data"][0])
    text = agent._format_jobs_for_prompt([job])
    assert "**Listing #1**" in text
    assert "Airflow" in text and "5+ years Python" in text


def test_suggest_jobs_end_to_end_with_mocks(monkeypatch):
    """Portfolio -> queries -> JSearch -> prefilter -> ranking prompt, all wired together."""
    import src.agents.job_suggest.job_suggest_agent as mod

    agent = _agent()
    agent.get_prompt = lambda key, default=None: default if key != "rank_template" else None
    prompts = []

    async def fake_rag(**kwargs):
        return {"answer": "Data engineer: Python, Spark, Airflow, AWS"}

    async def fake_llm(user, system, messages=None, **kwargs):
        prompts.append(messages[-1]["content"])
        if "search queries" in messages[-1]["content"]:
            return "Data Engineer\nAnalytics Engineer"
        return "### 1. Senior Data Engineer at Acme Corp\n**Listing:** #1\n**Match Score:** 9/10"

    seen_kwargs = []

    async def fake_search(**kwargs):
        seen_kwargs.append(kwargs)
        return [jsearch.normalize_job(SAMPLE["data"][0])]

    monkeypatch.setattr(mod, "rag_search", fake_rag)
    monkeypatch.setattr(agent, "call_llm", fake_llm)
    monkeypatch.setattr(jsearch, "search_jobs", fake_search)

    result = asyncio.run(
        agent.suggest_jobs("my-cv", count=3, preferences={"date_posted": "week", "remote_only": "true"})
    )
    assert result["used_job_search"] and result["fallback_reason"] is None
    assert result["real_jobs"][0]["description"]
    assert {k["date_posted"] for k in seen_kwargs} == {"week"} and all(k["remote_only"] for k in seen_kwargs)
    ranking_prompt = prompts[-1]
    assert "**Listing #1**" in ranking_prompt and "Airflow" in ranking_prompt
    assert "Remote only" in ranking_prompt


def test_detail_prompt_includes_job_description(monkeypatch):
    import src.agents.job_suggest.job_suggest_agent as mod

    agent = _agent()
    agent.get_prompt = lambda key, default=None: default if key != "detail_template" else None
    captured = []

    async def fake_llm(user, system, messages=None, **kwargs):
        captured.append(messages[-1]["content"])
        return "analysis"

    async def no_web(**kwargs):
        return {"answer": ""}

    monkeypatch.setattr(agent, "call_llm", fake_llm)
    monkeypatch.setattr(mod, "aweb_search", no_web)
    asyncio.run(agent.get_job_detail("Data Engineer", company="Acme",
                                     job_description="Must know Kafka and dbt", portfolio_context="Python"))
    assert "Must know Kafka and dbt" in captured[0]
