# Show HN

**When:** Tuesday to Thursday, 8 to 10am US Eastern. Submit from your own account; don't ask anyone to upvote (HN detects and penalizes voting rings). Reply to every comment, quickly and without getting defensive.

## Title (pick one, max 80 characters)

1. `Show HN: NovusOrbit – AI career assistant that reads your CV (open source)`
2. `Show HN: Interview prep and job matching grounded in your own CV`
3. `Show HN: I turned an open-source AI tutor into a job search assistant`

Option 1 is the safest. Option 3 tells a story and invites technical comments.

## URL

`https://www.novusorbit.com/?utm_source=hackernews&utm_medium=social&utm_campaign=launch`

(Or link the GitHub repo if you want to lead with the code. HN tends to like that for open-source projects.)

## First comment (post immediately after submitting)

> Hi HN, I'm Tim. I built NovusOrbit because job hunting meant pasting the same CV into ChatGPT over and over, and getting generic interview questions that had nothing to do with the job or my experience.
>
> You upload your CV (and any other docs) once. It's chunked and indexed, and every tool retrieves from it:
>
> - **Interview prep:** pick a saved job and a difficulty; it generates questions from the job description, plus suggested answers that cite your own projects.
> - **Job suggestions:** analyzes your portfolio, scrapes current listings from Indeed and LinkedIn, then ranks and explains each match, including the gaps.
> - **Resume writer:** select a bullet and rewrite, shorten or expand it in place; export to Markdown or PDF.
> - **Tracker:** a simple pipeline (interested → applied → interviewing → offered/rejected).
>
> Stack: FastAPI backend with one agent per tool, LlamaIndex for retrieval, MCP servers for the scrapers, Next.js 16 frontend, MongoDB for auth, all in one Docker container on a small EC2 instance. It's AGPL-3.0: https://github.com/zengtian006/NovusOrbit
>
> It started as a fork of HKUDS/OpenTutor, an open-source AI learning assistant, which is why the early history isn't mine. I stripped out the learning features and rebuilt it around careers: per-user data isolation, the job tools, and the scrapers.
>
> It's free; sign in with Google to use the AI tools. There are daily usage limits so a busy day doesn't bankrupt me.
>
> Things I'd love feedback on: are the interview answers actually useful or too generic? And for job matching, would you rather it search more boards, or go deeper on fewer listings?

## Questions to be ready for

- **"Why not just use ChatGPT?"** You can, but you re-explain your background every time. Here the CV is indexed once and every tool uses it; jobs, prep sessions and history are kept together.
- **"What happens to my CV?"** Stored in your account on the server, used only to personalize your results, and deletable from My Portfolio. Answer exactly and honestly; don't promise anything the code doesn't do (for example encryption at rest).
- **"Is scraping LinkedIn allowed?"** Be straightforward: it searches public listings at the time you ask, and doesn't log in or access private data.
- **"Which LLM?"** OpenAI by default; any OpenAI-compatible API works if you self-host.
- **"How do you pay for it?"** Out of pocket, with daily limits. Be honest about plans if you have any.
