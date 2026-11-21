<div align="center">

<img src="assets/logo-ver2.png" alt="NovusOrbit logo" width="120">

# NovusOrbit

**AI career assistant: build a portfolio from your CV, track jobs you like, find new ones, and prepare for interviews.**

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square)](LICENSE)

[Live site](https://www.novusorbit.com) · [Architecture](docs/architecture.md) · [Development](docs/development.md) · [Configuration](docs/configuration.md) · [Deployment](docs/deployment.md) · [Authentication](docs/authentication.md)

</div>

---

## Features

The sidebar has two groups. Users can reorder items by dragging them.

**Essential tools**

| Page | Route | What it does |
|---|---|---|
| Home | `/` | Chat assistant that can pull context from your portfolio (RAG) and the web |
| My Portfolio | `/portfolio` | Upload a CV and other documents. They're indexed so every other tool can personalize its output. |
| Interested Jobs | `/jobs` | Job boards for saving listings and tracking status (interested → applied → interviewing → offered/rejected) |
| History | `/history` | Past chat sessions, interview prep sessions and job-suggestion runs |

**Advanced tools**

| Page | Route | What it does |
|---|---|---|
| Interview Prep | `/interview` | Generates interview questions for a saved job at a chosen difficulty, plus personalized answers drawn from your portfolio |
| Job Suggestions | `/job-suggest` | Analyzes your portfolio, scrapes real listings from Indeed and LinkedIn, then ranks and explains the matches |
| Resume Writer | `/resume-writer` | AI editor for rewriting and marking up resume text, with Markdown/PDF export and optional TTS narration |

Other platform features:
- Google sign-in, with per-page sign-in requirements set in `config/page_settings.yaml`
- Admin pages for user roles and usage analytics
- Send Feedback form (emails the team over SMTP)
- English and Chinese UI
- Light and dark themes

## Architecture at a glance

```
Browser ──HTTPS──▶ Caddy (TLS, routing)
                    ├─ /api/v1/*, /api/outputs/*, /docs ─▶ FastAPI backend  :8001
                    └─ everything else (incl. /api/auth) ─▶ Next.js frontend :3782
                                                              │
FastAPI ─▶ agents (interview, job_suggest, resume_writer, …)  │ NextAuth + Prisma
        ─▶ services: LLM · embeddings · RAG (LlamaIndex/LightRAG) · web search
        ─▶ MCP scrapers (Indeed, LinkedIn)                    ▼
        ─▶ files under data/ (portfolios, jobs, sessions)   MongoDB (users, sessions, analytics)
```

Both servers run in a single Docker container under supervisord. Production runs that container on one EC2 instance managed by Terraform. See [docs/architecture.md](docs/architecture.md) for details.

## Quick start (local)

Prerequisites: Python 3.11, Node.js 22, and an OpenAI-compatible LLM API key. A MongoDB database is also needed for sign-in; a free Atlas cluster works.

```bash
# 1. Install dependencies
python -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt
npm install --prefix web --legacy-peer-deps

# 2. Configure
cp .env.example .env              # LLM / embedding / search keys
cp web/.env.example web/.env      # DATABASE_URL, NEXTAUTH_SECRET, Google OAuth
(cd web && npx prisma generate)

# 3. Run both servers
python scripts/start_web.py
```

Open http://localhost:3782. The API docs are at http://localhost:8001/docs.

To run each server on its own, see [docs/development.md](docs/development.md).

### With Docker

```bash
docker compose up -d --build      # reads .env, serves on :3782 and :8001
```

## Project layout

```
src/
  api/            FastAPI app (main.py) and routers, one per feature
  agents/         LLM agents: chat, interview, job_suggest, resume_writer
  services/       llm, embedding, rag, search, prompt, config, tts
  knowledge/      Portfolio (knowledge base) creation and indexing
  mcp/            MCP server + Indeed/LinkedIn scrapers used by Job Suggestions
  tools/          RAG search and web search tools used by agents
  logging/        Structured logging and LLM usage stats
web/              Next.js 16 app (App Router), NextAuth, Prisma schema, i18n locales
config/           main.yaml, agents.yaml, page_settings.yaml
scripts/          start_web.py (local runner), install helpers, migrations, prompt audits
terraform-ec2/    AWS infrastructure (EC2, Elastic IP, Route53, ECR, Secrets Manager) and deploy.sh
tests/            pytest suites (prompts, RAG pipelines)
data/             Runtime data (portfolios, user data). Not baked into the image.
```

## Deploying

```bash
cd terraform-ec2
./deploy.sh -s        # build image → push to ECR → restart the container over SSM
```

For first-time setup, secrets and operations, see [docs/deployment.md](docs/deployment.md).

## License

[AGPL-3.0](LICENSE)
