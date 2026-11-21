# Authentication and admin

## How sign-in works

- **NextAuth v5** (`web/lib/auth.ts`) with **Google** as the only provider.
- **Prisma adapter on MongoDB** (`web/prisma/schema.prisma`). Users, OAuth accounts and sessions are stored in the database.
- **Database sessions** (`session.strategy: "database"`). The session callback adds `user.id` and `user.role` (`USER` or `ADMIN`) to the session.
- **Custom pages:** `/auth/signin` and `/auth/error`. After signing in, users land on `callbackUrl` if one was given, otherwise on `/chat`.

```
Browser → /auth/signin → Google consent → /api/auth/callback/google
        → NextAuth creates/links User + Account in MongoDB, creates Session
        → session cookie → middleware lets protected pages through
```

### Which pages require sign-in

`web/middleware.ts` runs on the paths in its `matcher` and checks `config/page_settings.yaml`. For pages marked `requireSSO: true`, signed-out users are redirected to `/auth/signin?callbackUrl=<page>`. See [configuration.md](configuration.md#configpage_settingsyaml).

Signing in on the frontend doesn't protect the FastAPI endpoints (`/api/v1/*`). The backend doesn't check sessions.

## Google OAuth setup

1. In Google Cloud Console, go to **APIs & Services → OAuth consent screen**. Configure it as External, with app name, support email and the `email`/`profile` scopes.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
3. Set **Authorized JavaScript origins** to:
   - `http://localhost:3782`
   - `https://www.novusorbit.com`
4. Set **Authorized redirect URIs** to the following. They must match exactly:
   - `http://localhost:3782/api/auth/callback/google`
   - `https://www.novusorbit.com/api/auth/callback/google`
5. Put the client ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Locally they go in `web/.env`. In production they go in `terraform.tfvars`, then on the host's `.env` (see [deployment.md](deployment.md#changing-secrets-or-environment-variables)).
6. Set `NEXTAUTH_URL` to the public URL, generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`, and set `AUTH_TRUST_HOST=true` when running behind Caddy.

While the consent screen is in **Testing** mode, only the test users listed there can sign in. Publish the app to open sign-in to everyone.

## Roles and admin pages

New users are created with role `USER`. To promote someone:

```bash
cd web
npx tsx scripts/manage-users.ts list
npx tsx scripts/manage-users.ts promote someone@example.com
npx tsx scripts/manage-users.ts demote someone@example.com
```

This needs `DATABASE_URL` set to the target database. Admins see two extra sidebar links:

| Page | API | Purpose |
|---|---|---|
| `/admin/users` | `GET/PATCH /api/admin/users` | List users and change roles |
| `/admin/analytics` | `GET /api/analytics/dashboard` | Feature usage from the `UserAnalytics` collection |

Both APIs return 403 unless `session.user.role === "ADMIN"`. Signed-in users' navigation clicks are recorded through `POST /api/analytics/track`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `redirect_uri_mismatch` from Google | The redirect URI in Google Console doesn't exactly match `<NEXTAUTH_URL>/api/auth/callback/google`. Check www vs. apex and http vs. https. |
| `/auth/error?error=Configuration` | `NEXTAUTH_SECRET` is missing or `DATABASE_URL` can't be reached |
| Sign-in works locally but not in prod | `NEXTAUTH_URL` or `AUTH_TRUST_HOST` isn't set on the host `.env`, or Google credentials were added to tfvars but not to the host `.env` |
| Prisma "query engine" error in Docker | The engine is missing from the image. `binaryTargets` must include `debian-openssl-3.0.x`, and the Dockerfile copies `node_modules/.prisma`. |
