/**
 * The 14-section playbook structure (plan §6), each declaring which context
 * keys it reads. No AI yet — `render()` is a deterministic formatter over
 * whatever's in context, matching the plan's non-AI Phase 2 scope (the
 * "connective prose" AI layer is additive later, gated on
 * ANTHROPIC_API_KEY being set — see CLAUDE.md). Content is markdown-lite
 * (##, -, **bold** only) so it renders reasonably now and is a sane source
 * for DOCX export later without needing a full markdown parser dependency.
 */

type Ctx = Record<string, unknown>;

export type SectionDef = {
  slug: string;
  title: string;
  reads: string[];
  render: (ctx: Ctx) => string;
};

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

function bullet(label: string, value: unknown): string {
  return `- **${label}:** ${value}`;
}

/** Generic fallback for sections with no bespoke template yet — still readable, not a raw JSON dump. */
function renderGeneric(ctx: Ctx, keys: string[]): string {
  const present = keys.filter((k) => !isEmpty(ctx[k]));
  if (present.length === 0) return "";
  return present
    .map((k) => {
      const v = ctx[k];
      const label = k.split(".").slice(1).join(" ").replace(/_/g, " ");
      if (Array.isArray(v)) {
        return `## ${label}\n${v.map((item) => `- ${typeof item === "object" ? JSON.stringify(item) : item}`).join("\n")}`;
      }
      if (typeof v === "object") {
        return `## ${label}\n${Object.entries(v as Record<string, unknown>)
          .map(([k2, v2]) => bullet(k2.replace(/_/g, " "), v2))
          .join("\n")}`;
      }
      return `## ${label}\n${v}`;
    })
    .join("\n\n");
}

type Segment = { segment_label?: string; industry?: string; size_range?: string; geography?: string };
type Persona = { title?: string; role_in_deal?: string; cares_about?: string; day_to_day_pains?: string };
type ImpactArea = { area_name?: string; who_feels_it?: string; metric_affected?: string; cost_if_ignored?: string };
type DiscoveryRow = { row_id?: string; user_questions?: string };
type OutboundTouch = {
  row_id?: string;
  subject_line?: string;
  trigger?: string;
  current_state?: string;
  ideal_state?: string;
  cta?: string;
};
type PersonalizationSignal = { signal?: string; angle?: string };

const FOCUS_LABELS: Record<string, string> = {
  facts: "Facts",
  objectives: "Objectives",
  complications: "Complications",
  uncovering_impact: "Uncovering Impact",
  stakes: "Stakes",
};
const FOCUS_ORDER = ["facts", "objectives", "complications", "uncovering_impact", "stakes"];

const TOUCH_LABELS: Record<string, string> = {
  touch_1: "Touch 1 — Establish Your POV (Day 1)",
  touch_2: "Touch 2 — Add Depth (Day 5)",
  touch_3: "Touch 3 — Social Proof (Day 12)",
  touch_4: "Touch 4 — Lower the Barrier (Day 22)",
  touch_5: "Touch 5 — Permission to Exit (Day 30)",
};
const TOUCH_ORDER = ["touch_1", "touch_2", "touch_3", "touch_4", "touch_5"];

