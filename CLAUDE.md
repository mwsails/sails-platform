# CLAUDE.md — SAILS Platform

Handoff context for anyone (human or Claude) working on this codebase. Read
this before changing anything.

## What this is

The SAILS Platform: guided sales exercises for B2B SaaS founders/sales
leaders (velocity motions — see `sails-advisory` for the ICP) that compound
into a living sales playbook via a shared org-level context layer. This is
the *product*; `sails-advisory` (separate repo, `mwsails/sails-site`) is the
*marketing site* for the same practice. Different stack, different repo,
different deploy target — don't conflate them.

## Source of truth for product decisions

The build brief and the two foundational contracts are **not** in this repo —
they live in `~/Documents/Claude/Projects/SAILS/` (outside version control,
alongside the raw SAILS/Supersonic/PclubFY26 source material they were
derived from):

- `SAILS_Platform_Project_Plan.md` — the full build brief (users, data model,
  exercise engine, playbook, phases, risks).
- `SAILS_Platform_Exercise_Schema_v1.md` — the exercise definition file
  format. `src/lib/content/exercise-schema.ts` is its zod implementation;
  they must not drift.
- `SAILS_Platform_Context_Namespaces_v1.md` — the context-layer field
  dictionary. `src/lib/content/namespace-dictionary.ts` is its TypeScript
  mirror, checked by the content validator's `reads`/`writes`/`requires`
  resolution. Same rule: if you change one, change the other.

If you're about to design a new exercise mechanic, a new namespace, or
anything touching the data model, read those three docs first — this file is
operational, not architectural.

## Hard rules

1. **No em dashes or en dashes anywhere in product copy** (UI strings, prompt
   files, generated playbook content). Matt's standing brand rule, same as
   `sails-advisory`. Scan before shipping.
2. **Brand tokens are shared with `sails-advisory`**: navy `#0D1B4B`, accent
   blue `#2B60BE`, white, light gray `#F4F5F7`; Playfair Display (serif,
   headings) + Inter (sans, body). Defined in `src/app/globals.css`. A
   founder moving from the marketing site into the app shouldn't feel like
   they landed somewhere else.
3. **Content is validated, never hand-verified.** Every file under
   `/content` must pass `npm run content:validate` before it merges — CI
   enforces this (`.github/workflows/ci.yml`). Don't add a new step type,
   namespace, or mechanic without updating both the zod schema
   (`src/lib/content/exercise-schema.ts`) and the two markdown contracts.
4. **RLS is the isolation boundary, not app code.** Every org-scoped table
   has a policy keyed off `current_org_id()` (see
   `supabase/migrations/0001_init.sql`). If a new table holds org data and
   ships without an RLS policy, that's a bug, not an oversight to fix later.
5. **`ai_generate` output is always routed through an editable field before
   it can be written to context.** No exceptions — this is enforced by the
   content validator (Exercise Schema §6/§9), not left to author discipline.
6. **Enterprise track: content and namespaces only, never UI.** No v1 track,
   exercise, or nav item may reference the reserved namespaces
   (`buying_committee`, `poc`, `procurement`, `account_map`,
   `multithreading`) — the validator rejects it. The architecture tolerates
   them; the product doesn't ship them yet.

## Repo layout

```
/content                content-authors' domain — tracks, modules, exercises, prompts, library
  /tracks/*.yml          track slug, title, description, audience tags
  /modules/*.yml         module slug, title, tracks[], order
  /exercises/*.yml       one file per exercise — see Exercise Schema v1
  /prompts/*.md          Claude prompt files, frontmatter + templated body
/src/lib/content         the content engine: zod schemas, namespace dictionary,
                         path resolver, YAML loader, CI validator
/scripts/validate-content.ts   `npm run content:validate` entry point
/src/app                Next.js App Router pages
/supabase/migrations     schema + RLS (see supabase/README.md for setup — the
                         migration hasn't been run against a live instance yet,
                         first application is the real test)
```

## Conventions

- **Adding an exercise**: write the YAML, write its prompt file(s) if it uses
  `ai_review`/`ai_generate`, run `npm run content:validate` locally before
  opening a PR. The validator's error messages name the exact rule violated
  (see Exercise Schema §8 for the full rule list).
- **Adding/changing a namespace field**: update
  `src/lib/content/namespace-dictionary.ts` AND
  `SAILS_Platform_Context_Namespaces_v1.md` in the same change. Every
  array-of-objects field implicitly carries a system `id` (UUID) — don't
  redeclare it, the path resolver injects it.
- **`merge_by_key` defaults to matching on `id`**, never a user-editable
  label like `persona_name` — renaming an item in a redo must update it in
  place, not duplicate it.
- **Workspace root**: `/Users/harness` has an unrelated stray
  `package-lock.json` that confuses Next.js's root auto-detection — pinned
  via `turbopack.root` in `next.config.ts`. Don't remove that config.

## Status

**Phase 0 — complete.** Exercise schema + namespace dictionary contracts
(external docs, see above), content validator + CI, base layout/design
tokens. Supabase project live (`ypwygoykzbjnsokbjwwc`), migration
`0001_init.sql` applied, RLS verified against the real database.

**Phase 1 — complete**, verified end-to-end with a real signed-in test org
(not just unit-level): magic-link auth (`proxy.ts` + `@supabase/ssr`,
invite-only, no public signup), the content-sync job
(`npm run content:sync` — content files → `tracks`/`modules`/`exercises`
tables, needed for `exercise_sessions.exercise_slug`'s FK to resolve at
all), the generic exercise renderer for every non-AI step type, the context
store (`writeContext`/`readContext` in `src/lib/context/store.ts` —
replace/append/merge_by_key-on-id, append-only history, staleness marking),
the onboarding diagnostic, and two new chained exercises (`icp-segments`,
`persona-builder`) alongside Phase 0's `buyer-impact-areas`. `persona-builder`
deliberately reads both `icp-segments`' and `buyer-impact-areas`' output and
renders it inline — confirmed live in the browser, not just by design. The
Sales Profile page (view + edit, same write pipeline, `source: 'manual'`)
and the admin org/user provisioning page are both live.

One real bug this verification caught and fixed: `readContext` returns a
flat map keyed by full namespaced strings (`"icp.segments"`), not a nested
object — the template interpolator was dot-splitting every segment and
silently rendering empty. Fixed in `src/lib/template.ts`
(`resolveContextPath`); worth remembering if namespace-key handling ever
gets touched again.

Not done (Phase 2): `ai_review`/`ai_generate` step types (currently render
a placeholder), playbook section generation/staleness UI, DOCX/PDF export.
`ANTHROPIC_API_KEY` is not yet set anywhere — needed before any AI step can
run. `calculator`, `input_table`, and `rank` step types are implemented and
typecheck/lint clean but have no seeded content exercising them live yet —
worth a real test before leaning on them for Phase 3 content.

## Hosting (once past Phase 0)

Vercel, not Netlify — this is a Next.js App Router app with server-rendered
routes and Claude API calls, Vercel's home turf, unlike the static
`sails-advisory` site. Planned to live on a subdomain (e.g.
`app.sailsadvisory.com`) added as a new record in the existing Netlify DNS
zone that already hosts `sailsadvisory.com` — never touch the MX/SPF/DKIM
records there, they keep Matt's email alive.
