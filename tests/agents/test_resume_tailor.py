"""Tests for tailoring the resume writer to an attached job."""

import asyncio

import pytest

from src.agents.resume_writer import edit_agent as ea
from src.agents.resume_writer.edit_agent import EditAgent, _strip_code_fence

JOB = {
    "title": "Data Engineer",
    "company": "Acme",
    "description": "Build Spark pipelines on AWS. {not a placeholder}",
}


@pytest.fixture
def agent(monkeypatch, tmp_path):
    monkeypatch.setattr(ea, "resume_writer_dir", lambda: tmp_path)
    a = EditAgent()
    calls = []

    async def fake_call_llm(user_prompt, system_prompt, stage, **_):
        calls.append({"user": user_prompt, "system": system_prompt, "stage": stage})
        return "```markdown\n# Jane\n\n## Skills\nSpark, AWS\n```"

    monkeypatch.setattr(a, "call_llm", fake_call_llm)
    monkeypatch.setattr(a, "get_model", lambda: "test-model")
    a.calls = calls
    return a


def test_tailor_sends_job_and_resume_and_strips_fence(agent):
    result = asyncio.run(agent.tailor(resume="# Jane\n\n## Skills\nAWS", job=JOB))

    assert result["tailored_resume"] == "# Jane\n\n## Skills\nSpark, AWS"
    call = agent.calls[0]
    assert call["stage"] == "tailor"
    assert "Data Engineer" in call["user"] and "Acme" in call["user"]
    assert "{not a placeholder}" in call["user"]
    assert "# Jane" in call["user"]
    assert "Never invent" in call["system"]

    history = ea.load_history()
    assert history[-1]["action"] == "tailor"
    assert history[-1]["job"] == {"title": "Data Engineer", "company": "Acme"}


def test_edit_includes_job_only_when_given(agent):
    asyncio.run(agent.process(text="Led a team", instruction="Rewrite"))
    asyncio.run(agent.process(text="Led a team", instruction="Rewrite", job=JOB))

    assert "Data Engineer" not in agent.calls[0]["user"]
    assert "Data Engineer" in agent.calls[1]["user"]


def test_long_job_description_is_truncated(agent):
    long_job = {**JOB, "description": "x" * (ea.MAX_JOB_DESCRIPTION_CHARS + 500)}
    asyncio.run(agent.tailor(resume="# Jane", job=long_job))
    assert "x" * (ea.MAX_JOB_DESCRIPTION_CHARS + 1) not in agent.calls[0]["user"]


def test_strip_code_fence_leaves_plain_text():
    assert _strip_code_fence("  # Jane  ") == "# Jane"
    assert _strip_code_fence("```\n# Jane\n```") == "# Jane"


def test_tailor_endpoint_rejects_job_without_description():
    from fastapi import HTTPException

    from src.api.routers.resume_writer import JobContext, TailorRequest, tailor_resume

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            tailor_resume(TailorRequest(resume="# Jane", job=JobContext(title="X", description=" ")))
        )
    assert exc.value.status_code == 400
