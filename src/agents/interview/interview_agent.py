#!/usr/bin/env python
"""
InterviewAgent - AI-powered interview preparation coach.

This agent provides:
- Interview question generation from job descriptions
- Personalized answer generation using resume RAG
- Web search fallback for industry best practices
- Configurable difficulty levels (easy/medium/hard)

Uses the unified LLM factory from BaseAgent for both cloud and local LLM support.
"""

import re
from pathlib import Path
import sys
from typing import Any

# Add project root to path
_project_root = Path(__file__).parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from src.agents.base_agent import BaseAgent
from src.tools import rag_search, web_search


# Difficulty level guidance
LEVEL_GUIDANCE = {
    "easy": "Focus on fundamental concepts, basic behavioral questions, and straightforward technical questions suitable for entry-level candidates.",
    "medium": "Include a mix of behavioral, situational, and moderately challenging technical questions suitable for mid-level candidates.",
    "hard": "Include complex system design questions, advanced technical deep-dives, challenging behavioral scenarios, and leadership/strategy questions suitable for senior-level candidates.",
}

LEVEL_GUIDANCE_ZH = {
    "easy": "侧重基础概念、基本行为类问题和适合入门级候选人的简单技术问题。",
    "medium": "包含行为类、情景类和中等难度的技术问题，适合中级候选人。",
    "hard": "包含复杂的系统设计问题、深入的技术探讨、具有挑战性的行为场景和领导力/战略问题，适合高级候选人。",
}


