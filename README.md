# Bargain Breaks

Website and admin dashboard for Bargain Breaks, a halal-conscious holiday accommodation business in South Africa. Guests browse regions, estates and properties and send an inquiry. The team handles inquiries, availability, properties and the journal from the admin.

Built with Next.js, TypeScript, Tailwind CSS and Supabase.

## Running it locally

You need Node 24 and Docker Desktop.

```
npm install
npm run db:start
```

Copy `.env.example` to `.env.local` and fill it in. `npx supabase status` shows the local Supabase URL and keys. Then:

```
npm run db:reset
npm run dev
```

The site runs on http://localhost:3000 and the admin sign-in is at http://localhost:3000/admin/login.

## Tests

```
npm run check      # type check, lint and unit tests
npm run db:test    # database tests (local Supabase must be running)
npm run test:api   # REST and storage tests against local Supabase
npm run test:e2e   # browser tests (run npx playwright install chromium once first)
```

## Environment variables

See `.env.example`.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `INQUIRY_NOTIFY_TO`
- `SECURITY_ALERT_TO`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SHOW_PUBLIC_AVAILABILITY`
- `IP_HASH_SECRET` (server only)
- `HEALTH_TOKEN`

Never commit `.env.local` or any real key.
