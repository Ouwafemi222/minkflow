# Connecting Supabase

Minkflow already contains the full Supabase integration (auth, schema, RLS, signup trigger). Connecting a project is
configuration only. Do staging first; repeat for production with its own project.

Sign-in options on `/login`:

- **Email + password** (Sign in / Create account tabs). New accounts confirm their email with a link or 6-digit code.
- **Continue with Google** — the button appears automatically once Google is enabled in Supabase (section 4b).
- **Forgot password?** — reset email (link or code) → `/auth/reset-password` to choose a new password.
- **Email me a sign-in code instead** — passwordless fallback.

Every new account gets a workspace and 60 trial credits automatically (database trigger), whichever method created it.

## 1. Create the project (dashboard)

1. supabase.com → New project → name `minkflow-staging`, region close to your users, generate a strong DB password
   and store it in your password manager.
2. Wait for it to finish provisioning.

## 2. Collect the values

| Value | Where in the dashboard | Env var | Secret? |
| --- | --- | --- | --- |
| Project URL | Project Settings → API (or Data API) | `NEXT_PUBLIC_SUPABASE_URL` | No |
| anon / publishable key | Project Settings → API Keys | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No (public by design) |
| Transaction pooler URI (port 6543) | Connect → Connection string → Transaction pooler | `DATABASE_URL` for web | **Yes** (contains DB password) |
| Session pooler URI (port 5432) | Connect → Connection string → Session pooler | `DATABASE_URL` for worker, `MIGRATION_DATABASE_URL` | **Yes** |

Replace `[YOUR-PASSWORD]` in the URIs with the DB password (URL-encode characters like `@`, `#`, `/`).
Dashboard labels move around; the values themselves are stable.

Put secrets straight into `.env.local` (git-ignored) or the Vercel/Railway dashboards — not into chat or commits.

## 3. Configure the repository

In the root `.env.local`:

```bash
APP_ENV=local                      # keep local while testing from your machine
AUTH_DRIVER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
MIGRATION_DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
DATABASE_SSL=require
ADMIN_EMAILS=you@yourdomain.com
```

Then:

```bash
pnpm db:migrate --dry-run   # shows the 2+ pending migrations, changes nothing
pnpm db:migrate             # applies supabase/migrations, recorded in supabase_migrations.schema_migrations
pnpm verify:supabase        # read-only checks; every line should say PASS
```

`pnpm verify:supabase` checks the connection and SSL, that every migration is applied, the signup trigger, that the
anonymous API role has no table access, that the server can act as a signed-in user under RLS (V-15), and that the
Auth API accepts the anon key with email sign-in enabled.

`DATABASE_SSL=require` encrypts the connection without checking the certificate chain. For full verification download
the root certificate (Database Settings → SSL Configuration), set `DATABASE_SSL=verify` and `DATABASE_CA_CERT` to its PEM text.

## 4. Auth settings (dashboard)

**Authentication → URL Configuration**

- Site URL: your `APP_BASE_URL` (e.g. `http://localhost:3000` while testing locally, the Vercel URL on staging).
- Redirect URLs: add `<APP_BASE_URL>/auth/callback` for every environment that signs in (local and staging can share a staging project).

**Authentication → Sign In / Providers → Email**: enabled. Leave "Confirm email" on. Set the minimum password
length to 8 (the form asks for 8; Supabase's default is 6).

**Authentication → Emails → Templates**: replace the bodies below so links work on any device and include a code.
Without this the default templates still work, but links only succeed in the browser that requested them and no
code is shown.

*Confirm signup* and *Magic Link* (same body for both):

```html
<h2>Your Minkflow sign-in</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/studio">Continue to Minkflow</a></p>
<p>Or enter this code: <strong>{{ .Token }}</strong></p>
<p>This link and code expire in one hour. If you did not request this, ignore this email.</p>
```

*Reset Password*:

```html
<h2>Reset your Minkflow password</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password">Choose a new password</a></p>
<p>Or enter this code: <strong>{{ .Token }}</strong></p>
<p>This link and code expire in one hour. If you did not request this, ignore this email.</p>
```

### 4b. Google sign-in (optional; the button stays hidden until this is done)

1. console.cloud.google.com → create (or pick) a project → **APIs & Services → OAuth consent screen**: app name
   Minkflow, your support email, audience External. Add scopes `openid`, `email`, `profile`.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type *Web application*.
   - Authorized JavaScript origins: `<APP_BASE_URL>` (e.g. `http://localhost:3000`).
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase shows this exact URL
     on its Google provider page).
