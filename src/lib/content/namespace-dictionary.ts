/**
 * Machine-readable mirror of SAILS_Platform_Context_Namespaces_v1.md.
 * If you change a field here, update that doc too (and vice versa) — they
 * must never drift, since this is what the content validator checks
 * `reads` / `writes[].to` / `requires` against.
 *
 * Every array-of-objects implicitly gains an `id` scalar field (the
 * merge_by_key default target, see Exercise Schema §5/§9) — the resolver
 * injects it, so it's not repeated below.
 */

export type FieldNode =
  | { kind: "scalar" }
  | { kind: "object"; fields: Record<string, FieldNode> }
  | { kind: "array"; of: FieldNode }
  | { kind: "map"; of: FieldNode } // dynamic-keyed object, e.g. pain_tree.topics[].by_level
  | { kind: "any" }; // loosely-specified fields not yet worth fully modeling (see doc)

const scalar: FieldNode = { kind: "scalar" };
const arrayOfScalar: FieldNode = { kind: "array", of: scalar };
const obj = (fields: Record<string, FieldNode>): FieldNode => ({ kind: "object", fields });
const arrayOf = (fields: Record<string, FieldNode>): FieldNode => ({
  kind: "array",
  of: obj(fields),
});

/** v1 namespaces — buildable now, exercises may target these. */
export const NAMESPACES: Record<string, Record<string, FieldNode>> = {
  company: {
    name: scalar,
    product_name: scalar,
    category: scalar,
    pricing_model: scalar,
    // acv/cycle_length_days/stakeholder_count/target_customer_size/
    // procurement_involved/buyer_title are written by the Customer bucket's
    // two bespoke onboarding screens (src/app/onboarding/actions.ts —
    // saveCustomerProfile, saveDealShape), not by an exercise. motion is
    // derived, not asked directly — see saveHasExistingMotion/saveTeamRoles
    // in that same file. All formerly came from onboarding-diagnostic.yml,
    // now retired (see that file's header comment for the full mapping).
    acv: scalar,
    cycle_length_days: scalar,
    motion: scalar, // "founder_led" | "team_selling", derived, see above
    stakeholder_count: scalar,
    target_customer_size: scalar,
    procurement_involved: scalar,
    buyer_title: scalar,
    // Explicit, not inferred from headcount — a solo founder can still have
    // real closed deals and real funnel numbers, and a team of 3 can be six
    // months old with nothing to report yet. Gates whether metrics.* and
    // the opp_rate Diagnostic Intake Layer are even asked (see
    // opp-rate-check.yml's requires) instead of asking a founder for a
    // conversion rate on zero meetings.
    has_existing_motion: scalar, // "yes" | "no"
    // Written by recommendTrack, called from saveDealShape once its last
    // required input is known (src/app/onboarding/actions.ts) — the one
    // tier-deciding field every other namespace/module keys off.
    recommended_tier: scalar,
    // Written by the bespoke Business onboarding screen (not an exercise —
    // see src/app/onboarding), scrape-sourced then reviewed/corrected on
    // the same screen, same "propose, don't assume" pattern as everywhere
    // else. domain is the raw input; the rest come back from
    // scrapeAndExtract. what_you_sell/capabilities/proof/stage are
    // deliberately separate from the older product_name/category pair
    // above rather than replacing them — product_name/category still feed
    // existing exercises and prompts, these are the fuller Business-bucket
    // shape the new onboarding flow actually asks for.
    domain: scalar,
    what_you_sell: scalar,
    capabilities: scalar,
    proof: scalar,
    stage: scalar,
  },

  // Who is answering, not what the business is — orthogonal to company.*.
  // A sales leader and an individual rep at the same company should see
  // different depth; someone with extensive experience should be able to
  // skip straight to Practice on a framework they already know instead of
  // sitting through Install/Know every time. Collected in onboarding,
  // ahead of Foundation, since it colors every screen after.
  respondent: {
    role: scalar, // "founder" | "sales_leader" | "rep" | "other"
    // Only asked (and only meaningful) when role is "other" — the fixed
    // list doesn't cover every real title (ops, RevOps, a co-founder doing
    // sales part-time), and "other" alone throws that context away. Blank
    // for the other three role values, same "not everything is always
    // filled" pattern as icp.segments[].geography.
    title: scalar,
    sales_experience: scalar, // "none" | "some" | "extensive"
  },

  icp: {
    segments: arrayOf({
      segment_label: scalar,
      firmographics: obj({ industry: scalar, size_range: scalar, geography: scalar }),
      tiering_criteria: arrayOf({ criterion: scalar, weight: scalar }),
      disqualifiers: arrayOfScalar,
    }),
  },

  personas: {
    personas: arrayOf({
      title: scalar,
      role_in_deal: scalar,
      cares_about: arrayOfScalar,
      day_to_day_pains: arrayOfScalar,
      accessible_pain_levels: arrayOfScalar,
    }),
    // References a persona by title (not id) — simpler than an id-lookup
    // for a v1 exercise, and the rep is looking at the persona's title on
    // screen while filling this out anyway. Not linked via merge_by_key to
    // personas.personas because that write mode replaces the whole matched
    // object (see store.ts's mergeByKey) — embedding this here would risk
    // silently dropping a persona's other fields on a partial edit.
    champion_checks: arrayOf({
      persona_title: scalar,
      influence: scalar, // "yes" | "no" | "not_sure"
      incentive: scalar,
      intel: scalar,
      evidence: scalar,
      overall_read: scalar, // "confirmed_champion" | "needs_more_work" | "not_a_real_champion"
    }),
  },

  pain_tree: {
    levels: arrayOf({ key: scalar, label: scalar, definition: scalar }),
    topics: arrayOf({
      topic_name: scalar,
      by_level: { kind: "map", of: obj({ definition: scalar, example_quotes: arrayOfScalar }) },
      business_impact_formula: obj({
        formula_text: scalar,
        variables: arrayOf({ name: scalar, unit: scalar }),
      }),
    }),
    ground_rules: arrayOf({ rule_title: scalar, rule_explanation: scalar }),
    impact_areas: arrayOf({
      area_name: scalar,
      who_feels_it: scalar,
      metric_affected: scalar,
      cost_if_ignored: scalar,
    }),
    cost_of_inaction_estimate: scalar,
  },

  messaging: {
    pov_statement: scalar,
    problem_statements: arrayOfScalar,
    soundbites: arrayOfScalar,
    value_map: arrayOf({
      capability: scalar,
      customer_problem: scalar,
      root_cause: scalar,
      proof_point: scalar,
      business_outcome: scalar,
    }),
    proof_points: arrayOf({ proof_category: scalar, evidence: scalar }),
    before_after: arrayOf({
      dimension: scalar,
      before: scalar,
      after: scalar,
      proof_point: scalar,
    }),
    no_logo_pitch: scalar,
  },

  outbound: {
    channels: arrayOfScalar,
    sequences: arrayOf({
      sequence_name: scalar,
      total_touches: scalar,
      length_days: scalar,
      touches: arrayOf({
        touch_number: scalar,
        day_offset: scalar,
        channel: scalar,
        angle_name: scalar,
        goal: scalar,
        subject_line_template: scalar,
        cta_type: scalar,
        body_slots: obj({
          trigger: scalar,
          current_state: scalar,
          ideal_state: scalar,
          cta: scalar,
          ps: scalar,
        }),
        if_answered_script: scalar,
        if_voicemail_script: scalar,
      }),
    }),
    personalization_map: arrayOf({ signal: scalar, angle: scalar }),
    list_strategy: scalar,
  },

  process: {
    stages: arrayOf({
      stage_name: scalar,
      definition: scalar,
      entry_criteria: scalar,
      exit_criteria: scalar,
      typical_duration: scalar,
    }),
    discovery_framework: obj({
      framework_name: scalar,
      steps: arrayOf({
        key: scalar,
        label: scalar,
        purpose: scalar,
        example_questions: arrayOfScalar,
        user_questions: arrayOfScalar,
      }),
    }),
    // Deliberately flatter than the elaborate discovery_framework shape
    // below (framework_name + steps[] with dual question arrays) — same
    // flattening tradeoff as icp-segments/persona-builder. A fixed-row
    // input_table naturally produces {row_id, user_questions}, not the
    // richer per-step shape, and matching that exactly isn't worth the
    // added exercise complexity for v1.
    discovery_script: arrayOf({
      row_id: scalar, // "facts" | "objectives" | "complications" | "uncovering_impact" | "stakes"
      user_questions: scalar,
    }),
    demo_narrative: obj({
      parts: arrayOf({
        part_name: scalar,
        purpose: scalar,
        script_anchor: scalar,
        opening_line: scalar,
      }),
    }),
    closing_motion: obj({
      framework_name: scalar,
      steps: arrayOf({
        key: scalar,
        label: scalar,
        purpose: scalar,
        script_anchor: scalar,
        your_language: scalar,
        watch_out_for: scalar,
      }),
    }),
    qualification_framework: obj({
      framework_name: scalar,
      criteria: arrayOf({
        key: scalar,
        label: scalar,
        qualifying_question: scalar,
        disqualifier_signal: scalar,
      }),
    }),
    bridge: arrayOf({
      root_cause_confirmed: scalar,
      financial_impact: scalar,
      stakes: scalar,
      demo_module_to_show: scalar,
      opening_frame: scalar,
    }),
  },

  objections: {
    objections: arrayOf({
      objection_text: scalar,
      category: scalar,
      reframe: scalar,
      talk_track: scalar,
    }),
  },

  cadence: {
    meetings: arrayOf({
      meeting_name: scalar,
      cadence: scalar,
      duration: scalar,
      attendees: scalar,
      purpose: scalar,
    }),
    kpis: arrayOf({ kpi_name: scalar, type: scalar, benchmark: scalar, target: scalar, current: scalar }),
    pipeline_math: obj({
      coverage_target_multiplier: scalar,
      avg_deal_size: scalar,
      win_rate: scalar,
      sales_cycle_days: scalar,
    }),
  },

  metrics: {
    // v1 ships exactly one metric (opp_rate — meetings/discovery calls that
    // convert to a real opportunity). Modeled as a namespace rather than a
    // flat company.* field because it's the first of what the diagnostic
    // engine will eventually track several of (set_rate, keep_rate,
    // close_rate, arpa), and diagnosis[] already needs to be per-metric.
    actuals: obj({
      opp_rate: scalar,
    }),
    // Self-report signals feeding the opp_rate diagnosis (Discovery-quality
    // proxies, not a full 5-gate scorecard yet — see TODOS.md #1). A second
    // exercise reads this committed object to generate a diagnosis, same
    // "write in exercise A, read in exercise B" pattern as icp-segments ->
    // persona-builder.
    opp_rate_signals: obj({
      quantifies_impact: scalar, // "yes" | "sometimes" | "no"
      single_threaded: scalar, // "yes" | "no"
      handoff_gap: scalar, // "yes" | "no" | "n/a"
    }),
    // Append-only diagnosis history (Exercise Schema §5 append mode) — a
    // re-diagnosis adds a new entry rather than overwriting, so a future
    // coaching view can show "diagnosed as X twice, still unresolved."
    diagnosis: arrayOf({
      metric: scalar,
      cause: scalar,
      confidence: scalar,
      reasoning: scalar,
    }),
    // Real funnel data by lead source, from the bespoke Sales Motion
    // onboarding screen (src/app/onboarding) — a different, coexisting
    // signal from opp_rate_signals/actuals above, not a replacement. Those
    // are a rough self-assessment used before real numbers exist; this is
    // the funnel once they do. Only leads/sets/meetings/opportunities/
    // closed_won/arr/cycle_length_days are ever user-typed — set_rate/
    // keep_rate/opp_rate/close_rate/arpa/velocity are computed server-side
    // at write time and stored alongside them so downstream readers (the
    // CRO, a future Firmographic ICP screen) don't recompute from raw
    // counts, but a typed rate can never disagree with its own counts,
    // because nothing ever types one.
    lead_sources: arrayOf({
      // One of the six fixed values ("cold_outbound" | "inbound" | "referral"
      // | "lost_opportunities" | "partners" | "events"), or a slugified
      // custom name — the Metrics screen lets a rep add their own source
      // (a second outbound motion, co-marketing, affiliates) alongside the
      // six suggested ones. Free text at the schema level either way; the
      // fixed list is a UI convenience (LEAD_SOURCES), not a validated enum.
      source: scalar,
      leads: scalar,
      sets: scalar,
      meetings: scalar,
      opportunities: scalar,
      closed_won: scalar,
      arr: scalar,
      cycle_length_days: scalar,
      set_rate: scalar,
      keep_rate: scalar,
      opp_rate: scalar,
      close_rate: scalar,
      arpa: scalar,
      velocity: scalar,
    }),
    // Blended across all entered sources — opportunity-weighted, not a
    // straight mean (see computeLeadSourceMetrics). Derived, never typed,
    // same reasoning as the per-source rates above.
    velocity: scalar,
    // Fixed at 90, not user-selectable — see REPORTING_PERIOD_DAYS in
    // src/lib/onboarding/metrics.ts for the reasoning (comparability across
    // orgs and across a single org's own history matters more than letting
    // someone pick monthly/quarterly/annually). Stored, not just a copy
    // assumption, so a future change to the default doesn't leave old
    // lead_sources rows ambiguous about what window they represent.
    reporting_period_days: scalar,
    // Which of the six suggested LEAD_SOURCES the rep left off — computed
    // at write time as "the fixed list minus whatever's in lead_sources",
    // not a separate user input. Custom sources are never "unused" (they
    // were never suggested in the first place), so this only ever names
    // the six fixed values. A CRO gap-check reads this directly instead of
    // reconstructing the diff itself.
    unused_sources: arrayOfScalar,
    // "yes" when deferLeadSources runs — distinguishes "chose I'll pull
    // these later" from "genuinely has no funnel yet" (has_existing_motion
    // === "no"), both of which leave lead_sources empty. Onboarding needs
    // this distinction to resume correctly: a deferred org should land back
    // on the Your funnel screen if they return with real numbers, not be
    // treated as done just because a commitment record exists somewhere.
    deferred: scalar,
  },

  // Minimal for now — a log of generated Awareness scenarios within
  // Playbook modules' IKAP loop, not the full rep[].skill_scores[] scoring
  // system TODOS.md #5 eventually wants. Append-only. This is the
  // "Reinforcement Exercises" TODO #5 says tier-1 platform-native signals
  // are blocked on; wiring it up to real diagnosis is future work, this
  // just gives it something real to read from once that happens.
  //
  // Plain array of scalar strings, not tagged objects with module/step_id
  // — the writes-mapping engine can only extract a single existing
  // answer path per mapping, it can't compose an object from one dynamic
  // field (the ai_generate output) plus hardcoded literals (a "module"/
  // "step_id" name). Same composite-record constraint already hit and
  // punted on during the opp_rate diagnostic work (see TODOS/T5 history);
  // the fix there and here is the same: keep the write target as simple
  // as what the source step can actually produce.
  rep: {
    reinforcement_log: arrayOfScalar,
    // Modeled as an org-scoped append-only log (mode: append, same as
    // reinforcement_log), not a separately user-scoped namespace, per the
    // design handoff's own proposed shape: {agent, subject, promised_on,
    // due, status, user_id} — user_id lives as a field on each entry so a
    // manager can eventually see the team's open commitments in one place,
    // rather than each rep only ever seeing their own. The proactive
    // follow-up loop (email or in-app, still open — see repo-open Q2) reads
    // this; nothing writes to it yet, this is schema ahead of the feature.
    commitments: arrayOf({
      agent: scalar, // "cro" | "vp" | "enable"
      subject: scalar,
      promised_on: scalar,
      due: scalar,
      status: scalar, // "open" | "done" | "missed"
      user_id: scalar,
    }),
  },

  // Written by the Brand onboarding screen (src/app/onboarding, not an
  // exercise) via scrapeBrandKit (src/lib/scrape/firecrawl.ts) — see that
  // function's doc comment for exactly what's genuinely proposable
  // (logo/color_primary have a real signal via page metadata and inline
  // hex frequency; color_secondary/color_accent are a weaker frequency
  // guess; font_heading/font_body have no reliable signal at all and are
  // always left blank for manual entry). logo is a URL string, not an
  // uploaded file — this app has no file storage, so the scraper's
  // already-hosted og:image/favicon URL is used as-is rather than fetching
  // and re-storing the asset. Every Enablement-generated asset is meant to
  // render in these tokens eventually; SAILS appears in the footer only,
  // per the design handoff's own rule. Optional end to end — none of these
  // six fields are required to complete onboarding, same "presence, not
  // value" completion check as team.current_roles.
  org: {
    brand: obj({
      logo: scalar,
      color_primary: scalar,
      color_secondary: scalar,
      color_accent: scalar,
      font_heading: scalar,
      font_body: scalar,
    }),
  },

  // Per-rep IKAP module progress (install/know/awareness/practice status,
  // quiz scores). Deliberately loose (`any`) rather than a precisely
  // modeled shape — the actual IKAP UI doesn't exist yet (quiz step type
  // shipped this session, Install/Awareness content authoring hasn't
  // started), and guessing the exact per-module tracking shape now risks
  // getting it wrong before there's a real screen to validate it against.
  // User-scoped (see USER_SCOPED_NAMESPACES below) — progress is per-rep
  // per the "multi-rep is per-rep" decision, same reasoning as
  // respondent.*.
  progress: {
    ikap: { kind: "any" },
  },

  team: {
    hiring_profile: obj({
      must_haves: arrayOfScalar,
      nice_to_haves: arrayOfScalar,
      hard_disqualifiers: arrayOfScalar,
    }),
    onboarding_plan: { kind: "any" },
    comp_philosophy: scalar,
    interview_scorecard: arrayOf({ competency: scalar, question: scalar }),
    // Drives the "sales-leadership" cross-cutting track tag (recommend.ts).
    // Formerly its own standalone onboarding question (onboarding-
    // diagnostic.yml, now retired); derived instead from current_roles
    // below in saveTeamRoles (src/app/onboarding/actions.ts) — "yes" iff a
    // "sales_leader" role has count > 0 — once asking twice for the same
    // fact would have been redundant.
    has_sales_manager: scalar,
    // Headcount by role, from the bespoke Sales Motion onboarding screen
    // (src/app/onboarding, not an exercise) — only asked when
    // company.has_existing_motion is "yes", same gate as metrics.lead_sources,
    // since a zero-to-one founder has no roles to report yet. `role` is one
    // of TEAM_ROLES (src/lib/onboarding/team.ts) or a slugified custom
    // role, same "fixed list is a UI convenience, not a validated enum"
    // pattern as metrics.lead_sources[].source. has_sales_manager and
    // company.motion above are both derived from this array in
    // saveTeamRoles, not asked as separate questions.
    current_roles: arrayOf({ role: scalar, count: scalar }),
  },
};

