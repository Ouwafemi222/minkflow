# Connecting Supabase

Minkflow already contains the full Supabase integration (auth, schema, RLS, signup trigger). Connecting a project is
configuration only. Do staging first; repeat for production with its own project.

Sign-in is passwordless: the user enters an email, receives one email containing **both** a link and a 6-digit code,
and either clicks the link or types the code. New emails get an account, a workspace and 60 trial credits automatically.

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

**Authentication → Sign In / Providers → Email**: enabled. Leave "Confirm email" on.

**Authentication → Emails → Templates**: replace the body of **Magic Link** and **Confirm signup** with the
following so the link works on any device and the code is included:

```html
<h2>Your Minkflow sign-in</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/studio">Sign in to Minkflow</a></p>
<p>Or enter this code: <strong>{{ .Token }}</strong></p>
<p>This link and code expire in one hour. If you did not request this, ignore this email.</p>
```

Without this change the default templates still work, but the link only succeeds in the same browser that requested
it, and no code is shown.

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
