# CLAUDE.md — SAILS Platform

Handoff context for anyone (human or Claude) working on this codebase. Read
this before changing anything.

## What this is

The SAILS Platform: guided sales exercises for B2B SaaS founders/sales
leaders (velocity motions — see `sails-advisory` for the ICP) that compound
into a living sales playbook via a shared org-level context layer.

**As of August 2026, this IS the company.** SAILS is repositioning from a
consultant-led practice to an AI platform company: the 8-week consulting
engagement is retired entirely, and this product is the sole offer.
`sails-advisory` (separate repo, `mwsails/sails-site`) is the *marketing
site* for this platform — its CLAUDE.md carries the repositioning rules for
public-facing copy. Different stack, different repo, different deploy
target — don't conflate them.

Repositioning implications for product work here:

- The platform must stand alone. Nothing in-product may assume a consulting
  engagement wraps it — no "your consultant," "your engagement," or
  "discuss with Matt" framing in UI strings, prompts, or generated playbook
  content. The product's voice is the product's, self-serve by default.
- Positioning specifics are still open (pricing/packaging, final product
  name — "SAILS Platform" is the working name — signup motion beyond the
  current invite-only auth, launch timing). Don't encode any of these into
  copy, schema, or billing-shaped tables without asking Matt first.
- Roadmap pressure shifts accordingly: anything gating a stranger's
  self-serve first-run (onboarding polish, empty states, `ai_review`/
  `ai_generate` completion, export) matters more than it did when Matt was
  in the room with every user.

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

## Track model: tiers + cross-cutting modifiers

Tracks are **not** one-per-persona anymore (that was the Phase 0/early-Phase-1
shape: `founder-0-1`/`smb-velocity`/`mid-market`/`sales-leadership`, one
track per user). As of the tier-routing rework, a user has:

- Exactly one **tier** track — `smb`, `mid-market`, or `enterprise`.
  `enterprise` is routing/labeling only (no content ships against it — the
  Journey page shows a "coming soon, here's the closest fit" placeholder
  instead of an empty module list).
- Zero or more **modifier** tracks layered on top — `founder-led` (motion is
  founder-led) and `sales-leadership` (has a dedicated manager). A module or
  exercise's `tracks: []` array can name either kind; a user's applicable
  set is `[tier, ...modifiers]`, computed in
  `src/lib/tracks/recommend.ts` (`applicableTracks`), never hard-coded per
  page. See `TIER_TRACK_SLUGS`/`MODIFIER_TRACK_SLUGS` in
  `namespace-dictionary.ts`.
- The tier is a **deterministic score** (`recommendTrack`), not an AI guess —
  ACV/cycle length/stakeholder count/target customer size each score 0-2,
  procurement involvement bumps the tier up (never down). Computed once,
  after the diagnostic exercise's own writes land (see the `onboarding-diagnostic`
  special-case in `src/app/journey/[slug]/actions.ts`), written to
  `company.recommended_tier`. Soft, not locked — editable on `/profile` like
  any other context field.

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