class InterviewAgent(BaseAgent):
    """
    AI-powered interview preparation agent.

    Features:
    - Generates targeted interview questions from job descriptions
    - Produces personalized answers using resume/portfolio RAG
    - Falls back to web search for industry best practices
    - Supports Easy / Medium / Hard difficulty levels
    - Bilingual prompt templates (English & Chinese)
    """

    def __init__(
        self,
        language: str = "en",
        config: dict[str, Any] | None = None,
        **kwargs,
    ):
        """
        Initialize InterviewAgent.

        Args:
            language: Language setting ('zh' | 'en')
            config: Optional configuration dictionary
            **kwargs: Additional arguments passed to BaseAgent
        """
        super().__init__(
            module_name="interview",
            agent_name="interview_agent",
            language=language,
            config=config,
            **kwargs,
        )

        self.logger.info(
            f"InterviewAgent initialized: model={self.model}, language={language}"
        )

    # ------------------------------------------------------------------
    # Abstract method implementation (required by BaseAgent)
    # ------------------------------------------------------------------

    async def process(self, *args, **kwargs) -> Any:
        """Not used directly — call generate_questions / generate_answer instead."""
        raise NotImplementedError(
            "Use generate_questions() or generate_answer() instead."
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_questions(
        self,
        job_title: str,
        job_description: str,
        company: str = "",
        level: str = "medium",
        count: int = 5,
    ) -> list[dict]:
        """
        Generate interview questions for a given job description.

        Args:
            job_title: Title of the position
            job_description: Full job description text
            company: Company name (optional)
            level: Difficulty — "easy", "medium", or "hard"
            count: Number of questions to generate

        Returns:
            List of dicts with "number" and "question" keys.
        """
        system_prompt = self.get_prompt(
            "question_system",
            "You are an expert interview coach who generates targeted interview questions.",
        )

        company_line = f" at **{company}**" if company else ""
        guidance = LEVEL_GUIDANCE if self.language == "en" else LEVEL_GUIDANCE_ZH
        level_text = guidance.get(level, guidance["medium"])

        # Build user prompt from template (fallback to inline if template missing)
        template = self.get_prompt("question_template")
        if template:
            user_prompt = template.format(
                count=count,
                job_title=job_title,
                company_line=company_line,
                level=level.upper(),
                job_description=job_description,
                level_guidance=level_text,
            )
        else:
            user_prompt = self._build_question_prompt_inline(
                job_title, company, job_description, level, count, level_text
            )

        self.logger.info(
            f"Generating {count} {level} questions for: {job_title}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response = await self.call_llm("", "", messages=messages)
        questions = self._parse_questions(response)

        self.logger.info(f"Generated {len(questions)} questions")
        return questions

    async def generate_answer(
        self,
        question: str,
        job_title: str,
        company: str = "",
        job_description: str = "",
        kb_name: str = "",
        resume_context: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate a personalized answer for an interview question.

        Uses RAG (resume) + web search to build context, then calls LLM.

        Args:
            question: The interview question
            job_title: Position being interviewed for
            company: Company name (optional)
            job_description: Job description text (optional)
            kb_name: Portfolio/KB name for resume RAG (optional)
            resume_context: Pre-fetched resume context (optional, skips RAG)

        Returns:
            dict with "answer", "used_resume", "used_web_search".
        """
        # --- 1. Resume context via RAG ---
        if resume_context is None:
            resume_context = ""
        if not resume_context and kb_name:
            try:
                rag_result = await rag_search(
                    query=f"Relevant experience and skills for: {question}",
                    kb_name=kb_name,
                    mode="hybrid",
                )
                resume_context = rag_result.get("answer", "")
                self.logger.info(
                    f"RAG retrieved {len(resume_context)} chars of resume context"
                )
            except Exception as e:
                self.logger.warning(f"RAG search failed: {e}")

        # --- 2. Web search fallback / supplement ---
        web_context = ""
        try:
            company_part = f" at {company}" if company else ""
            web_query = (
                f"Best answer for interview question: {question} "
                f"for {job_title}{company_part}"
            )
            web_result = web_search(query=web_query, verbose=False)
            web_context = web_result.get("answer", "")
            if web_context:
                self.logger.info(
                    f"Web search retrieved {len(web_context)} chars"
                )
        except Exception as e:
            self.logger.warning(f"Web search failed: {e}")

        # --- 3. Build prompt ---
        system_prompt = self.get_prompt(
            "answer_system",
            "You are an expert interview coach who helps candidates craft compelling, personalized interview answers.",
        )

        resume_section = self._format_resume_section(resume_context)
        web_section = self._format_web_section(web_context)
        company_line = f" at {company}" if company else ""
        jd_text = job_description[:1500] if job_description else "No specific job description provided."

        template = self.get_prompt("answer_template")
        if template:
            user_prompt = template.format(
                job_title=job_title,
                company_line=company_line,
                question=question,
                resume_section=resume_section,
                web_section=web_section,
                job_description=jd_text,
            )
        else:
            user_prompt = self._build_answer_prompt_inline(
                question, job_title, company_line, jd_text,
                resume_section, web_section,
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        answer = await self.call_llm("", "", messages=messages)

        return {
            "answer": answer,
            "used_resume": bool(resume_context),
            "used_web_search": bool(web_context),
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _format_resume_section(self, resume_context: str) -> str:
        if not resume_context:
            return ""
        template = self.get_prompt("resume_section_template")
        if template:
            return template.format(resume_context=resume_context)
        return (
            f"## Candidate's Background (from their resume/CV)\n"
            f"<candidate_profile>\n{resume_context}\n</candidate_profile>\n\n"
            f"Use the candidate's specific experiences to craft a personalized answer."
        )

    def _format_web_section(self, web_context: str) -> str:
        if not web_context:
            return ""
        template = self.get_prompt("web_section_template")
        if template:
            return template.format(web_context=web_context)
        return (
            f"## Industry Best Practices (from web search)\n"
            f"<web_research>\n{web_context}\n</web_research>\n\n"
            f"Use these insights to strengthen the answer."
        )

    @staticmethod
    def _parse_questions(raw_text: str) -> list[dict]:
        """Parse numbered questions from LLM response."""
        questions: list[dict] = []
        current_q = ""
        current_num = 0

        for line in raw_text.strip().split("\n"):
            line = line.strip()
            if not line:
                continue

            match = re.match(r"^(\d+)[.)]\s*(.+)", line)
            if match:
                if current_q and current_num > 0:
                    questions.append(
                        {"number": current_num, "question": current_q.strip()}
                    )
                current_num = int(match.group(1))
                current_q = match.group(2)
            elif current_num > 0:
                current_q += " " + line

        if current_q and current_num > 0:
            questions.append(
                {"number": current_num, "question": current_q.strip()}
            )

        return questions

    # --- Inline fallback prompts (used if YAML templates are missing) ---

    @staticmethod
    def _build_question_prompt_inline(
        job_title, company, job_description, level, count, level_text
    ) -> str:
        company_line = f" at **{company}**" if company else ""
        return (
            f"Generate exactly {count} interview questions for the following position.\n\n"
            f"## Position\n- **Job Title**: {job_title}{company_line}\n"
            f"- **Difficulty Level**: {level.upper()}\n\n"
            f"## Job Description\n{job_description}\n\n"
            f"## Difficulty Guidance\n{level_text}\n\n"
            f"## Instructions\n"
            f"1. Generate exactly {count} questions numbered 1 through {count}.\n"
            f"2. Mix different question types.\n"
            f"3. Make questions specific to the job description.\n"
            f"4. Format: Output as a numbered list. Do NOT include answers.\n\n"
            f"## Output Format\n1. [First question]\n2. [Second question]\n..."
        )

    @staticmethod
    def _build_answer_prompt_inline(
        question, job_title, company_line, jd_text, resume_section, web_section
    ) -> str:
        return (
            f"You are helping a candidate prepare for an interview for **{job_title}**{company_line}.\n\n"
            f"## Interview Question\n{question}\n\n"
            f"{resume_section}\n{web_section}\n\n"
            f"## Job Context\n{jd_text}\n\n"
            f"## Instructions\n"
            f"1. Provide a strong, structured answer.\n"
            f"2. Weave in the candidate's experiences if available.\n"
            f"3. Incorporate web research insights if available.\n"
            f"4. Use the STAR method for behavioral questions.\n"
            f"5. Keep the answer concise but comprehensive (150-300 words).\n\n"
            f"## Answer\n"
        )


__all__ = ["InterviewAgent"]