export const PLAYBOOK_SECTIONS: SectionDef[] = [
  {
    slug: "how-to-use",
    title: "1. How to Use This Playbook",
    reads: ["company.name", "company.product_name", "company.recommended_tier"],
    render: (ctx) => {
      const name = ctx["company.name"] as string | undefined;
      const tier = ctx["company.recommended_tier"] as string | undefined;
      if (!name) return "";
      return [
        `This is ${name}'s living sales playbook — built from the exercises your team has completed, not written from a template.`,
        tier ? `Your recommended track: **${tier}**.` : "",
        "Every section below traces back to a specific exercise. When you update an answer, the sections that depend on it are flagged stale so you know to regenerate them — nothing goes silently out of date.",
      ]
        .filter(Boolean)
        .join("\n\n");
    },
  },
  {
    slug: "icp-and-tiering",
    title: "2. ICP and Tiering",
    reads: ["icp.segments"],
    render: (ctx) => {
      const segments = (ctx["icp.segments"] as Segment[]) ?? [];
      if (segments.length === 0) return "";
      return segments
        .map(
          (s) =>
            `## ${s.segment_label ?? "Segment"}\n${bullet("Industry", s.industry ?? "—")}\n${bullet("Company size", s.size_range ?? "—")}\n${bullet("Geography", s.geography ?? "—")}`
        )
        .join("\n\n");
    },
  },
  {
    slug: "personas-and-buyer-roles",
    title: "3. Personas and Buyer Roles",
    reads: ["personas.personas"],
    render: (ctx) => {
      const personas = (ctx["personas.personas"] as Persona[]) ?? [];
      if (personas.length === 0) return "";
      return personas
        .map(
          (p) =>
            `## ${p.title ?? "Persona"} (${(p.role_in_deal ?? "").replace(/_/g, " ")})\n${bullet("Cares about", p.cares_about ?? "—")}\n${bullet("Day-to-day pains", p.day_to_day_pains ?? "—")}`
        )
        .join("\n\n");
    },
  },
  {
    slug: "pain-tree-and-cost-of-inaction",
    title: "4. Pain Tree and Cost of Inaction",
    reads: ["pain_tree.impact_areas", "pain_tree.topics", "pain_tree.cost_of_inaction_estimate"],
    render: (ctx) => {
      const areas = (ctx["pain_tree.impact_areas"] as ImpactArea[]) ?? [];
      const estimate = ctx["pain_tree.cost_of_inaction_estimate"] as number | undefined;
      if (areas.length === 0 && estimate == null) return "";
      const areasText = areas
        .map(
          (a) =>
            `## ${a.area_name ?? "Impact area"}\n${bullet("Who feels it", a.who_feels_it ?? "—")}\n${bullet("Metric affected", a.metric_affected ?? "—")}\n${bullet("Cost if ignored", a.cost_if_ignored ?? "—")}`
        )
        .join("\n\n");
      const estimateText = estimate != null ? `## Estimated Annual Cost of Inaction\n**$${Number(estimate).toLocaleString()}**` : "";
      return [areasText, estimateText].filter(Boolean).join("\n\n");
    },
  },
  {
    slug: "messaging-and-pov",
    title: "5. Messaging and POV",
    reads: [
      "messaging.pov_statement",
      "messaging.problem_statements",
      "messaging.soundbites",
      "messaging.value_map",
      "messaging.proof_points",
      "messaging.no_logo_pitch",
    ],
    render: (ctx) =>
      renderGeneric(ctx, [
        "messaging.pov_statement",
        "messaging.problem_statements",
        "messaging.soundbites",
        "messaging.value_map",
        "messaging.proof_points",
        "messaging.no_logo_pitch",
      ]),
  },
  {
    slug: "outbound-system",
    title: "6. Lead Sources and Outbound System",
    reads: ["outbound.sequences", "outbound.channels", "outbound.personalization_map", "outbound.list_strategy"],
    render: (ctx) => {
      const touches = (ctx["outbound.sequences"] as OutboundTouch[]) ?? [];
      const rest = renderGeneric(ctx, ["outbound.list_strategy"]);
      if (touches.length === 0) {
        const fallback = renderGeneric(ctx, ["outbound.channels", "outbound.personalization_map"]);
        return [fallback, rest].filter(Boolean).join("\n\n");
      }

      const channels = ctx["outbound.channels"] as string[] | undefined;
      const channelsText =
        channels && channels.length > 0 ? `## Channels\n${channels.map((c) => `- ${c}`).join("\n")}` : "";

      const byRowId = new Map(touches.map((t) => [t.row_id, t]));
      const touchesText = TOUCH_ORDER.filter((id) => byRowId.has(id))
        .map((id) => {
          const t = byRowId.get(id)!;
          return [
            `## ${TOUCH_LABELS[id]}`,
            t.subject_line ? bullet("Subject line", t.subject_line) : "",
            t.trigger ? bullet("Trigger", t.trigger) : "",
            t.current_state ? bullet("Current state", t.current_state) : "",
            t.ideal_state ? bullet("Ideal state", t.ideal_state) : "",
            t.cta ? bullet("CTA", t.cta) : "",
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");

      const signals = (ctx["outbound.personalization_map"] as PersonalizationSignal[]) ?? [];
      const signalsText =
        signals.length > 0
          ? `## Signal-Based Personalization\n${signals
              .filter((s) => s.signal)
              .map((s) => bullet(s.signal!, s.angle ?? "—"))
              .join("\n")}`
          : "";

      return [channelsText, touchesText, signalsText, rest].filter(Boolean).join("\n\n");
    },
  },
  {
    slug: "intro-call-framework",
    title: "7. Intro Call Framework",
    reads: ["process.discovery_framework"],
    render: (ctx) => renderGeneric(ctx, ["process.discovery_framework"]),
  },
  {
    slug: "discovery-framework",
    title: "8. Discovery Framework",
    // process.discovery_script (written by discovery-focus-builder) is the
    // real, already-populated FOCUS question bank — process.discovery_framework
    // is a richer shape nothing has ever written to yet (see its own
    // namespace comment). Reads both so this section starts rendering the
    // moment the FOCUS exercise is done, without waiting on a
    // discovery_framework-writing exercise that does not exist.
    reads: ["process.discovery_script", "process.discovery_framework", "pain_tree.topics"],
    render: (ctx) => {
      const rows = (ctx["process.discovery_script"] as DiscoveryRow[]) ?? [];
      if (rows.length === 0) return renderGeneric(ctx, ["process.discovery_framework", "pain_tree.topics"]);
      const byRowId = new Map(rows.map((r) => [r.row_id, r]));
      const focusText = FOCUS_ORDER.filter((id) => byRowId.get(id)?.user_questions)
        .map((id) => `## ${FOCUS_LABELS[id]}\n${byRowId.get(id)!.user_questions}`)
        .join("\n\n");
      const rest = renderGeneric(ctx, ["process.discovery_framework", "pain_tree.topics"]);
      return [focusText, rest].filter(Boolean).join("\n\n");
    },
  },
  {
    slug: "demo-framework",
    title: "9. Demo Framework",
    reads: ["process.demo_narrative", "process.bridge", "messaging.value_map"],
    render: (ctx) => renderGeneric(ctx, ["process.demo_narrative", "process.bridge", "messaging.value_map"]),
  },
  {
    slug: "objection-handling",
    title: "10. Objection Handling",
    reads: ["objections.objections"],
    render: (ctx) => {
      const objections = (ctx["objections.objections"] as { objection_text?: string; category?: string; reframe?: string; talk_track?: string }[]) ?? [];
      if (objections.length === 0) return "";
      return objections
        .map(
          (o) =>
            `## "${o.objection_text ?? "Objection"}"\n${bullet("Category", o.category ?? "—")}\n${bullet("Reframe", o.reframe ?? "—")}\n${bullet("Talk track", o.talk_track ?? "—")}`
        )
        .join("\n\n");
    },
  },
  {
    slug: "closing-motion",
    title: "11. Closing Motion",
    reads: ["process.closing_motion"],
    render: (ctx) => renderGeneric(ctx, ["process.closing_motion"]),
  },
  {
    slug: "sales-process-and-stages",
    title: "12. Sales Process and Stages",
    reads: ["process.stages", "process.qualification_framework"],
    render: (ctx) => {
      const stages = (ctx["process.stages"] as { stage_name?: string; definition?: string; entry_criteria?: string; exit_criteria?: string; typical_duration?: string }[]) ?? [];
      if (stages.length === 0) return renderGeneric(ctx, ["process.qualification_framework"]);
      const stageText = stages
        .map(
          (s, i) =>
            `## ${i + 1}. ${s.stage_name ?? "Stage"}\n${s.definition ?? ""}\n${bullet("Entry", s.entry_criteria ?? "—")}\n${bullet("Exit", s.exit_criteria ?? "—")}\n${bullet("Typical duration", s.typical_duration ?? "—")}`
        )
        .join("\n\n");
      const qual = renderGeneric(ctx, ["process.qualification_framework"]);
      return [stageText, qual].filter(Boolean).join("\n\n");
    },
  },
  {
    slug: "meeting-cadence-and-kpis",
    title: "13. Meeting Cadence and KPIs",
    reads: ["cadence.meetings", "cadence.kpis", "cadence.pipeline_math"],
    render: (ctx) => renderGeneric(ctx, ["cadence.meetings", "cadence.kpis", "cadence.pipeline_math"]),
  },
  {
    slug: "team",
    title: "14. Team: Hiring, Onboarding, Operating Rhythm",
    reads: ["team.hiring_profile", "team.onboarding_plan", "team.comp_philosophy", "team.interview_scorecard"],
    render: (ctx) =>
      renderGeneric(ctx, ["team.hiring_profile", "team.onboarding_plan", "team.comp_philosophy", "team.interview_scorecard"]),
  },
];
