# Supabase setup

Project is live: `ypwygoykzbjnsokbjwwc` (org `sailsadvisory`). Migration
`0001_init.sql` has been applied via `supabase db push --db-url ...` (the
npx-installable CLI, no Docker/login needed for a straight push) and RLS was
verified against the real database, not just read for correctness:

- Anon key against an org-scoped table (`orgs`) → `200 []` (isolated, not an error)
- Anon key against public content (`tracks`) → `200 []` (readable, just empty pre-sync)
- Anon key attempting to insert `context_fields` for an arbitrary `org_id` → `401`, `42501 row-level security policy violation`

## If you need to re-run or add a migration

```bash
npx supabase db push --dry-run --db-url "postgresql://postgres.ypwygoykzbjnsokbjwwc:<PASSWORD>@aws-0-ca-central-1.pooler.supabase.com:5432/postgres"
```
Drop `--dry-run` to actually apply. Use the **session pooler** host (IPv4) shown above, not the direct `db.*.supabase.co` host — that one defaults to IPv6, which most dev machines/CI runners can't reach. Percent-encode the password (`@` → `%40`, `?` → `%3F`, `/` → `%2F`, etc.) — get the exact connection string from Dashboard → Database → Connect → Direct → Session pooler if the password has other special characters.

## Still to do (Phase 1)

1. In Auth settings, enable magic-link (email OTP) sign-in; disable public
   signup (invite-only per plan §2).
2. Provision the first org + user via
   `supabase.auth.admin.inviteUserByEmail(email, { data: { org_id, role: 'owner_admin', name } })`
   — the `on_auth_user_created` trigger creates the matching `public.users`
   row from that metadata. The admin panel (Phase 1) wraps this; there's no
   UI for it yet.
3. Content sync job: `tracks`, `modules`, `exercises`, `library_items` mirror
   `/content` but nothing writes to them yet — the tables exist so the
   schema is provable, but stay empty until that job ships.