/**
 * Reserved for the future Enterprise track (plan §2). No v1 exercise may
 * read/write these — see the `enterprise-namespaces-in-v1-track` validator
 * rule. They exist here only so the resolver recognizes them as *shaped*,
 * not undefined, once that track is actually built.
 */
export const RESERVED_NAMESPACES: Record<string, Record<string, FieldNode>> = {
  buying_committee: {
    roles: arrayOf({ title: scalar, stance: scalar, influence_level: scalar }),
    rules_of_engagement: scalar,
  },
  poc: {
    success_criteria: arrayOfScalar,
    structure: obj({ duration_days: scalar, milestones: arrayOfScalar }),
    readout_notes: scalar,
  },
  procurement: {
    stakeholders: arrayOfScalar,
    negotiation_levers: arrayOfScalar,
    concession_plan: scalar,
  },
  account_map: { stakeholder_grid: scalar, relationship_map: scalar },
  multithreading: {
    active_threads: arrayOf({ persona_ref: scalar, last_touch: scalar, status: scalar }),
  },
};

export const ALL_NAMESPACES: Record<string, Record<string, FieldNode>> = {
  ...NAMESPACES,
  ...RESERVED_NAMESPACES,
};

// Namespaces scoped to an individual user within an org (context_fields.user_id
// set), not the whole org. Everything else defaults to org-scoped
// (user_id null) — see supabase/migrations/0002_user_scoped_context.sql and
// src/lib/context/store.ts. Deliberately a short, explicit allowlist rather
// than inferring scope from field names: getting this wrong in either
// direction is a real bug (a rep's answer either leaking org-wide, or an
// org fact only one rep can see), so it's a conscious per-namespace choice,
// same house style as `has_existing_motion` being explicit rather than
// inferred.
export const USER_SCOPED_NAMESPACES = new Set(["respondent", "progress"]);

// Deal-size tiers — a user has exactly one. "enterprise" is routing/labeling
// only in v1 (no content ships against it yet).
export const TIER_TRACK_SLUGS = ["smb", "mid-market", "enterprise"] as const;

// Cross-cutting modifiers — a user can have zero, one, or both alongside
// their tier. See src/lib/tracks/recommend.ts.
export const MODIFIER_TRACK_SLUGS = ["founder-led", "sales-leadership"] as const;

export const V1_TRACK_SLUGS = [...TIER_TRACK_SLUGS, ...MODIFIER_TRACK_SLUGS] as const;
