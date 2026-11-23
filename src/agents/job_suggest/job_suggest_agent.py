#!/usr/bin/env python
"""
JobSuggestAgent - AI-powered job recommendation engine.

This agent:
1. Analyzes a user's portfolio (resume/CV) via RAG
2. Generates optimal search queries based on the profile
3. Finds live listings via JSearch (LinkedIn, Indeed, Glassdoor, company sites;
   users can pick which), falling back to the Indeed/LinkedIn MCP scrapers
4. Uses LLM to rank and analyze real jobs against the portfolio

Features:
- Portfolio analysis via RAG
- Real job scraping via Indeed + LinkedIn (MCP scrapers)
- AI-powered match analysis between real jobs and portfolio
- Detailed per-job analysis with strengths, gaps, and prep tips
"""

import asyncio
import json
import re
from pathlib import Path
import sys
from typing import Any

# Add project root to path
_project_root = Path(__file__).parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from src.agents.base_agent import BaseAgent
from src.mcp.scrapers.indeed import IndeedScraper
from src.mcp.scrapers.linkedin import LinkedInScraper
from src.services.jobs import jsearch
from src.tools import aweb_search, rag_search

# Listings sent to the LLM for ranking (after the keyword pre-filter)
MAX_JOBS_FOR_RANKING = 15
# Characters of each job's description included in the ranking prompt
DESCRIPTION_CHARS_FOR_RANKING = 900
# Max JSearch requests per suggestion run when the user picks specific job sites
MAX_SOURCE_REQUESTS = 4

_STOPWORDS = set(
    """a an and are as at be by for from has have in is it its of on or that the to with
    will we you your our their this these those who what when where which while about into
    over under than then them they he she his her i me my not no yes can may also more most
    other some such only own same so very just using used use work working experience years
    year team teams role roles job jobs position company skills skill including include""".split()
)


