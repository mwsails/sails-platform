-- ---------------------------------------------------------------------------
-- Per-rep dimensioning on the context store (plan: multi-rep is per-rep, not
-- a shared org journey). `user_id` is nullable and additive: org-scoped
-- fields (company.*, icp.*, personas.*, messaging.*, ...) keep writing with
-- user_id = null and behave exactly as before; only fields that are
-- genuinely per-person (respondent.*, future progress.*/threads.*) get a
-- real user_id. Postgres's DISTINCT ON treats NULL as a valid, stable
-- grouping value, so context_fields_latest doesn't need a coalesce hack —
-- org-scoped rows dedupe per (org_id, null, key) exactly like before,
-- user-scoped rows dedupe per (org_id, user_id, key) alongside them.
-- ---------------------------------------------------------------------------

alter table public.context_fields
  add column user_id uuid references public.users (id) on delete cascade;

create index context_fields_org_user_key_idx
  on public.context_fields (org_id, user_id, key, created_at desc);

drop view public.context_fields_latest;

create view public.context_fields_latest as
select distinct on (org_id, user_id, key)
  id, org_id, user_id, key, value, source, source_exercise_session_id, created_at
from public.context_fields
order by org_id, user_id, key, created_at desc;

-- Replace the org-only select/insert policies with a version that also
-- respects per-user ownership. Org-scoped rows (user_id is null) behave
-- exactly as before — any org member can read/write them. User-scoped rows
-- are visible/writable only to that user; there is no admin-override policy
-- yet (whether an owner_admin can see a rep's rows is still an open product
-- question — see repo-open Q7/permissions matrix — so this defaults to the
-- safe, least-privilege reading rather than guessing at a manager exception).
drop policy context_fields_select on public.context_fields;
drop policy context_fields_insert on public.context_fields;

create policy context_fields_select on public.context_fields
  for select using (
    org_id = public.current_org_id()
    and (user_id is null or user_id = auth.uid())
  );

create policy context_fields_insert on public.context_fields
  for insert with check (
    org_id = public.current_org_id()
    and (user_id is null or user_id = auth.uid())
  );

-- exercise_sessions: was a single "for all" org-isolation policy, which let
-- any org member read AND write any other member's in-progress session —
-- the root cause (at the RLS layer, not just the app-query layer) of two
-- reps silently sharing/clobbering one session for the same exercise.
-- Select stays org-scoped for now (same open permissions-matrix question as
-- above); insert/update are tightened to the owning user.
drop policy exercise_sessions_org_isolation on public.exercise_sessions;

create policy exercise_sessions_select on public.exercise_sessions
  for select using (org_id = public.current_org_id());

create policy exercise_sessions_insert on public.exercise_sessions
  for insert with check (
    org_id = public.current_org_id() and user_id = auth.uid()
  );

create policy exercise_sessions_update on public.exercise_sessions
  for update using (
    org_id = public.current_org_id() and user_id = auth.uid()
  ) with check (
    org_id = public.current_org_id() and user_id = auth.uid()
  );
