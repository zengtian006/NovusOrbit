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
| `TTS_BINDING` / `TTS_MODEL` / `TTS_API_KEY` / `TTS_URL` / `TTS_VOICE` | optional | Resume Writer narration |
| `SMTP_SERVER` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `FEEDBACK_EMAIL_FROM` | optional | Feedback emails. If unset, feedback is only logged. |
| `RAG_PROVIDER` | optional | Default pipeline for CLI and back-end-initiated indexing. Production sets it to `llamaindex` (`templates/app.env.tftpl`). The code's built-in fallback is `raganything`, which isn't installed. The portfolio UI always sends a provider, defaulting to LlamaIndex. |
| `BACKEND_PORT` / `FRONTEND_PORT` | optional | Default `8001` and `3782` |
| `NEXT_PUBLIC_API_BASE` | optional | Backend URL that the browser calls. In production this is `https://www.<domain>`. |
| `DISABLE_SSL_VERIFY` | optional | Development only |

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
- **`paths.*`**: data directories (`data/user`, `data/portfolios`, per-feature output directories).
- **`tools.*`**: tool switches and defaults.
  - `rag_tool`
  - `run_code`: workspace and allowed roots
  - `web_search.enabled`: global on/off switch
  - `query_item`
- **`logging.*`**: level, file and console output, and which RAG library loggers to capture.
- **`question.*`** and **`research.*`**: pipeline settings for those learning tools, including research presets (`quick`, `medium`, `deep`, `auto`).
- **`solve.valid_tools`**: still read by a startup check in `src/api/main.py`. It's a leftover from a removed feature, so keep the key.

## `config/agents.yaml`

Per-agent `temperature` and `max_tokens`, for `research`, `question`, `guide`, `ideagen`, `resume_writer` and `narrator`. Agents read these through `get_agent_params(<name>)`.

## `config/page_settings.yaml`

Sets whether each page requires sign-in:

```yaml
pages:
  "/interview":
    requireSSO: true
```

The middleware re-reads this file every 30 seconds, so changes take effect without a rebuild. To protect a new route, also add it to `config.matcher` in `web/middleware.ts`, because the middleware only runs on listed paths.

Current defaults: Interview Prep, Job Suggestions and Resume Writer require sign-in. All other pages are public.

## Settings page

`/settings` changes the theme, language and sidebar order. The `/api/v1/settings` API saves them to `data/user/settings/interface.json`. That one file is shared by every user of the instance, not stored per user. The page also shows the active LLM, embedding and TTS configuration and can test connections (`/api/v1/config`).
