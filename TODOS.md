# TODOs

Deferred work captured during `/plan-eng-review` (2026-07-31), scoped against the SAILS Platform Rebuild architecture. All four items were explicitly cut from the first vertical-slice build (the opp_rate Diagnostic Intake Layer) to validate one unproven mechanism at a time rather than betting on several simultaneously.

## 1. Build the remaining Foundation sections + 12 other Playbook modules

**What:** Extend the exercise pattern to the other 4 Foundation sections (ICP+Positioning, Capabilities Matrix, Sales Story, Messaging+POV) and 12 Playbook modules (everything beyond Discovery) from the rebuild map, once the Diagnostic Intake Layer slice validates.

**Why:** This is the bulk of the actual product — the diagnostic layer only matters if there's a full Playbook behind it to prescribe into.

**Pros:** Mechanical repetition of an already-proven pattern (reuses `ExerciseForm.tsx`/`actions.ts`), lower risk once the core loop is validated.

**Cons:** Real multi-week effort; building it before the diagnostic UX is validated would waste it if the core bet is wrong.

**Context:** This is the scope cut agreed in the eng review (D1) — explicitly deferred until the opp_rate slice proves the diagnostic mechanism works.

**Depends on:** Diagnostic Intake Layer slice shipping and being validated with real usage.

## 2. Scrape-based onboarding (8-step flow)

**What:** Build the website-scrape onboarding flow that seeds org context automatically instead of manual entry.

**Why:** Every exercise downstream reads from scraped context in the full spec — it's foundational, but was deliberately excluded from the diagnostic-layer slice to avoid validating two unproven mechanisms at once.

**Pros:** Removes blank-first-field friction platform-wide once built; scraping infra cost already researched (Firecrawl ~$16/mo, negligible at this volume).

**Cons:** A real multi-week lift on its own (new UX, scrape-quality/confidence handling, failure modes when scrape fails or a site blocks bots).

**Context:** The diagnostic-layer slice seeds Discovery data manually via the existing context store instead.

**Depends on:** Nothing blocking — could run in parallel with Playbook build-out, but shouldn't run in parallel with the diagnostic-layer validation itself.

## 3. Mid-market/enterprise meeting cascade (GUIDE/ALIGN/NSO/MSO/CHAMP/Confirm/Onboarding)

**What:** Build the six new meeting-type playbooks confirmed against the Harness Full-Cycle AE curriculum for the Mid-Market/Enterprise segment.

**Why:** Real, confirmed frameworks — but a large new surface area for a segment that likely isn't the near-term majority if SMB is the initial focus.

**Pros:** Fully researched and mapped already (see the SAILS Platform Rebuild Workflow Map artifact); when needed, the content is ready to build from.

**Cons:** Six new meeting-type UIs/content sets is a lot to build speculatively before a real Mid-Market/Enterprise client exists to validate against.

**Context:** Surfaced during source-material research against the Harness curriculum; deliberately excluded from the diagnostic-layer slice.

**Depends on:** Nothing blocking — natural candidate for whenever SMB is stable and a Mid-Market/Ent client is in the pipeline.

## 4. Asset generation engine (deck/sequence/card generation reading org.brand.*)

**What:** Build the second output layer — decks, sequences, one-pagers, objection/discovery cards — as designed in the rebuild map.

**Why:** A genuinely new output class beyond the Playbook itself, but orthogonal to validating the diagnostic engine.

**Pros:** High visible value ("this is our deck," not "AI made me a doc") once the Foundation/Playbook content exists to generate from.

**Cons:** Needs Foundation context (positioning, capabilities, story) to be populated first — building it before that content exists produces empty/generic output.

**Context:** Explicitly Phase-2-adjacent already in the rebuild map; not currently blocking anything in the diagnostic slice.

**Depends on:** Foundation sections (ICP, Positioning, Capabilities, Sales Story) being built and populated — i.e., depends on TODO 1.

## 5. Wire up tier-1 platform-native signals for real

**What:** Once Reinforcement Exercises exist (TODO 1's scope), connect the diagnostic layer's tier-1 stub to real `rep[].skill_scores[]` data instead of the permanent "no data" stub.

**Why:** Flagged by the outside-voice review — it has no explicit owner right now. It's easy for "build the rest of the Playbook" (TODO 1) to happen without anyone remembering to also flip this specific switch, at which point the "3-tier diagnosis" pitch quietly becomes 2-tier forever.

**Pros:** Cheap to track now; makes sure the actual differentiator (preferring real signal over self-report) gets validated eventually, not just the self-report fallback path.

**Cons:** None — this is bookkeeping to prevent silent scope loss.

**Context:** Surfaced by the outside-voice review during `/plan-eng-review`, not the original review pass.

**Depends on:** TODO 1 (Reinforcement Exercises existing).
