# Configuration

Configuration comes from three places:
- **Environment variables** for secrets and providers
- **`config/*.yaml`** for behavior
- **The Settings page** (`/settings`) for UI preferences

## Backend environment (`.env`)

The template is `.env.example`. In Docker, the whole file is passed to the container with `env_file`.

| Variable | Required | Description |
|---|---|---|
| `LLM_BINDING` | yes | `openai`, `azure_openai`, `anthropic`, `deepseek`, `openrouter`, `groq`, `together`, `mistral`, `ollama`, `lm_studio`, `vllm`, `llama_cpp` |
| `LLM_MODEL` | yes | For example `gpt-4o` |
| `LLM_API_KEY` | yes | Provider API key |
| `LLM_HOST` | yes | API base URL, for example `https://api.openai.com/v1` |
| `LLM_API_VERSION` | Azure only | |
| `EMBEDDING_BINDING` / `_MODEL` / `_API_KEY` / `_HOST` | yes | Embedding provider for portfolio indexing (`openai`, `azure_openai`, `jina`, `cohere`, `ollama`, …) |
| `EMBEDDING_DIMENSION` | yes | Must match the model, for example `1536` for `text-embedding-3-small` |
| `SEARCH_PROVIDER` / `SEARCH_API_KEY` | optional | Web search: `perplexity`, `tavily`, `serper`, `jina`, `exa` |
| `JSEARCH_API_KEY` | recommended | RapidAPI key for [JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch), the live job source for Job Suggestions (full descriptions, apply links). Without it, Job Suggestions falls back to scraping Indeed and LinkedIn. Identical searches are cached for `JSEARCH_CACHE_TTL` seconds (default 3600). In production set `jsearch_api_key` in `terraform.tfvars`. |
| `TTS_BINDING` / `TTS_MODEL` / `TTS_API_KEY` / `TTS_URL` / `TTS_VOICE` | optional | Resume Writer narration |
| `SMTP_SERVER` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `FEEDBACK_EMAIL_FROM` / `FEEDBACK_EMAIL_TO` | optional | Feedback emails (Gmail needs an App Password). Every submission is also saved to `data/user/feedback.jsonl`, so nothing is lost if SMTP is unset or fails. |
| `RAG_PROVIDER` | optional | Default pipeline for CLI and back-end-initiated indexing. Production sets it to `llamaindex` (`templates/app.env.tftpl`). The code's built-in fallback is `raganything`, which isn't installed. The portfolio UI always sends a provider, defaulting to LlamaIndex. |
| `BACKEND_PORT` / `FRONTEND_PORT` | optional | Default `8001` and `3782` |
| `NEXT_PUBLIC_API_BASE` | optional | Backend URL that the browser calls. In production this is `https://www.<domain>`. |
| `NEXT_PUBLIC_SITE_URL` | optional | Public site origin used for canonical URLs, `robots.txt`, the sitemap and social cards. Read at build time. Defaults to `https://www.novusorbit.com`, so set it when building for a different domain. |
| `DISABLE_SSL_VERIFY` | optional | Development only |
| `RATE_LIMIT_ENABLED` / `RATE_LIMIT_MULTIPLIER` / `RATE_LIMIT_GLOBAL_DAILY` | optional | Usage limits on AI endpoints (`src/services/rate_limit.py`). On by default. The multiplier scales every per-user daily limit (for example `2` doubles them). The global value caps limited requests across all users per 24 hours, default `3000`; `0` turns the cap off. Counters are in memory and reset on restart. |
| `MIGRATE_LEGACY_DATA` | optional | `1` (the Docker image default) moves pre-per-user shared data into the first admin's account on startup, once. Leave it unset for local development so the repo's `data/` folder isn't touched. |
| `NOVUS_USER_ID` | optional | For the portfolio CLI (`src.knowledge.start_kb`): which user's portfolios to manage (MongoDB user id). Default: `anonymous`. |

## Frontend and auth environment (`web/.env` locally, root `.env` in Docker)

| Variable | Description |
|---|---|
| `DATABASE_URL` | MongoDB connection string, for example `mongodb+srv://…/novusorbit` |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public base URL, for example `http://localhost:3782` or `https://www.novusorbit.com` |
| `AUTH_TRUST_HOST` | `true` when running behind a proxy (Caddy) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client. See [authentication.md](authentication.md). |

`NEXT_PUBLIC_*` values are inlined at build time. The image is built with `http://localhost:8001`, and the container start script rewrites that value in the built files to `$NEXT_PUBLIC_API_BASE` on startup.

## `config/main.yaml`

- **`system.language`**: `en` or `zh`. Sets the prompt language.
- **`paths.*`**: `user_data_dir` (`data/user`), `portfolios_dir` (`data/portfolios`), `user_log_dir`. Per-user data lives in `data/user/accounts/<uid>/` and `data/portfolios/users/<uid>/` (see [architecture.md](architecture.md#per-user-data)).
- **`tools.*`**: tool switches and defaults.
  - `rag_tool.kb_base_dir`: where portfolios live
  - `web_search.enabled`: global on/off switch for web search
- **`logging.*`**: level, file and console output, and which RAG library loggers to capture.

## `config/agents.yaml`

Per-module `temperature` and `max_tokens` for `resume_writer` and `narrator`. Agents read these through `get_agent_params(<module>)`. Modules without an entry (`chat`, `interview`, `job_suggest`) use the defaults: temperature 0.5 and 4096 max tokens.

## `config/page_settings.yaml`

Sets whether each page requires sign-in:

```yaml
pages:
  "/interview":
    requireSSO: true
```

The middleware re-reads this file every 30 seconds, so changes take effect without a rebuild. To protect a new route, also add it to `config.matcher` in `web/middleware.ts`, because the middleware only runs on listed paths.

Currently Interview Prep, Job Suggestions, Resume Writer and Settings require sign-in. The other pages are public.

## Settings page

`/settings` changes the theme, language and sidebar order. The `/api/v1/settings` API saves them to `data/user/settings/interface.json`. That one file is shared by every user of the instance, not stored per user. The page also shows the active LLM, embedding and TTS configuration and can test connections (`/api/v1/config`).
