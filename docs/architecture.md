# Architecture

## Runtime topology

```
                    ┌──────────────── EC2 (t3.small, Amazon Linux 2023) ────────────────┐
Browser ──HTTPS──▶  │ Caddy :443  (Let's Encrypt TLS, apex → www redirect)              │
                    │   /api/auth/*, /api/admin/*, /api/analytics/*  ─▶ :3782           │
                    │   /api/v1/*, /api/outputs/*, /docs, /openapi.json ─▶ :8001        │
                    │   everything else ─▶ :3782                                        │
                    │                                                                   │
                    │ Docker container "novusorbit" (supervisord)                       │
                    │   ├─ backend:  uvicorn src.api.main:app        :8001              │
                    │   └─ frontend: node server.js (Next standalone) :3782             │
                    │ volumes: /opt/novusorbit/data/{user,portfolios}                    │
                    └───────────────────────────────────────────────────────────────────┘
                                 │                         │
                          LLM / embedding /          MongoDB Atlas
                          search provider APIs       (auth, sessions, analytics)
```

The browser calls the FastAPI backend directly for feature APIs; `NEXT_PUBLIC_API_BASE` is inlined into the frontend bundle. The browser calls Next.js only for pages and for the auth, admin and analytics route handlers.

## Backend (`src/`)

`src/api/main.py` mounts one router per feature under `/api/v1`:

| Prefix | Router | Purpose |
|---|---|---|
| `/api/v1/portfolio` | `knowledge.py` | Create/list/delete portfolios, upload files, indexing progress (WebSocket), linked folders |
| `/api/v1/jobs` | `jobs.py` | Job boards and job entries (CRUD, statistics) |
| `/api/v1/interview` | `interview.py` | Question and answer generation, saved sessions |
| `/api/v1/job-suggest` | `job_suggest.py` | Suggestions, per-job detail, JD scraping, saved sessions |
| `/api/v1/resume_writer` | `resume_writer.py` | Edit/automark, history, export, narration (TTS) |
| `/api/v1/chat` (WS) | `chat.py` | Home chat assistant, sessions |
| `/api/v1/settings`, `/config`, `/system` | | UI settings and page sign-in settings, provider config, health/status |
| `/api/feedback` | `feedback.py` | Sends feedback email over SMTP, or logs it if SMTP isn't set |
| `/api/outputs/*` | static | Files generated under `data/user/` |

### Agents (`src/agents/`)

Every agent extends `BaseAgent`, which provides an LLM client, prompt loading and logging. Prompts are YAML files under `<agent>/prompts/{en,zh}/` and are loaded by `services/prompt`. Sampling parameters (`temperature`, `max_tokens`) come from `config/agents.yaml`.

| Agent | Highlights |
|---|---|
| `interview` | Builds questions from a job description. Answers use RAG over the portfolio and fall back to web search. |
| `job_suggest` | Portfolio RAG → search queries → Indeed/LinkedIn scrape (`src/mcp/scrapers`) → LLM ranking and gap analysis |
| `resume_writer` | `edit_agent` (rewrite/automark) and `narrator_agent` (script + TTS) |
| `chat` | Multi-turn assistant with optional RAG and web search |

### Services (`src/services/`)

- **`llm`** — `factory.py` routes each call to `cloud_provider.py` (OpenAI-compatible and Anthropic APIs) or `local_provider.py` (Ollama, LM Studio, vLLM, llama.cpp). It adds retries (tenacity), error mapping and capability detection.
- **`embedding`** — adapters for OpenAI-compatible APIs, Jina, Cohere and Ollama.
- **`rag`** — pipelines built by `factory.py`. The portfolio UI offers **LlamaIndex** (default) and **LightRAG**. RAG-Anything pipelines exist but are disabled in the provider list.
- **`search`** — web search providers: Perplexity, Tavily, Serper, Jina, Exa and Baidu.
- **`config`** — loads `config/*.yaml` plus environment variables (`unified_config.py` and `loader.py`).
- **`prompt`**, **`tts`**, **`settings`**, **`setup`** (creates the data directories on first start).

## Frontend (`web/`)

- Next.js 16 App Router, React 19 and Tailwind. Built with `output: "standalone"`.
- **State:** `context/GlobalContext.tsx` holds cross-page state: the Home chat session, UI settings, theme, and sidebar order.
- **Auth:** NextAuth v5 with Google and the Prisma adapter on MongoDB (`lib/auth.ts`, `prisma/schema.prisma`). See [authentication.md](authentication.md).
- **Route protection:** `middleware.ts` reads `config/page_settings.yaml`, caches it for 30 seconds, and sends signed-out users to `/auth/signin` on pages marked `requireSSO: true`.
- **i18n:** i18next with `locales/{en,zh}/*.json`. Run `npm run i18n:check` to check that keys match across languages.
- **Route handlers:** `app/api/auth` (NextAuth), `app/api/admin/users`, `app/api/analytics/{track,dashboard}`, `app/api/feedback`.

## Data and persistence

| Data | Location | Notes |
|---|---|---|
| Portfolios (raw files + vector indexes) | `data/portfolios/<name>/` and `data/portfolios/kb_config.json` | Mounted volume in Docker |
| Job boards | `data/user/jobs/` | JSON files |
| Chat/interview/job-suggest sessions, resume writer history, settings, logs | `data/user/…` | JSON and Markdown files |
| Users, OAuth accounts, sessions, analytics | MongoDB (`DATABASE_URL`) | Managed by Prisma |


## Container image

The image is built in three stages (see the `Dockerfile`):

1. **frontend-builder** (`node:22-slim`): `npm ci`, `prisma generate`, `next build` (standalone output).
2. **python-base** (`python:3.11-slim` with build tools): installs `requirements.txt` and `supervisor`. It removes PyMuPDF's optional `onnxruntime` layout stack, which the code doesn't use.
3. **production** (`python:3.11-slim`): site-packages, the `node` binary, and the standalone Next server with static assets and the Prisma engine, plus `src/`, `config/` and `scripts/`.

The final image is about 1.1 GB.
