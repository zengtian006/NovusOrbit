# Development

## Prerequisites

- Python 3.11 (the production image uses 3.11; `pyproject.toml` allows 3.10 and later)
- Node.js 22 and npm
- An LLM and embedding provider. Any OpenAI-compatible API works, as do local servers such as Ollama.
- MongoDB, needed for sign-in. A free MongoDB Atlas cluster is fine.

## Setup

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt          # runtime deps + pytest, pre-commit, bandit, safety
npm install --prefix web --legacy-peer-deps

cp .env.example .env                         # backend: LLM, embedding, search, SMTP
cp web/.env.example web/.env                 # frontend: DATABASE_URL, NEXTAUTH_*, GOOGLE_*
(cd web && npx prisma generate)              # generate the Prisma client
```

The MCP job scrapers have their own requirements, which you only need to run `src/mcp/server.py` on its own: `pip install -r src/mcp/requirements.txt`. Job Suggestions imports the scrapers directly and doesn't need this.

`scripts/install_all.py` (or `.sh`) installs both stacks in one step.

## Running

**Both servers at once**, with combined logs and Ctrl+C stopping both:

```bash
python scripts/start_web.py
```

This writes `web/.env.local` with `NEXT_PUBLIC_API_BASE`. The file is git-ignored.

**Each server separately:**

```bash
python src/api/run_server.py                   # FastAPI on :8001 (with reload)
cd web && npm run dev -- -p 3782               # Next.js dev server on :3782
```

**In Docker**, the same image used in production:

```bash
docker compose up -d --build
docker compose logs -f
```

Use `docker-compose.dev.yml` to mount `src/` and `config/` read-only for faster backend iteration.

## Command-line tools

```bash
python -m src.knowledge.start_kb init <name> --docs <file.pdf>   # build a portfolio index from files
python -m src.mcp.server                                         # job-search MCP server (Indeed/LinkedIn)
cd web && npx tsx scripts/manage-users.ts list|promote|demote <email>   # user roles
```

## Checks

```bash
# Backend
python -m pytest tests/core -q             # fast unit tests (prompt loading/parity)
python -m pytest tests/services -q         # RAG pipeline tests (slow; call embedding/LLM APIs)
pre-commit run --all-files                 # ruff + ruff-format, prettier, YAML/JSON/TOML checks, detect-secrets

# Frontend (run in web/)
npx tsc --noEmit
npm run lint
npm run i18n:check                         # en/zh locale key parity + hard-coded string audit
npm run build
npm run audit                              # Playwright accessibility/UX audit (needs a running app)
```

## Conventions

- **Prompts:** each agent has prompt YAML files in `src/agents/<agent>/prompts/en/` and `zh/`. `scripts/audit_prompts.py` and `scripts/sync_prompts_from_en.py` keep the two languages in sync. `tests/core/test_prompt_parity.py` fails if they drift apart.
- **New UI strings** go in `web/locales/en/*.json` and `web/locales/zh/*.json`. Use `t("…")` instead of hard-coding text.
- **New pages:** add the route to `ALL_NAV_ITEMS` in `web/components/Sidebar.tsx` and to the default order in `web/context/GlobalContext.tsx`. If the page should require sign-in, add it to `config/page_settings.yaml` and to the matcher in `web/middleware.ts`.
- **Agent sampling parameters** belong in `config/agents.yaml`, not in code.
