# Reddit

Reddit punishes anything that smells like marketing. Rules that keep you safe:

- Read each subreddit's rules and recent top posts before posting. Many limit self-promotion to specific days or threads.
- Use an account with some history. A brand-new account posting a link gets filtered.
- Post as yourself, a person who built a thing, and ask for feedback.
- Don't post the same text to several subreddits on the same day; rewrite it for each audience.
- Reply to every comment.

## r/SideProject (self-promotion welcome)

**Title:** I built a free AI career assistant that reads your CV once, then preps you for interviews and finds matching jobs

> After my last job search, I was tired of pasting my CV into ChatGPT for every single task. So I built NovusOrbit.
>
> You upload your CV once, and every tool uses it:
>
> - **Interview prep:** questions generated from the job description you saved, with suggested answers using your real projects
> - **Job suggestions:** searches live Indeed and LinkedIn listings and ranks them against your CV, explaining each match
> - **Resume writer:** rewrite, shorten or expand any bullet in place, then export to PDF
> - **Job tracker:** interested → applied → interviewing → offered
>
> It's free and open source (AGPL). Stack is FastAPI + Next.js + LlamaIndex, running in one container on a small EC2 instance.
>
> Link: https://www.novusorbit.com/?utm_source=reddit&utm_medium=social&utm_campaign=sideproject
>
> I'd love brutal feedback, especially on whether the interview answers feel personal enough.

## r/opensource

**Title:** NovusOrbit: an open-source (AGPL) AI career assistant built on HKUDS/OpenTutor

> I forked HKUDS/OpenTutor, an AI learning assistant, and reworked it into a career tool: you upload your CV and the agents use retrieval over it for interview prep, resume editing and job matching (with MCP-based scrapers for Indeed/LinkedIn).
>
> Notable changes from upstream: per-user data isolation keyed on NextAuth sessions, the job and interview agents, the scrapers, and a single-container deployment with Terraform for EC2.
>
> Repo: https://github.com/zengtian006/NovusOrbit
> Hosted version (free): https://www.novusorbit.com/?utm_source=reddit&utm_medium=social&utm_campaign=opensource
>
> Contributions and issues welcome, especially more job board scrapers.

## r/webdev (Showoff Saturday only)

**Title:** [Showoff Saturday] AI career assistant: Next.js 16 + FastAPI + RAG over your CV

> Lead with the technical story: one agent per tool, retrieval over the user's CV, MCP servers for scraping, everything in one Docker image (Next.js standalone + FastAPI under supervisord) behind Caddy. Mention what was hard (e.g. per-user isolation in a codebase that started single-user, or scraping reliability). Link at the end.

## Career subreddits (r/cscareerquestions, r/resumes, r/jobs, r/interviews, r/jobsearchhacks)

**Don't post launch links here.** Self-promotion is banned or heavily restricted. Instead, over the following weeks:

1. Answer questions about interview prep, tailoring resumes and tracking applications, thoroughly and with no link.
2. When a guide on your site genuinely answers the question better than a comment can, link it at the end: "I wrote up the full process here: …". At most one link in every five or so comments.
3. If a subreddit has a weekly "tools" or "self-promotion" thread, post there.

The guides at `/guides/*` were written for exactly these questions.
