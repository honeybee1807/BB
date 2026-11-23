# Bargain Breaks: rules for Claude Code

Halal-conscious holiday accommodation inquiry website plus an admin dashboard.
This repository is **public**. Nothing secret or private may ever be committed.

## Scope: Phase 1 only

In scope: public site; Region > Estate > Property listings with a halal flag; structured
inquiry form (emailed and stored as a tracked lead); admin dashboard (properties, photos,
availability calendar and grid, inquiries, journal, team, settings/page SEO); owner and
team-member roles; SEO.

**Out of scope. Do not build:** live or instant booking, real-time calendar sync, CRM
features, mailing list or newsletter tooling, owner onboarding (no "Owners" menu item,
"Owner Onboarding" panel or "New Owner Requests" stat), automated lead escalation or
reminders, saved properties, hearts or wishlists, payments.

If something seems missing or extra, ask. Never invent tables, columns, routes or features.

## Stack (fixed, do not substitute)

- Next.js App Router (Next 16, `src/proxy.ts` for session refresh), React, TypeScript `strict`.
- Tailwind CSS v4: tokens live in `src/app/globals.css` (`@theme`). Use token classes
  (`bg-navy`, `text-teal`, `rounded-card`), never raw hex in components.
- Supabase (Postgres, Auth, Storage) via `@supabase/supabase-js` and `@supabase/ssr`.
- zod, react-hook-form + @hookform/resolvers, Resend, sharp, Cloudflare Turnstile.
- Vitest (unit), Playwright + @axe-core/playwright (e2e), pgTAP via `supabase test db`.
- Also approved: react-markdown (never with rehype-raw), server-only, lucide-react, Radix
  primitives only where accessibility needs them. **Any other library: ask first.**

## Languages

TypeScript for app code (no .js/.jsx/.mjs except tool-generated config), SQL for
migrations and tests, Tailwind classes plus the one global stylesheet, YAML only for
GitHub Actions, JSON for config, Markdown for docs. No Python, PHP, shell or PowerShell
scripts, no ORM, no Express, no Pages Router, no CSS-in-JS, no UI kits.

## Security rules (non-negotiable)

- `SUPABASE_SERVICE_ROLE_KEY` is read **only** in `src/lib/supabase/admin.ts`, which starts
  with `import "server-only"`. ESLint enforces this. Allowed uses: public inquiry insert,
  rate limits, audit writes, storage writes, user invitations, owner-only purges.
- Admin reads and writes use the signed-in user's session so RLS applies.
- Every table: RLS enabled in the same migration, explicit per-role GRANTs, policies using
  `(select public.is_admin())` / `(select public.is_owner())`, and pgTAP tests as anon,
  team member and owner in `supabase/tests`.
- Anon has no grants on `inquiries` or `availability_blocks`. Blocked dates reach the public
  only through the `get_blocked_dates` SECURITY DEFINER function.
- Soft delete (`deleted_at`) on properties, blog_posts and inquiries is owner-only, enforced
  by trigger and policy; `authenticated` has no DELETE grant on those tables.
- Handler pattern for every admin route or server action: (1) assert same origin,
  (2) require an active admin, (3) zod-validate (reject unknown keys), (4) user-session
  client, (5) audit row for important actions. Shared schemas live in `src/lib/validation`.
- Never trust a user id or role sent from the browser. Read it from the session.
- Never log guest personal data (`console.log` is banned by lint). Generic errors to users.
- Render guest text as plain text. No `dangerouslySetInnerHTML` except JSON-LD.
- Photos never pass through API routes: use a signed upload URL to `uploads-tmp`, then
  server-side processing.
- Never print, echo or paste secret values. Run `npm run secrets:scan` before every push.
  If a secret is ever committed: stop and tell the user. Do not rewrite history.

## Database workflow

- Every change is a new file in `supabase/migrations`. Never edit an applied migration.
- Work only against the local stack (`npm run db:start`). Never touch the production
  project, run remote migrations, or deploy without explicit permission.
- Regenerate types after schema changes: `npm run db:types` (`src/types/database.ts`).
  Never hand-write table types.

## Working rules

- Platform is Windows. Use npm scripts and plain commands; create no .sh/.ps1/.py files.
- `docs/` (guide and mockups) is local only and gitignored. Never commit it.
- Do not overwrite or remove README.md without asking.
- Before saying a task is done: `npm run check` (typecheck, lint, unit tests), plus
  `npm run db:test` and `npm run test:api` (local stack) when SQL changed, and
  `npm run test:e2e` when routes or pages changed. Show the results.
- Commit after each working step with a clear message. Build phase by phase and stop for
  review at the end of each phase.
