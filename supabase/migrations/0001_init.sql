-- SAILS Platform — initial schema (Phase 0)
-- Entities per SAILS_Platform_Project_Plan.md §3. Multi-tenant isolation is
-- enforced here via RLS, not left to app code (section 8 non-negotiable).
--
-- Content tables (tracks, modules, exercises, library_items) mirror
-- /content/**/*.yml|md — git is the source of truth; a sync step (run after
-- `content:validate` passes in CI) upserts these tables. They are NOT
-- org-scoped: every org reads the same catalog. Client roles get read-only
-- access; only the service role (the sync job) may write to them.
--
-- Org-scoped tables (users, exercise_sessions, context_fields,
-- playbook_sections, artifacts, analytics_events) are isolated per-org via
-- RLS using the current_org_id() helper below.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Orgs & users
-- ---------------------------------------------------------------------------

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- App-level profile row, one per Supabase Auth user. Invite-only in v1
-- (plan §2 — Matt provisions orgs manually), so there is no public signup
-- path; rows are created by the on_auth_user_created trigger below, driven
-- by org_id/role/name set in raw_user_meta_data at invite time
-- (supabase.auth.admin.inviteUserByEmail with { data: { org_id, role, name } }).
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'member' check (role in ('owner_admin', 'member')),
  created_at timestamptz not null default now()
);

create index users_org_id_idx on public.users (org_id);

-- ---------------------------------------------------------------------------
-- Content catalog (mirrors /content — see note above)
-- ---------------------------------------------------------------------------

create table public.tracks (
  slug text primary key,
  title text not null,
  description text,
  audience_tags text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.modules (
  slug text primary key,
  title text not null,
  track_slugs text[] not null default '{}', -- a module may be shared across tracks
  order_index int not null,
  updated_at timestamptz not null default now()
);

create table public.exercises (
  slug text primary key, -- immutable once shipped (Exercise Schema §3) — sessions reference this, not a surrogate id
  title text not null,
  module_slug text not null references public.modules (slug),
  tracks text[] not null default '{}',
  intent text not null check (intent in ('training', 'development')),
  schema_version int not null,
  time_estimate text,
  reads text[] not null default '{}',
  requires text[] not null default '{}',
  writes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.library_items (
  slug text primary key,
  category text not null,
  track_tags text[] not null default '{}',
  body text not null, -- MDX
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Exercise sessions
-- ---------------------------------------------------------------------------

create table public.exercise_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  exercise_slug text not null references public.exercises (slug),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index exercise_sessions_org_id_idx on public.exercise_sessions (org_id);
create index exercise_sessions_exercise_slug_idx on public.exercise_sessions (exercise_slug);

-- ---------------------------------------------------------------------------
-- Context layer — append-only; "latest value wins, history retained"
-- (plan §3/§4). Never UPDATE a row here; INSERT a new one. Manual edits from
-- the Profile page use source = 'manual' with source_exercise_session_id
-- null, per Exercise Schema §5 — staleness propagation treats both sources
-- identically.
-- ---------------------------------------------------------------------------

create table public.context_fields (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  key text not null, -- namespaced path, e.g. 'personas.personas[0].title' — see Context Namespace Dictionary v1
  value jsonb not null,
  source text not null default 'exercise' check (source in ('exercise', 'manual')),
  source_exercise_session_id uuid references public.exercise_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index context_fields_org_id_key_idx on public.context_fields (org_id, key, created_at desc);

-- Latest value per (org, key) — the read path the app and prompt-templating
-- should use; never query context_fields directly for "current" values.
create view public.context_fields_latest as
select distinct on (org_id, key)
  id, org_id, key, value, source, source_exercise_session_id, created_at
from public.context_fields
order by org_id, key, created_at desc;

-- ---------------------------------------------------------------------------
-- Playbook
-- ---------------------------------------------------------------------------

create table public.playbook_sections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  section_slug text not null, -- e.g. 'pain-tree-and-cost-of-inaction'
  status text not null default 'empty' check (status in ('empty', 'draft', 'approved', 'stale')),
  current_content jsonb,
  generated_from jsonb not null default '[]'::jsonb, -- [{ key, context_field_id }] — the exact versions this was generated from
  updated_at timestamptz not null default now(),
  unique (org_id, section_slug)
);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  type text not null check (type in ('playbook_export', 'worksheet_output', 'sequence', 'script')),
  file_ref text not null, -- Supabase Storage path
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Analytics (plan §8: "simple event table... enough to see where users stall")
-- ---------------------------------------------------------------------------

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  event_type text not null, -- e.g. 'exercise_started', 'exercise_completed', 'section_generated', 'export_created'
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_org_id_idx on public.analytics_events (org_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- security definer so the policy checks below can look up the caller's
-- org_id without recursing into the RLS-protected `users` table.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.users where id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, org_id, email, name, role)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'org_id')::uuid,
    new.email,
    new.raw_user_meta_data ->> 'name',
    coalesce(new.raw_user_meta_data ->> 'role', 'member')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.orgs enable row level security;
alter table public.users enable row level security;
alter table public.tracks enable row level security;
alter table public.modules enable row level security;
alter table public.exercises enable row level security;
alter table public.library_items enable row level security;
alter table public.exercise_sessions enable row level security;
alter table public.context_fields enable row level security;
alter table public.playbook_sections enable row level security;
alter table public.artifacts enable row level security;
alter table public.analytics_events enable row level security;

-- Orgs: members can see their own org. No client insert/update/delete —
-- org provisioning is a service-role-only admin action (plan §2).
create policy orgs_select_own on public.orgs
  for select using (id = public.current_org_id());

-- Users: org-wide visibility (small teams, shared context per plan §2),
-- but only the owning user may update their own profile row.
create policy users_select_same_org on public.users
  for select using (org_id = public.current_org_id());

create policy users_update_self on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Content catalog: readable by any authenticated user, writable only by
-- the service role (the content-sync job) — no policy is granted for
-- insert/update/delete under the authenticated/anon roles.
create policy tracks_select_all on public.tracks for select using (true);
create policy modules_select_all on public.modules for select using (true);
create policy exercises_select_all on public.exercises for select using (true);
create policy library_items_select_all on public.library_items for select using (true);

-- Org-scoped application data: full CRUD within the caller's own org.
create policy exercise_sessions_org_isolation on public.exercise_sessions
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- context_fields is append-only from the client's perspective: select/insert
-- only, no update/delete policy — history is never mutated (see note above).
create policy context_fields_select on public.context_fields
  for select using (org_id = public.current_org_id());

create policy context_fields_insert on public.context_fields
  for insert with check (org_id = public.current_org_id());

create policy playbook_sections_org_isolation on public.playbook_sections
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy artifacts_org_isolation on public.artifacts
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy analytics_events_org_isolation on public.analytics_events
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
