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
    acv: scalar,
    cycle_length_days: scalar,
    motion: scalar,
    team_size: scalar,
    stakeholder_count: scalar,
    // Added for SMB/Mid-Market/Enterprise tier routing (recommend.ts) —
    // target_customer_size/procurement_involved/buyer_title feed the score;
    // total_revenue is context/coaching-depth only, deliberately NOT used
    // for routing (revenue doesn't reliably predict deal motion — a $50M
    // company can still run small transactional deals).
    target_customer_size: scalar,
    procurement_involved: scalar,
    buyer_title: scalar,
    total_revenue: scalar,
    // Explicit, not inferred from team_size — a solo founder can still have
    // real closed deals and real funnel numbers, and a team of 3 can be six
    // months old with nothing to report yet. Gates whether metrics.* and
    // the opp_rate Diagnostic Intake Layer are even asked (see
    // opp-rate-check.yml's requires) instead of asking a founder for a
    // conversion rate on zero meetings.
    has_existing_motion: scalar, // "yes" | "no"
    // Written by recommend.ts, not by the diagnostic exercise directly —
    // the one tier-deciding field every other namespace/module keys off.
    recommended_tier: scalar,
  },

  // Who is answering, not what the business is — orthogonal to company.*.
  // A sales leader and an individual rep at the same company should see
  // different depth; someone with extensive experience should be able to
  // skip straight to Practice on a framework they already know instead of
  // sitting through Install/Know every time. Collected in onboarding,
  // ahead of Foundation, since it colors every screen after.
  respondent: {
    role: scalar, // "founder" | "sales_leader" | "rep" | "other"
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
    has_sales_manager: scalar,
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

// Deal-size tiers — a user has exactly one. "enterprise" is routing/labeling
// only in v1 (no content ships against it yet).
export const TIER_TRACK_SLUGS = ["smb", "mid-market", "enterprise"] as const;

// Cross-cutting modifiers — a user can have zero, one, or both alongside
// their tier. See src/lib/tracks/recommend.ts.
export const MODIFIER_TRACK_SLUGS = ["founder-led", "sales-leadership"] as const;

export const V1_TRACK_SLUGS = [...TIER_TRACK_SLUGS, ...MODIFIER_TRACK_SLUGS] as const;