3. Copy the **Client ID** and **Client secret** into Supabase → **Authentication → Sign In / Providers → Google**,
   enable it, save.
4. Within five minutes the "Continue with Google" button appears on `/login`. Google users land on
   `/auth/callback` and get the same workspace + 60 credits.

The client secret goes only into the Supabase dashboard; Minkflow itself never sees it.

### 4c. "Connect your YouTube" (optional; the button explains it is unavailable until this is done)

Reuses the same Google Cloud project and OAuth client as 4b.

1. **APIs & Services → Library** → enable **YouTube Data API v3**.
2. **OAuth consent screen → Data access / Scopes** → add `https://www.googleapis.com/auth/youtube.readonly`.
   While the app is in *Testing* status, add each tester's Google account under **Test users** (max 100). Public
   launch needs Google's verification of this sensitive scope (V-24).
3. **Credentials → your OAuth client → Authorized redirect URIs** → add `<APP_BASE_URL>/api/youtube/callback`
   (e.g. `http://localhost:3000/api/youtube/callback`), alongside the Supabase one from 4b.
4. In `.env.local` (and Vercel): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `TOKEN_ENCRYPTION_KEY`
   (`pnpm gen:secret`; keep it stable — changing it makes stored connections unusable until users reconnect).
5. Restart `pnpm dev:web`. Studio → sidebar **Connect your YouTube** → Account page → **Connect your YouTube**.

Refresh tokens are stored AES-256-GCM encrypted; the database never holds them in plain text and signed-in users
cannot read the column. Disconnecting deletes the row and revokes the token at Google.

**Email delivery (required before inviting anyone else):** Supabase's built-in sender is only for testing — it is
heavily rate limited and only delivers to members of your Supabase organisation (V-23). Set up custom SMTP under
Authentication → Emails → SMTP Settings (Resend: host `smtp.resend.com`, port 465, user `resend`, password = Resend
API key, sender on a domain you have verified in Resend).

**Recommended hardening:** Minkflow never uses Supabase's auto-generated REST API (all data goes through the app
server). Under Project Settings → Data API you can disable it, or remove `public` from the exposed schemas. RLS and
the revoked grants already protect the data either way; this just removes surface.

## 5. Try it

```bash
pnpm dev:worker   # in one terminal (uses the same DATABASE_URL)
pnpm dev:web      # in another
```

Open `http://localhost:3000/login`, enter your email, click the link or type the code. You should land in the studio
with 60 credits. Visit `/studio/admin` with an `ADMIN_EMAILS` address to grant beta credits.

## 6. Hosted environments

- **Vercel (web):** the variables above with `APP_ENV=staging`, `APP_BASE_URL=<vercel url>`, `DATABASE_URL` = transaction pooler (6543), `DATABASE_SSL=require`.
- **Railway (worker):** `DATABASE_URL` = session pooler (5432), `DATABASE_SSL=require`, plus the worker variables in `docs/SETUP-ACCOUNTS.md`.
- Add the hosted `<APP_BASE_URL>/auth/callback` to Supabase redirect URLs and set the Site URL to the hosted URL.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `self-signed certificate in certificate chain` | `DATABASE_SSL=verify` without the right CA, or `sslmode=verify-full` in the URL — use `DATABASE_SSL=require` |
| `password authentication failed` | wrong DB password, or special characters not URL-encoded |
| `/login?error=link` after clicking the email | link expired/used, opened in another browser with default templates, or redirect URL not allow-listed |
| No email arrives | built-in sender limits/team-only delivery — configure SMTP |
| `Invalid web environment` on start | a required variable is missing; the message names it |