**Track model reworked** post-Phase-1 (Matt's call, see git log): the four
one-per-user tracks became three deal-size tiers (`smb`/`mid-market`/
`enterprise`) plus two cross-cutting modifiers (`founder-led`/
`sales-leadership`), with a deterministic (non-AI) diagnostic-driven
recommendation. Verified live for both the mid-market path and the
enterprise placeholder path (redid the diagnostic twice against the real
deployment with inputs tuned to hit each tier, confirmed the exact expected
tier came back both times) — see `src/lib/tracks/recommend.ts`.

**Full visual/UX redesign — complete.** Soft-UI design tokens (shadows,
tints, radius, motion — see `globals.css`), hand-built inline SVG icon set
(`src/components/icons.tsx`, no emoji anywhere), and a redesign pass across
nav, home, Journey, the exercise runner, Profile, sign-in, and admin.
Verified live across light/dark and mobile/desktop, not just reviewed in
code — this caught and fixed 3 real bugs: two dark-mode contrast issues
(hardcoded navy/neutral colors that didn't flip with the theme) and one
mobile nav overflow (icon+label pills clipping off-screen below 400px).

**Playbook generation — live** (`src/lib/playbook/{sections.ts,generate.ts}`,
`src/app/playbook/`). 14 sections per the plan's §6 structure, each
declaring the context keys it reads; rendered as lightweight markdown-lite
(`##`/`-`/`**bold**` only — no markdown-parser dependency, and it's a sane
source for the eventual DOCX export) via bespoke templates for sections with
real seeded data and a generic structured fallback for the rest. Generate/
regenerate/approve are server actions; staleness is driven by the existing
`markDependentSectionsStale` mechanism in `src/lib/context/store.ts` (already
built in Phase 1, just never had a UI in front of it until now). Verified
live end-to-end against a real test org: generated a section, approved it,
edited the context field it depends on, confirmed it flipped to "Needs
regeneration" while an unrelated section stayed "Approved," then regenerated
and confirmed it picked up the new value.

**Discovery Framework section fixed** — was reading only
`process.discovery_framework`, an elaborate shape nothing has ever written
to (see that field's own namespace comment), so it rendered permanently
blank even though `discovery-focus-builder`'s real, already-populated FOCUS
question bank (`process.discovery_script`) has existed since that exercise
shipped — the two are deliberately different shapes (the flatter one an
`input_table` naturally produces), not a naming typo, so this was a section
simply never wired to read the field that actually has data. Fixed with a
bespoke template rendering the five FOCUS rows (Facts, Objectives,
Complications, Uncovering Impact, Stakes) in order with the rep's own
questions, falling back to the generic renderer for
`discovery_framework`/`pain_tree.topics` if either is ever populated. No
new exercise content needed — this closed a real gap using content that
already existed. Verified live: seeded a real FOCUS script, generated the
section, confirmed all five rows rendered in the correct order with the
exact seeded questions.

Several other Playbook sections are still permanently blank for the
opposite reason — no exercise writes to their namespaces at all yet
(Outbound System, Intro Call Framework, Demo Framework, Closing Motion,
Meeting Cadence and KPIs, Team) — that is a real curriculum-content gap,
not a wiring bug like this one was, and is a larger effort (new exercises,
not a section-template fix).

**Curriculum expanded** with 3 new exercises to seed previously-empty
playbook sections and exercise step types that had zero live content:
`cost-of-inaction-calculator` (module: `messaging-foundation`), `objection-
bank-builder` and `process-stages-builder` (both under the new
`sales-process-fundamentals` module). This surfaced and fixed a real gap in
the `calculator` step type: its computed output only ever existed in the
rendered UI, never in the stored answer, so no `writes` mapping could ever
target it. Fixed in `CalculatorField` (`ExerciseForm.tsx`) to persist
`result` alongside the raw inputs — a generic renderer fix, not a one-off
hack, so every future `calculator`-based exercise gets a working write path
for free. Verified live: submitted the calculator with real inputs,
confirmed the exact computed value (`6 * 75 * 48 = 21600`) landed in
`pain_tree.cost_of_inaction_estimate` on Profile, then confirmed the
Playbook's pain-tree section rendered it as a highlighted figure.
`input_table`'s `dynamic` row_mode and `input_list`'s `select` field type are
now both exercised live too (`process.stages`, `objections.objections`).
Added namespace: `pain_tree.cost_of_inaction_estimate` (scalar) — see both
`namespace-dictionary.ts` and the external contract doc.

**AI suggestions — live and verified** (`src/lib/ai/suggest.ts`,
`AiSuggestPanel.tsx`). A `suggest: {prompt_ref, count, reads}` block on
`input_list`/dynamic-`input_table` steps drives a "Get AI suggestions" panel:
calls Claude (model + prompt come from `content/prompts/*.md`) via a forced
tool call for structured output, no free-form parsing, then each suggestion
is a card with **Add** that drops it into the step's own editable rows — so
it flows through the identical `writes` mapping as a manually-typed entry, no
separate AI-output write path to keep in sync. Wired onto 5 exercises:
`buyer-impact-areas`, `icp-segments`, `persona-builder`,
`objection-bank-builder`, `process-stages-builder`. Model is
`claude-opus-4-8` per most prompt files (the house default absent an
explicit ask for something cheaper/faster) — `review-impact-areas.md` is the
one exception, on `claude-sonnet-5`.

Caught one real bug during verification: Next.js redacts thrown Server
Action error messages to a generic digest in production builds, so a
deliberately friendly "not configured yet" error never reached the client.
Fixed by having `suggestForStep` return `{suggestions} | {error}` instead of
throwing — confirmed live that the exact intended message now renders. This
pattern (return, don't throw, for any Server Action error a user should
read) is worth reusing for other actions doing free-form `throw new Error()`.

`ANTHROPIC_API_KEY` is set (in `.env.local`) — verified live end to end, not
just to the "not configured" error boundary: a real "Get AI suggestions"
call against `buyer-impact-areas` returned genuine, context-specific
suggestions, added cleanly into the step's rows.

**`ai_generate` — live** (`AiGenerateField.tsx`, `generateForStep`). Same
forced-tool-call/return-not-throw shape as AI suggestions, but drafts one
artifact instead of proposing several candidate rows; the draft always lands
in an editable field before it can be saved (Exercise Schema §6/§9, CLAUDE.md
rule 5 above), never written straight to context. Live in `opp-rate-diagnosis`
and `objection-framework`.

**`ai_review` — live** (`AiReviewPanel.tsx`, `src/lib/ai/review.ts`,
`reviewForStep`). The last step type that was still a placeholder. Non-
blocking, on-demand critique of another step's in-progress answer — never
writes to context itself (Exercise Schema §9), so there is no editable-field
routing to worry about, just a "Get feedback" trigger and read-only prose
back. Looked up by `reviews_step` (the id of the step it critiques), not its
own `id` — `ai_review` never declares one, since it never appears on the
right side of a `writes` mapping. `currentAnswer` comes from the exercise
form's own client-side state, not `readContext`: the step under review has
not been submitted yet, so nothing about it exists in context yet. Live in
`buyer-impact-areas`. Verified live end to end: filled in `impact_areas`,
clicked "Get feedback," got a real, specific, item-by-item critique back
(and, when only one of three rows had content, the model correctly said so
instead of inventing feedback for empty rows). Also fixed a real content gap
this surfaced — `review-impact-areas.md`'s prompt references
`{{context.company.name}}`/`{{context.company.product_name}}`, but
`buyer-impact-areas.yml`'s exercise-level `reads` only listed
`icp.segments`/`personas.personas` (the nested `suggest.reads` on the
`impact_areas` step had them, but `ai_review` has no `reads` of its own — it
rides the same shared `context` prop every step gets, populated from the
exercise-level `reads`). Both fields are now in that list.

**DOCX export — live** (`src/lib/playbook/export.ts`, `/playbook/export`
route handler). The `docx` package had been an unused dependency since the
Phase 0 skeleton commit, pre-positioned for this — `sections.ts`'s own doc
comment says the markdown-lite format was chosen deliberately so it would
be "a sane source for the eventual DOCX export... without needing a full
markdown parser dependency." Turned out true: converting `##`/`-`/`**bold**`
into `docx` heading/bullet/bold-run objects was a small, dedicated parser,
not a shared one with `MarkdownLite.tsx` (different output shapes — React
nodes vs `docx` objects — not worth an AST layer for this). A plain GET
route, not a Server Action, since a real file download needs
`Content-Disposition` headers on the response itself. Exports exactly what
the Playbook page shows on screen (draft and approved sections alike, no
separate approval gate) — this is a user-initiated "give me a file" action,
not a publish step. `docx` needs no native binaries or headless browser, so
it runs cleanly in a Vercel serverless function, unlike most PDF options
(none installed; still not done, and needs its own scoping — the obvious
paths, e.g. headless-Chrome-based HTML-to-PDF, don't fit Vercel serverless
the way `docx` does).

There is also an `artifacts` table in the schema (`type: 'playbook_export'`,
`file_ref` documented as a Supabase Storage path) that nothing writes to —
looks aimed at a persisted-download-history feature, deliberately not
wired up here; this export is generated on request, not stored.

Verified live end to end: seeded a real org, generated four sections with
real content, downloaded the file, confirmed the response's Content-Type,
Content-Disposition, and ZIP magic bytes were all correct, then decoded and
inspected `word/document.xml` directly — the exact seeded company name,
tier, ICP segment, persona, and objection all came through with correct
heading/bullet/bold structure.

**`rank` step type — now seeded live** (`persona-priority-ranking` exercise,
`personas-buyer-roles` module). Rank `personas.personas` by deal influence,
via `rank`'s `source: context` mode — the schema doc's own worked example,
built almost exactly as written there. Caught and fixed a real bug in
`RankField` (`ExerciseForm.tsx`) along the way: for `source: context`, it
was using each item's array position as its rank value (`String(i)`), not
the stable `id` the context store already injects on every array-of-objects
field (`store.ts`). An index goes silently stale the moment the underlying
list is edited or reordered later — a stored "1" would then point at
whatever item happens to sit at position 1, not the item actually ranked
there. Since no exercise had ever used `source: context` before this, the
bug had never been exercised live. Fixed to use `.id`; new namespace field
`personas.priority_order` stores real persona ids in rank order, verified
live via DB query after reordering the list in the UI.

**"Your CRO" — the platform's first real agent, live** (`cro-diagnosis`
exercise, `cro-diagnosis` module, `content/prompts/cro-diagnosis.md`). The
marketing site (`sails-advisory`, separate repo) has long pitched three
named AI agents running the platform's continuous Assess/Build/Coach loop —
a **CRO** (diagnosis), a **VP of Sales** (teaching), and an **Enablement
Lead** (building) — but until this, nothing in this repo actually
implemented any of them as a distinct thing; `ai_review`/`ai_generate`/AI
suggestions are all generic, unnamed, single-exercise-step tools, and the
only trace of the three-agent concept anywhere in the platform code was a
literal `agent: "cro"` string tagging one `rep.commitments` entry. This is
the first of the three, and the one with the most existing groundwork
already pointing at it: `metrics.unused_sources` was explicitly seeded
"so a future CRO gap-check can read this directly... nothing reads it yet"
(see that field's own doc comment), and the existing `opp-rate-diagnosis`
exercise's prompt already said "acting as this org's CRO" for one narrow
metric.

This generalizes that pattern from one metric to the whole org: reads
broadly across nearly everything accumulated so far (ICP, personas, pain
tree, messaging, objections, process, funnel metrics, team, open
commitments — the same `ai_generate`/return-not-throw/forced-tool-call
plumbing as every other AI step, just with a much wider `reads` list) and
ranks the 3 biggest gaps, each with reasoning grounded in that org's actual
numbers and a next-step pointing at a real exercise slug. Gated only on
`company.recommended_tier` (onboarding complete), not on having finished
any other exercise, so it is useful from day one — an org with nothing
built yet gets "you have no personas defined" as a correctly-prioritized
finding instead of an empty screen.

Fixed at exactly 3 numbered gaps (`gap_1`/`gap_2`/`gap_3`, each with its own
`_reasoning`/`_next_step`), not a variable-length array — `ai_generate`'s
`fields` are a flat named-field object, not an array, so this is the shape
that fits without new step-type plumbing. `gap_N_next_step` is an exercise
slug; the model is grounded to the real curriculum list by name in the
prompt text (not injected via `context`, since the exercise list is static
content-loader data, not something `readContext` sees) — this needs a
manual prompt edit whenever an exercise is added or renamed, a known
tradeoff, not an oversight.

The Journey page surfaces the latest diagnosis (append-only, same
`mode: append` precedent as `metrics.diagnosis`) as a standalone card above
the module list, each gap's next-step slug resolved to a real exercise
link — same two-part pattern (completable exercise + standalone status
card) as the existing opp-rate diagnosis.

Verified live end to end: seeded an org with strong ICP/personas but
deliberately no messaging, no objection bank, no cost-of-inaction estimate,
and real (weak) funnel numbers. The diagnosis correctly skipped ICP and
personas (already substantive) and flagged exactly the three real gaps,
each citing exact seeded numbers (100 leads to 15 opportunities to 3 closed
won, 40 hours a month, $20k ACV, one AE with no sales manager) rather than
generic advice, with all three `next_step` values matching real curriculum
slugs. Confirmed the write persisted correctly and the Journey page card
rendered with working links to the right exercises.

**"Your VP of Sales" — the second agent, live** (`vp-of-sales-coaching`
exercise, `vp-of-sales-coaching` module, `content/prompts/vp-of-sales-
coaching.md`). Coach, not diagnose: unlike CRO's org-wide read, this reads
one rep's own `progress.ikap` history and coaches that person specifically.

Building it surfaced a real, confirmed gap: `progress.ikap` was a stub
(`{kind: "any"}`) nothing had ever written to. `objection-framework.yml`
(the only exercise with a real IKAP Know/Awareness quiz loop) only ever
persisted one AI-generated field via `writes` — every quiz answer, right
or wrong, vanished the moment the exercise was submitted, so there was no
real per-rep skill data anywhere for a coaching agent to read. Fixed as a
generic mechanism, not a one-off for that one exercise: the `quiz` step
type gained an optional `stage` field (`"know"` \| `"awareness"`, explicit
rather than inferred from the step's id naming), and `submitExercise`
(`journey/[slug]/actions.ts`) now recomputes correctness server-side for
any tagged quiz step at completion time (re-rendering that step's own
`correct` template against real context, never trusting the client) and
writes it to `progress.ikap` — every current and future quiz-bearing
exercise gets real progress tracking for free the moment its quiz steps
are tagged, same "generic renderer fix, not a one-off hack" precedent as
`calculator`'s `result`-persistence fix. `progress.ikap` itself is now a
real shape (`{exercise_slug, step_id, stage, is_correct}`), firmed up from
the `any` placeholder now that there is something real to validate it
against.

The coaching agent reads that history plus the rep's own role/experience
and the org's ICP/personas for grounding, and looks for a real pattern
(missing Know but acing Awareness means the concept isn't learned yet;
the reverse means it is understood but not yet internalized under
pressure) rather than reacting to a single answer in isolation — with only
one or two data points, it says so plainly instead of inventing a pattern.
Surfaced as a standalone card on the Profile page (not Journey — this
coaches a person, not the org, matching the same user-scoped/org-scoped
placement discipline the codebase already applies to storage), same
two-part precedent as CRO and the older opp-rate diagnosis: a completable
exercise plus a prominent status card, `progress.vp_coaching` append-only.

Verified live end to end: completed `objection-framework`'s three quiz
steps with a deliberately mixed real result (one Know check right, one
Know check wrong, the AI-generated Awareness check right), confirmed
`progress.ikap` persisted exactly that pattern with real ids, then ran the
coaching agent — it correctly called out the specific pattern (missed one
Know check despite acing Awareness, "the reverse of what usually trips
people up"), named the exact step to revisit, and was honest that three
data points is early signal, not a hard pattern, exactly as instructed.

**"Your Enablement Lead" — the third and final agent, live** (`enablement-
one-pager` exercise, `enablement-lead` module, `content/prompts/enablement-
one-pager.md`). Build, not diagnose or coach. The marketing site's own
framing already named this exact first artifact: *"a one-pager for [their
ICP] in your brand."* Two things already pointed at this before it existed
— `org.brand.*`'s own doc comment said "every Enablement-generated asset is
meant to render in these tokens eventually," and `/library` was already a
named, empty-stated placeholder page ("Filterable reference frameworks and
one-pagers ship in Phase 3").

Different in kind from CRO/VP of Sales: those two produce internal
reasoning (a diagnosis, a coaching note); this produces prose meant to
leave the platform — copy a rep could actually send a prospect. The prompt
is explicit about never fabricating a statistic, customer name, or result
not present in context, leaning on whatever real data is populated
(impact areas, proof points from the Business-bucket scrape) rather than
inventing specifics when messaging hasn't been built yet — same "propose,
don't assume" discipline as everything else, just with a higher bar since
this is customer-facing.

Written to `org.one_pagers` (org-scoped like `cro_diagnosis`, not
user-scoped like `progress.vp_coaching` — a one-pager is a shared sales
asset, not personal to the rep who generated it), append-only so an org
can generate more than one over time. `value_bullets` is one
newline-separated string, not an array — same `ai_generate`-fields-are-flat
constraint `cro_diagnosis` hit, solved differently here since a one-pager's
bullet count genuinely varies (3-5) rather than being fixed like CRO's
3 gaps.

`/library` now actually renders these, themed with `org.brand.*` (logo,
primary/secondary color). Caught and fixed a real bug during verification:
the card originally used the app's own theme-reactive text tokens
(`var(--foreground)`, `text-muted`) alongside hardcoded brand-color
backgrounds — in dark mode, a light `secondary` brand color plus
light-in-dark-mode foreground text produced nearly illegible text.
Fixed by giving the card a fixed light "paper" surface and fixed dark-slate
text tokens instead, independent of the app's own theme — correct because
a one-pager is a preview of a document meant to be sent or printed, not a
dashboard element, so it should look the same regardless of the viewer's
app theme.

All three named agents from the marketing site's pitch are now live:
CRO (Assess), VP of Sales (Coach), Enablement Lead (Build).

**One-pager PDF and PowerPoint export — live**
(`src/lib/library/one-pager-export.tsx`, `/library/[id]/export/{pdf,pptx}`
route handlers). PDF/PPTX export was originally asked about for the
Playbook, deferred at the time since the DOCX Playbook export pattern
doesn't extend cleanly to either format — but the actual ask was "important
for enablement assets," and once Enablement Lead's one-pager existed, that
was the real fit: a one-pager is exactly the short, brand-forward,
externally-shareable document PDF and a single PPTX slide are built for,
unlike the 14-section internal Playbook DOCX already serves well.

`@react-pdf/renderer` for PDF (renders a JSX `<Document>`/`<Page>` tree
server-side via `renderToBuffer`, no headless browser — same "runs cleanly
in a Vercel serverless function" requirement DOCX export had to satisfy)
and `pptxgenjs` for PowerPoint (one branded slide, not a deck — matches the
marketing site's own framing of a one-pager as a single artifact). Both
share `src/lib/library/one-pager-export.tsx` (a `.tsx` file, not `.ts` —
react-pdf's document tree is JSX). Real gotcha caught before it ever hit a
live test: `pptxgenjs` color options take a bare hex string (`"1E293B"`),
not CSS notation (`"#1E293B"`) — `org.brand.*` colors are stored with the
`#`, which `react-pdf` and the app's own CSS both accept directly but
`pptxgenjs` silently doesn't, so brand colors are stripped once at the top
of `buildOnePagerPptx` rather than at each scattered call site.

Verified live end to end: fetched both export routes directly, confirmed
correct `Content-Type`/`Content-Disposition` and each format's real magic
bytes (`%PDF-` for PDF, the ZIP signature for PPTX, since `.pptx` is a ZIP
container same as `.docx`). Then went a level deeper than the DOCX
verification — called `buildOnePagerPdf`/`buildOnePagerPptx` directly in a
throwaway script to get clean output files, extracted the PPTX slide's real
text via `unzip`, and extracted the PDF's real text via `pdftotext`
(`strings` doesn't work on PDF content streams, which are typically
compressed) — confirmed every field (headline, subheadline, all three
bullets, the proof point, the CTA) came through exactly correct in both
formats.

Not done: none of the deferred export work remains — DOCX (Playbook), PDF,
and PowerPoint (one-pager) are all live.

## Hosting (once past Phase 0)

Vercel, not Netlify — this is a Next.js App Router app with server-rendered
routes and Claude API calls, Vercel's home turf, unlike the static
`sails-advisory` site. Planned to live on a subdomain (e.g.
`app.sailsadvisory.com`) added as a new record in the existing Netlify DNS
zone that already hosts `sailsadvisory.com` — never touch the MX/SPF/DKIM
records there, they keep Matt's email alive.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