class JobSuggestAgent(BaseAgent):
    """
    AI-powered job suggestion agent with real job scraping.

    Analyzes the user's portfolio via RAG, finds live listings (JSearch, with
    the Indeed/LinkedIn scrapers as a fallback), and ranks them by match quality.
    """

    def __init__(
        self,
        language: str = "en",
        config: dict[str, Any] | None = None,
        **kwargs,
    ):
        super().__init__(
            module_name="job_suggest",
            agent_name="job_suggest_agent",
            language=language,
            config=config,
            **kwargs,
        )
        self.indeed = IndeedScraper()
        self.linkedin = LinkedInScraper()
        self._country_cache: dict[str, str] = {}
        self.logger.info(
            f"JobSuggestAgent initialized: model={self.model}, language={language}"
        )

    # ------------------------------------------------------------------
    # Abstract method implementation
    # ------------------------------------------------------------------

    async def process(self, *args, **kwargs) -> Any:
        raise NotImplementedError(
            "Use suggest_jobs() or get_job_detail() instead."
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def suggest_jobs(
        self,
        kb_name: str,
        count: int = 5,
        preferences: dict[str, str] | None = None,
        portfolio_context: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate job suggestions by scraping real listings and ranking them
        against the user's portfolio.

        Flow:
        1. RAG extracts portfolio skills/experience
        2. LLM generates optimal search queries from the profile
        3. Indeed + LinkedIn scrapers fetch real job listings
        4. LLM ranks and analyzes real jobs against the portfolio

        Args:
            kb_name: Portfolio KB name for RAG search
            count: Number of job suggestions to return
            preferences: Optional dict with keys like:
                - role_type: Desired role (e.g., "Software Engineer")
                - location: Preferred location (e.g., "Remote", "San Francisco")
                - industry: Preferred industry (e.g., "AI/ML", "FinTech")
                - experience_level: "entry", "mid", "senior", "lead"
            portfolio_context: Pre-fetched portfolio context (skips RAG if provided)

        Returns:
            dict with "suggestions" (markdown), "real_jobs" (structured list),
            "portfolio_summary", "used_portfolio", "used_job_search", etc.
        """
        preferences = preferences or {}

        # --- 1. Portfolio analysis via RAG ---
        if portfolio_context is None:
            portfolio_context = ""
        if not portfolio_context and kb_name:
            try:
                pref_hint = ""
                if preferences.get("role_type"):
                    pref_hint = f" relevant to {preferences['role_type']} roles"

                rag_result = await rag_search(
                    query=(
                        f"Complete professional summary including all skills, "
                        f"work experience, education, projects, certifications, "
                        f"and notable achievements{pref_hint}"
                    ),
                    kb_name=kb_name,
                    mode="hybrid",
                )
                portfolio_context = rag_result.get("answer", "")
                self.logger.info(
                    f"RAG retrieved {len(portfolio_context)} chars of portfolio context"
                )
            except Exception as e:
                self.logger.warning(f"RAG search failed: {e}")

        if not portfolio_context:
            return {
                "suggestions": "",
                "real_jobs": [],
                "search_queries": [],
                "portfolio_summary": "",
                "used_portfolio": False,
                "used_job_search": False,
                "error": "Could not retrieve portfolio data. Please ensure your portfolio KB has documents.",
            }

        # --- 2. Generate search queries from portfolio ---
        search_queries = await self._generate_search_queries(
            portfolio_context, preferences
        )
        self.logger.info(f"Generated {len(search_queries)} search queries: {search_queries}")

        # --- 3. Find live listings (JSearch first, scrapers as a fallback) ---
        real_jobs, source_status = await self._find_jobs(
            search_queries, preferences, max_per_query=max(count, 10)
        )
        self.logger.info(f"Found {len(real_jobs)} live job listings")

        if not real_jobs:
            # Fallback: generate hypothetical suggestions if no source returned listings
            self.logger.warning("No real jobs found, falling back to LLM suggestions")
            result = await self._fallback_suggest(portfolio_context, preferences, count)
            result["search_queries"] = search_queries
            result["source_status"] = source_status
            result["fallback_reason"] = (
                "No live job listings were found for these searches. "
                "These are AI-generated role ideas, not live job postings. "
                "Try a broader role, a different location, or a longer date range."
            )
            return result

        # --- 4. Keep the most relevant listings, then the LLM ranks them on full descriptions ---
        real_jobs = self._prefilter_jobs(portfolio_context, real_jobs, MAX_JOBS_FOR_RANKING)
        analysis = await self._rank_and_analyze_jobs(
            portfolio_context, real_jobs, preferences, count
        )

        return {
            "suggestions": analysis,
            "real_jobs": real_jobs,
            "search_queries": search_queries,
            "portfolio_summary": portfolio_context[:500],
            "used_portfolio": bool(portfolio_context),
            "used_job_search": True,
            "job_count": len(real_jobs),
            "source_status": source_status,
            "fallback_reason": None,
        }

    async def get_job_detail(
        self,
        job_title: str,
        company: str = "",
        company_type: str = "",
        job_url: str = "",
        job_description: str = "",
        kb_name: str = "",
        portfolio_context: str | None = None,
    ) -> dict[str, Any]:
        """
        Get detailed analysis for a specific job listing against the portfolio.

        Args:
            job_title: The job title
            company: Company name
            company_type: Type of company (for fallback)
            job_url: URL to the job listing
            job_description: Job description snippet
            kb_name: Portfolio KB name for RAG
            portfolio_context: Pre-fetched portfolio context (optional)

        Returns:
            dict with "analysis", "used_portfolio", "used_web_search".
        """
        # --- 1. Portfolio context ---
        if portfolio_context is None:
            portfolio_context = ""
        if not portfolio_context and kb_name:
            try:
                rag_result = await rag_search(
                    query=(
                        f"All skills, experience, and qualifications relevant to "
                        f"a {job_title} role at {company or company_type}"
                    ),
                    kb_name=kb_name,
                    mode="hybrid",
                )
                portfolio_context = rag_result.get("answer", "")
            except Exception as e:
                self.logger.warning(f"RAG search failed for detail: {e}")

        # --- 2. Try to get full job description from URL ---
        full_description = job_description
        if job_url and not full_description:
            try:
                if "indeed.com" in job_url:
                    detail = await self.indeed.get_job_details(job_url)
                    full_description = detail.get("full_description", "")
                elif "linkedin.com" in job_url:
                    detail = await self.linkedin.get_job_details(job_url)
                    full_description = detail.get("full_description", "")
            except Exception as e:
                self.logger.warning(f"Failed to fetch full job description: {e}")

        # --- 3. Web search for supplementary info ---
        web_context = ""
        try:
            company_str = f" at {company}" if company else ""
            web_query = (
                f"{job_title}{company_str} job requirements skills salary "
                f"career path 2025 2026"
            )
            web_result = await aweb_search(query=web_query, verbose=False)
            web_context = web_result.get("answer", "")
        except Exception as e:
            self.logger.warning(f"Web search failed for detail: {e}")

        # --- 4. Build prompt ---
        system_prompt = self.get_prompt(
            "detail_system",
            "You are an expert career advisor.",
        )

        web_section = self._format_web_section(web_context)
        template = self.get_prompt("detail_template")
        if template:
            user_prompt = template.format(
                job_title=job_title,
                company_type=company or company_type or "Not specified",
                job_description_section=self._format_job_description_section(full_description),
                portfolio_context=portfolio_context or "No portfolio data available.",
                web_section=web_section,
            )
        else:
            user_prompt = self._build_detail_prompt_inline(
                job_title,
                company or company_type,
                portfolio_context,
                web_section,
                self._format_job_description_section(full_description),
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        analysis = await self.call_llm("", "", messages=messages)

        return {
            "analysis": analysis,
            "used_portfolio": bool(portfolio_context),
            "used_web_search": bool(web_context),
        }

    # ------------------------------------------------------------------
    # Internal: Search query generation
    # ------------------------------------------------------------------

    async def _generate_search_queries(
        self,
        portfolio_context: str,
        preferences: dict[str, str],
    ) -> list[str]:
        """Use LLM to generate optimal job search queries from the portfolio."""

        # If user specified a role, use that directly as the primary query
        if preferences.get("role_type"):
            queries = [preferences["role_type"]]
            # Also generate 1-2 related queries
            try:
                system_prompt = (
                    "You are a job search expert. Given a candidate's profile and "
                    "their desired role, generate 2 additional search queries that "
                    "would find related positions they'd also be qualified for."
                )
                user_prompt = (
                    f"Desired role: {preferences['role_type']}\n\n"
                    f"Candidate profile:\n{portfolio_context[:1500]}\n\n"
                    f"Generate exactly 2 additional job search queries (one per line). "
                    f"Each should be a concise job title or role description "
                    f"(2-5 words max). No numbering, no explanations."
                )
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
                response = await self.call_llm("", "", messages=messages)
                extra = [
                    q.strip().strip("-").strip("•").strip()
                    for q in response.strip().split("\n")
                    if q.strip() and len(q.strip()) < 80
                ]
                queries.extend(extra[:2])
            except Exception as e:
                self.logger.warning(f"Failed to generate extra queries: {e}")
            return queries

        # No explicit role: generate queries entirely from the portfolio
        try:
            system_prompt = (
                "You are a job search expert. Given a candidate's professional profile, "
                "generate the 3 best job search queries that would find positions "
                "matching their skills and experience."
            )
            pref_lines = ""
            if any(preferences.values()):
                parts = []
                if preferences.get("industry"):
                    parts.append(f"Industry: {preferences['industry']}")
                if preferences.get("experience_level"):
                    parts.append(f"Level: {preferences['experience_level']}")
                pref_lines = f"\nPreferences: {', '.join(parts)}\n"

            user_prompt = (
                f"Candidate profile:\n{portfolio_context[:2000]}\n"
                f"{pref_lines}\n"
                f"Generate exactly 3 job search queries (one per line). "
                f"Each should be a concise job title or role description "
                f"(2-5 words max). No numbering, no explanations. "
                f"Order from best match to broader match."
            )
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            response = await self.call_llm("", "", messages=messages)
            queries = [
                q.strip().strip("-").strip("•").strip("1234567890.").strip()
                for q in response.strip().split("\n")
                if q.strip() and len(q.strip()) < 80
            ]
            return queries[:3] if queries else ["software engineer"]
        except Exception as e:
            self.logger.warning(f"Failed to generate search queries: {e}")
            return ["software engineer"]

    # ------------------------------------------------------------------
    # Internal: Job scraping
    # ------------------------------------------------------------------

    async def _find_jobs(
        self,
        queries: list[str],
        preferences: dict[str, str],
        max_per_query: int = 10,
    ) -> tuple[list[dict], dict[str, dict]]:
        """Live listings for the queries: JSearch when configured, else (or on failure) the scrapers."""
        location = preferences.get("location", "")
        date_posted = preferences.get("date_posted", "") or "all"
        remote_only = str(preferences.get("remote_only", "")).lower() in ("1", "true", "yes")

        sources = jsearch.normalize_sources(preferences.get("sources", ""))

        status: dict[str, dict] = {}
        if jsearch.is_configured():
            country = await self._infer_country(location) if location and not remote_only else ""
            plan = self._plan_source_requests(queries, sources)
            results = await asyncio.gather(
                *[
                    jsearch.search_jobs(
                        query=q,
                        location=location,
                        country=country,
                        date_posted=date_posted,
                        remote_only=remote_only,
                        via=via,
                    )
                    for q, via in plan
                ],
                return_exceptions=True,
            )
            jobs: list[dict] = []
            seen: set[tuple[str, str]] = set()
            st = {"jobs": 0, "errors": 0, "last_error": None, "requests": len(plan)}
            for result in results:
                if isinstance(result, Exception):
                    st["errors"] += 1
                    st["last_error"] = str(result)[:200]
                    self.logger.warning(f"JSearch error: {result}")
                    continue
                for job in result[: max_per_query * 2]:
                    if sources and job.get("source_key") not in sources:
                        continue  # the user didn't pick this job site
                    key = (job["title"].lower(), job["company"].lower())
                    if key in seen:
                        continue
                    seen.add(key)
                    jobs.append(job)
            st["jobs"] = len(jobs)
            status["jsearch"] = st
            if jobs:
                return jobs, status
            self.logger.warning("JSearch returned no listings; falling back to scrapers")

        scraper_sources = [s for s in ("indeed", "linkedin") if not sources or s in sources]
        if not scraper_sources:
            return [], status
        scraped, scraper_status = await self._scrape_jobs(
            queries, location, max_per_query=max_per_query, sources=scraper_sources
        )
        status.update(scraper_status)
        return scraped, status

    @staticmethod
    def _plan_source_requests(queries: list[str], sources: list[str]) -> list[tuple[str, str]]:
        """(query, via) pairs to send to JSearch.

        No sites chosen: every query once, untargeted. Specific sites chosen:
        target each named site ("via LinkedIn"), spreading at most
        MAX_SOURCE_REQUESTS requests across them, plus one untargeted query
        when "company websites" or "other job sites" are chosen.
        """
        if not queries:
            return []
        if not sources:
            return [(q, "") for q in queries]
        named = [s for s in sources if s in jsearch.TARGETABLE_SOURCES]
        untargeted = any(s not in jsearch.TARGETABLE_SOURCES for s in sources)
        budget = MAX_SOURCE_REQUESTS - (1 if untargeted else 0)
        plan: list[tuple[str, str]] = []
        if named:
            per_source = max(1, min(len(queries), budget // len(named)))
            for src in named:
                plan.extend((q, jsearch.SOURCE_LABELS[src]) for q in queries[:per_source])
        if untargeted:
            plan.append((queries[0], ""))
        return plan

    async def _infer_country(self, location: str) -> str:
        """ISO country code for a free-text location (JSearch searches one country at a time)."""
        key = location.strip().lower()
        if not key or key in ("remote", "anywhere", "worldwide"):
            return ""
        if key in self._country_cache:
            return self._country_cache[key]
        code = ""
        try:
            response = await self.call_llm(
                "",
                "",
                messages=[
                    {
                        "role": "system",
                        "content": "Reply with only the ISO 3166-1 alpha-2 country code, lowercase. "
                        "If the location is not a real place or is ambiguous, reply 'us'.",
                    },
                    {"role": "user", "content": f"Location: {location}"},
                ],
                max_tokens=5,
                temperature=0,
                verbose=False,
            )
            candidate = response.strip().strip(".").lower()
            if len(candidate) == 2 and candidate.isalpha():
                code = candidate
        except Exception as e:
            self.logger.warning(f"Country lookup failed for {location!r}: {e}")
        self._country_cache[key] = code
        return code

    @staticmethod
    def _tokens(text: str) -> set[str]:
        return {
            w
            for w in re.findall(r"[a-z][a-z0-9+#.\-]{1,}", text.lower())
            if w not in _STOPWORDS and len(w) > 2
        }

    def _prefilter_jobs(self, portfolio_context: str, jobs: list[dict], limit: int) -> list[dict]:
        """Cheap keyword-overlap score so only the most relevant listings go to the LLM."""
        if len(jobs) <= limit:
            return jobs
        profile = self._tokens(portfolio_context)
        if not profile:
            return jobs[:limit]

        def score(job: dict) -> float:
            title = self._tokens(job.get("title", ""))
            body = self._tokens(" ".join([job.get("highlights", ""), job.get("description", "") or job.get("snippet", "")]))
            return 3 * len(title & profile) + len(body & profile) / max(1.0, len(body) ** 0.5)

        ranked = sorted(enumerate(jobs), key=lambda p: (-score(p[1]), p[0]))
        return [job for _, job in ranked[:limit]]

    async def _scrape_jobs(
        self,
        queries: list[str],
        location: str,
        max_per_query: int = 5,
        sources: tuple[str, ...] | list[str] = ("indeed", "linkedin"),
    ) -> tuple[list[dict], dict[str, dict]]:
        """
        Scrape jobs from Indeed and/or LinkedIn for all queries in parallel.
        Deduplicates by title+company.

        Returns:
            (jobs, source_status) where source_status maps "indeed"/"linkedin"
            to {"jobs": int, "errors": int, "last_error": str | None} so callers
            can tell users which sources actually returned listings.
        """
        wanted = set(sources)
        tasks = []
        sources = []
        for query in queries:
            if "indeed" in wanted:
                tasks.append(
                    self.indeed.search_jobs(
                        query=query,
                        location=location,
                        max_results=max_per_query,
                    )
                )
                sources.append("indeed")
            if "linkedin" in wanted:
                tasks.append(
                    self.linkedin.search_jobs(
                        keywords=query,
                        location=location,
                        max_results=max_per_query,
                    )
                )
                sources.append("linkedin")

        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_jobs = []
        seen = set()
        status = {
            name: {"jobs": 0, "errors": 0, "last_error": None} for name in ("indeed", "linkedin")
        }

        for source, result in zip(sources, results):
            if isinstance(result, Exception):
                self.logger.warning(f"Scraper error ({source}): {result}")
                status[source]["errors"] += 1
                status[source]["last_error"] = str(result)[:200]
                continue
            if isinstance(result, list):
                for job in result:
                    if job.get("error"):
                        status[source]["errors"] += 1
                        status[source]["last_error"] = str(job["error"])[:200]
                        continue
                    # Deduplicate by title + company (case-insensitive)
                    dedup_key = (
                        job.get("title", "").lower().strip(),
                        job.get("company", "").lower().strip(),
                    )
                    if dedup_key not in seen and dedup_key[0] != "n/a":
                        seen.add(dedup_key)
                        all_jobs.append(job)
                        status[source]["jobs"] += 1

        for source, st in status.items():
            if st["jobs"] == 0:
                self.logger.warning(
                    f"{source} returned no listings "
                    f"({st['errors']} errors; last: {st['last_error']})"
                )

        return all_jobs, status

    # ------------------------------------------------------------------
    # Internal: LLM ranking
    # ------------------------------------------------------------------

    async def _rank_and_analyze_jobs(
        self,
        portfolio_context: str,
        real_jobs: list[dict],
        preferences: dict[str, str],
        count: int,
    ) -> str:
        """Use LLM to rank and analyze real job listings against the portfolio."""

        # Format real jobs for the prompt
        jobs_text = self._format_jobs_for_prompt(real_jobs)

        system_prompt = self.get_prompt(
            "rank_system",
            (
                "You are an expert career advisor. You analyze real job listings "
                "and determine how well they match a candidate's profile. "
                "You provide honest, specific assessments."
            ),
        )

        preferences_section = self._format_preferences_section(preferences)

        template = self.get_prompt("rank_template")
        if template:
            user_prompt = template.format(
                count=min(count, len(real_jobs)),
                portfolio_context=portfolio_context[:2000],
                jobs_listing=jobs_text,
                preferences_section=preferences_section,
            )
        else:
            user_prompt = self._build_rank_prompt_inline(
                min(count, len(real_jobs)),
                portfolio_context,
                jobs_text,
                preferences_section,
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        return await self.call_llm("", "", messages=messages)

    def _format_jobs_for_prompt(self, jobs: list[dict]) -> str:
        """Format scraped job listings into a text block for the LLM prompt."""
        lines = []
        for i, job in enumerate(jobs, 1):
            parts = [f"**Listing #{i}**"]
            if job.get("title"):
                parts.append(f"  - Title: {job['title']}")
            if job.get("company"):
                parts.append(f"  - Company: {job['company']}")
            if job.get("location"):
                parts.append(f"  - Location: {job['location']}")
            if job.get("salary") and job["salary"] != "Not listed":
                parts.append(f"  - Salary: {job['salary']}")
            if job.get("employment_type"):
                parts.append(f"  - Type: {job['employment_type']}")
            details = job.get("highlights") or ""
            body = job.get("description") or job.get("snippet") or ""
            if body:
                details = f"{details}\n{body}" if details else body
            if details:
                excerpt = " ".join(details.split())[:DESCRIPTION_CHARS_FOR_RANKING]
                parts.append(f"  - Description: {excerpt}")
            if job.get("date_posted"):
                parts.append(f"  - Posted: {job['date_posted']}")
            if job.get("url") and job["url"] != "N/A":
                parts.append(f"  - URL: {job['url']}")
            if job.get("source"):
                parts.append(f"  - Source: {job['source']}")
            lines.append("\n".join(parts))
        return "\n\n".join(lines)

    # ------------------------------------------------------------------
    # Fallback: LLM-only suggestions
    # ------------------------------------------------------------------

    async def _fallback_suggest(
        self,
        portfolio_context: str,
        preferences: dict[str, str],
        count: int,
    ) -> dict[str, Any]:
        """Fallback to pure LLM suggestions when scrapers return nothing."""
        system_prompt = self.get_prompt(
            "suggest_system",
            "You are an expert career advisor and job market analyst.",
        )
        preferences_section = self._format_preferences_section(preferences)

        # Try web search for market context
        market_context = ""
        try:
            role_hint = preferences.get("role_type", "technology")
            location_hint = preferences.get("location", "")
            loc_str = f" in {location_hint}" if location_hint else ""
            web_query = (
                f"Current job market trends and in-demand skills for "
                f"{role_hint} roles{loc_str} 2025 2026 salary demand"
            )
            web_result = await aweb_search(query=web_query, verbose=False)
            market_context = web_result.get("answer", "")
        except Exception:
            pass

        market_section = self._format_market_section(market_context)

        template = self.get_prompt("suggest_template")
        if template:
            user_prompt = template.format(
                count=count,
                portfolio_context=portfolio_context,
                preferences_section=preferences_section,
                market_section=market_section,
            )
        else:
            user_prompt = self._build_suggest_prompt_inline(
                count, portfolio_context, preferences_section, market_section
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        response = await self.call_llm("", "", messages=messages)

        return {
            "suggestions": response,
            "real_jobs": [],
            "search_queries": [],
            "portfolio_summary": portfolio_context[:500],
            "used_portfolio": bool(portfolio_context),
            "used_job_search": False,
            "job_count": 0,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _format_preferences_section(self, preferences: dict[str, str]) -> str:
        if not preferences or not any(preferences.values()):
            return ""

        lines = []
        label_map = {
            "role_type": "Desired Role",
            "location": "Preferred Location",
            "industry": "Preferred Industry",
            "experience_level": "Experience Level",
        }
        picked = jsearch.normalize_sources(preferences.get("sources", ""))
        if picked:
            preferences = {**preferences, "sites": ", ".join(jsearch.SOURCE_LABELS[s] for s in picked)}
            label_map["sites"] = "Preferred Job Sites"
        if str(preferences.get("remote_only", "")).lower() in ("1", "true", "yes"):
            preferences = {**preferences, "work_mode": "Remote only"}
            label_map["work_mode"] = "Work Mode"
        for key, label in label_map.items():
            val = preferences.get(key, "").strip()
            if val:
                lines.append(f"- **{label}**: {val}")

        if not lines:
            return ""

        preferences_text = "\n".join(lines)
        template = self.get_prompt("preferences_section_template")
        if template:
            return template.format(preferences_text=preferences_text)
        return (
            f"## Candidate Preferences\n{preferences_text}\n\n"
            f"Take these preferences into account when ranking positions."
        )

    def _format_market_section(self, market_context: str) -> str:
        if not market_context:
            return ""
        template = self.get_prompt("market_section_template")
        if template:
            return template.format(market_context=market_context)
        return (
            f"## Current Job Market Insights\n"
            f"<market_research>\n{market_context}\n</market_research>"
        )

    @staticmethod
    def _format_job_description_section(description: str) -> str:
        if not description:
            return ""
        return f"## Job Description\n<job_description>\n{description[:4000]}\n</job_description>"

    def _format_web_section(self, web_context: str) -> str:
        if not web_context:
            return ""
        template = self.get_prompt("web_section_template")
        if template:
            return template.format(web_context=web_context)
        return (
            f"## Current Market Information\n"
            f"<web_research>\n{web_context}\n</web_research>"
        )

    @staticmethod
    def _build_rank_prompt_inline(
        count, portfolio_context, jobs_listing, preferences_section
    ) -> str:
        return (
            f"Analyze the following real job listings and select the top {count} "
            f"that best match this candidate's profile.\n\n"
            f"## Candidate Profile\n<candidate_profile>\n{portfolio_context}\n</candidate_profile>\n\n"
            f"{preferences_section}\n\n"
            f"## Real Job Listings Found\n{jobs_listing}\n\n"
            f"## Instructions\n"
            f"1. Select the top {count} jobs that best match this candidate.\n"
            f"2. Rank them from best match (#1) to good match (#{count}).\n"
            f"3. For each, use this format:\n\n"
            f"### {{number}}. {{Job Title}} at {{Company}}\n"
            f"**Listing:** #{{listing number from the list above}}\n"
            f"**Location:** {{location}}\n"
            f"**Source:** {{source}}\n"
            f"**URL:** {{url}}\n"
            f"**Why It Fits:** 2-3 sentences on why this is a strong match\n"
            f"**Key Skills Match:** list the candidate's matching skills\n"
            f"**Potential Gaps:** any areas where the candidate might need to upskill\n"
            f"**Match Score:** X/10\n"
        )

    @staticmethod
    def _build_suggest_prompt_inline(
        count, portfolio_context, preferences_section, market_section
    ) -> str:
        return (
            f"Based on the candidate's background, suggest exactly {count} job positions.\n\n"
            f"## Candidate Profile\n<candidate_profile>\n{portfolio_context}\n</candidate_profile>\n\n"
            f"{preferences_section}\n{market_section}\n\n"
            f"## Instructions\n"
            f"1. Suggest exactly {count} specific job positions.\n"
            f"2. For each: Job Title, Company Type, Why It Fits, Key Skills Match, Salary Range, Growth Potential.\n"
            f"3. Rank from best match to good match.\n"
            f"4. Be specific — reference the candidate's actual skills.\n"
        )

    @staticmethod
    def _build_detail_prompt_inline(
        job_title, company_type, portfolio_context, web_section, job_description_section=""
    ) -> str:
        return (
            f"Provide a detailed analysis of how this candidate matches the following role.\n\n"
            f"## Job Role\n**Title**: {job_title}\n**Company Type**: {company_type}\n\n"
            f"{job_description_section}\n\n"
            f"## Candidate Profile\n<candidate_profile>\n{portfolio_context}\n</candidate_profile>\n\n"
            f"{web_section}\n\n"
            f"## Instructions\n"
            f"Cover: Match Score (1-10), Strengths, Gaps, How to Prepare, "
            f"Interview Tips, Similar Roles, Where to Look.\n"
        )


__all__ = ["JobSuggestAgent"]
