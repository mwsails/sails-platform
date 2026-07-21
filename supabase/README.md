# Supabase setup

This migration has been reviewed carefully but **not executed against a live
Postgres/Supabase instance** — no `psql`, `supabase` CLI, or Docker was
available in the environment that authored it. Treat first-run as the real
test, not a formality.

## First-time setup

1. Create the Supabase project (dashboard, or `supabase projects create`).
2. `supabase link --project-ref <ref>`
3. `supabase db push` — applies `migrations/0001_init.sql`.
4. In Auth settings, enable magic-link (email OTP) sign-in; disable public
   signup (invite-only per plan §2).
5. Provision the first org + user via `supabase.auth.admin.inviteUserByEmail(email, { data: { org_id, role: 'owner_admin', name } })` — the `on_auth_user_created` trigger creates the matching `public.users` row from that metadata. The admin panel (Phase 1) wraps this; there's no UI for it yet.
6. Copy the project URL + anon key + service role key into `.env.local` (see `.env.example`).

## Content sync

`tracks`, `modules`, `exercises`, `library_items` mirror `/content`. Nothing
syncs them automatically yet (that's a Phase 1 script, run with the service
role key after `npm run content:validate` passes) — for now the tables exist
so the schema is provable, but stay empty until that sync job ships.
