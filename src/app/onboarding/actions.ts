"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { writeContext, readContext } from "@/lib/context/store";
import { scrapeBusinessProfile, type BrandKit } from "@/lib/scrape/firecrawl";
import { recommendTrack } from "@/lib/tracks/recommend";
import {
  computeSourceMetrics,
  computeBlended,
  computeUnusedSources,
  REPORTING_PERIOD_DAYS,
  type SourceInput,
} from "@/lib/onboarding/metrics";

const BUSINESS_FIELDS = [
  { name: "name", label: "Company name" },
  { name: "what_you_sell", label: "What they sell, in one or two sentences" },
  { name: "category", label: 'Category (e.g. "B2B sales consulting", "POS software")' },
  { name: "capabilities", label: "Key product capabilities or features, briefly" },
  { name: "proof", label: "Proof points mentioned — case studies, customer logos, testimonials, results" },
  { name: "stage", label: "Company stage or maturity signals (funding stage, team size, how established they seem)" },
];

/**
 * Business bucket, step 1 of 3 — scrape + review, same return-not-throw
 * shape and same "propose, don't assume" contract as scrapeForStep
 * (journey/[slug]/actions.ts). Also proposes the brand kit (logo, colors,
 * fonts) from the same page in the same request — the Business screen
 * shows both together on one review card, so entering a URL once should
 * propose everything readable from it once, not require a second read
 * later for brand. See scrapeBusinessProfile's doc comment for the single-
 * request mechanics.
 */
export async function scrapeBusiness(url: string): Promise<
  | { content: Record<string, string>; brand: BrandKit }
  | { error: string }
> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) return { error: "not authenticated" };

    const trimmed = url.trim();
    if (!trimmed) return { error: "Enter a website URL first." };
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      new URL(normalized);
    } catch {
      return { error: "That doesn't look like a valid URL." };
    }

    const { business, brand } = await scrapeBusinessProfile({ url: normalized, fields: BUSINESS_FIELDS });
    return { content: { ...business, domain: normalized }, brand };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Business bucket, confirm — writes the reviewed (possibly hand-corrected) fields. Same source: 'manual' convention as a Profile edit, since this is a human-confirmed value, not a raw AI/scrape output landing unedited. */
export async function saveBusiness(fields: Record<string, string>) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const writes = Object.keys(fields).map((name) => ({
    from: `answers.${name}`,
    to: `company.${name}`,
    mode: "replace" as const,
  }));

  await writeContext(supabase, user.orgId, user.id, writes, fields, "manual", null);
  revalidatePath("/onboarding");
}

/** You bucket, step 2 — respondent.role. User-scoped (USER_SCOPED_NAMESPACES), so this rep's answer never leaks to another rep at the same org. */
export async function saveRole(role: string) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [{ from: "answers.role", to: "respondent.role", mode: "replace" }],
    { role },
    "manual",
    null
  );
  revalidatePath("/onboarding");
}

/** You bucket, step 3 — respondent.sales_experience. Same user-scoping as saveRole. */
export async function saveExperience(salesExperience: string) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [{ from: "answers.sales_experience", to: "respondent.sales_experience", mode: "replace" }],
    { sales_experience: salesExperience },
    "manual",
    null
  );
  revalidatePath("/onboarding");
}

/**
 * Sales Motion bucket, step 1 — the existing-motion fork. Org-scoped: shared
 * company fact, not per-rep. Gates whether the Team/Metrics screens are even
 * reachable — a zero-to-one founder never sees them.
 *
 * Also derives company.motion ("founder_led" | "team_selling"), one of
 * recommendTrack's scoring inputs (see src/lib/tracks/recommend.ts) that
 * used to come from onboarding-diagnostic.yml's own "How do you sell
 * today?" question. A "no" answer here is trivially founder-led — there's
 * no team yet to sell any other way — so it's set immediately rather than
 * asked again. A "yes" answer gets refined once real headcount is known,
 * in saveTeamRoles below.
 */
export async function saveHasExistingMotion(hasExistingMotion: "yes" | "no") {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const writes = [{ from: "answers.has_existing_motion", to: "company.has_existing_motion", mode: "replace" as const }];
  const answers: Record<string, unknown> = { has_existing_motion: hasExistingMotion };
  if (hasExistingMotion === "no") {
    writes.push({ from: "answers.motion", to: "company.motion", mode: "replace" as const });
    answers.motion = "founder_led";
  }

  await writeContext(supabase, user.orgId, user.id, writes, answers, "manual", null);
  revalidatePath("/onboarding");
}

/**
 * Sales Motion bucket, step 2 — headcount by role. org-scoped (a team
 * roster is a company fact, not a personal one) — only reachable when
 * has_existing_motion is "yes", a zero-to-one founder has no roles to
 * report.
 *
 * Also derives two of onboarding-diagnostic.yml's former routing signals
 * from the same headcount data, rather than asking for them a second time:
 * - team.has_sales_manager: "yes" iff a "sales_leader" role has count > 0.
 *   Previously a standalone yes/no question; now read directly off the
 *   thing it's actually asking about.
 * - company.motion: "team_selling" if any role has count > 0, else
 *   "founder_led" (real revenue, still selling solo). Completes the
 *   derivation started in saveHasExistingMotion above.
 */
export async function saveTeamRoles(roles: { role: string; count: number }[]) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const hasSalesManager = roles.some((r) => r.role === "sales_leader" && r.count > 0) ? "yes" : "no";
  const motion = roles.some((r) => r.count > 0) ? "team_selling" : "founder_led";

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [
      { from: "answers.roles", to: "team.current_roles", mode: "replace" },
      { from: "answers.has_sales_manager", to: "team.has_sales_manager", mode: "replace" },
      { from: "answers.motion", to: "company.motion", mode: "replace" },
    ],
    { roles, has_sales_manager: hasSalesManager, motion },
    "manual",
    null
  );
  revalidatePath("/onboarding");
}

/**
 * Customer bucket, step 1 — who they sell to. Org-scoped. Writes a single
 * primary segment into icp.segments (fixed id "primary", mode: replace) —
 * the same flat shape the icp-segments Journey exercise already produces
 * and every downstream reader (Playbook's "ICP and Tiering" section,
 * objection-bank-builder, buyer-impact-areas, several prompt files) already
 * expects, so nothing else has to change to read this. segment_label is
 * derived from industry rather than asked as its own field — a second
 * "name this segment" question earns its keep once someone is managing
 * multiple segments, not on day one with exactly one.
 *
 * A caller resubmitting this screen (e.g. a future Business Hub edit)
 * always writes id "primary" again, so it updates in place rather than
 * appending a duplicate — but note this is a whole-array replace, so if a
 * deeper Journey/Playbook ICP exercise ever adds segments 2+ via
 * merge_by_key, resubmitting this onboarding screen would wipe them.
 * Fine today (no edit surface exists yet); worth revisiting when one does.
 */
export async function saveCustomerProfile(fields: {
  industry: string;
  companySize: string;
  geography: string;
  buyerTitle: string;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [
      { from: "answers.segments", to: "icp.segments", mode: "replace" },
      { from: "answers.company_size", to: "company.target_customer_size", mode: "replace" },
      { from: "answers.buyer_title", to: "company.buyer_title", mode: "replace" },
    ],
    {
      segments: [
        {
          id: "primary",
          segment_label: fields.industry,
          industry: fields.industry,
          size_range: fields.companySize,
          geography: fields.geography,
        },
      ],
      company_size: fields.companySize,
      buyer_title: fields.buyerTitle,
    },
    "manual",
    null
  );
  revalidatePath("/onboarding");
}

/**
 * Fallback deal-shape screen — only reached when there's no real funnel
 * data to derive acv/cycle_length_days from (has_existing_motion is "no",
 * or the funnel screen was deferred; see OnboardingFlow's hasFunnelData
 * branching). Asks all four routing fields fresh, same as
 * onboarding-diagnostic.yml used to (see that file's header comment) —
 * completing this screen computes and writes company.recommended_tier via
 * recommendTrack, same derivation saveLeadSources runs on the has-real-data
 * path. Whichever of the two runs, it's always the last onboarding step —
 * by the time either fires, acv/cycle/stakeholders/target size/motion/
 * has_sales_manager are all finally known.
 */
export async function saveDealShape(fields: {
  acv: string;
  cycleLengthDays: string;
  stakeholderCount: string;
  procurementInvolved: "yes" | "no";
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const context = await readContext(supabase, user.orgId, user.id, [
    "company.target_customer_size",
    "company.motion",
    "team.has_sales_manager",
  ]);

  const rec = recommendTrack({
    acv: fields.acv,
    cycleLengthDays: fields.cycleLengthDays,
    stakeholderCount: fields.stakeholderCount,
    targetCustomerSize: context["company.target_customer_size"] as string | undefined,
    procurementInvolved: fields.procurementInvolved,
    motion: context["company.motion"] as string | undefined,
    hasSalesManager: context["team.has_sales_manager"] as string | undefined,
  });

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [
      { from: "answers.acv", to: "company.acv", mode: "replace" },
      { from: "answers.cycle_length_days", to: "company.cycle_length_days", mode: "replace" },
      { from: "answers.stakeholder_count", to: "company.stakeholder_count", mode: "replace" },
      { from: "answers.procurement_involved", to: "company.procurement_involved", mode: "replace" },
      { from: "answers.__recommended_tier", to: "company.recommended_tier", mode: "replace" },
    ],
    {
      acv: fields.acv,
      cycle_length_days: fields.cycleLengthDays,
      stakeholder_count: fields.stakeholderCount,
      procurement_involved: fields.procurementInvolved,
      __recommended_tier: rec.tier,
    },
    "manual",
    null
  );
  revalidatePath("/onboarding");
}

/**
 * Business bucket, brand half of the confirm — writes the reviewed
 * (possibly hand-corrected or entirely hand-typed) brand kit. Org-scoped:
 * a company's brand, not a per-rep preference. Called alongside
 * saveBusiness from the same screen's single confirm click, not its own
 * step — see OnboardingFlow's BusinessStep. All six fields are optional —
 * completion is checked by key presence in onboarding/page.tsx, not by any
 * field having a non-empty value, same "presence, not value" reasoning as
 * team.current_roles.
 */
export async function saveBrand(fields: {
  logo: string;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  font_heading: string;
  font_body: string;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [
      { from: "answers.logo", to: "org.brand.logo", mode: "replace" },
      { from: "answers.color_primary", to: "org.brand.color_primary", mode: "replace" },
      { from: "answers.color_secondary", to: "org.brand.color_secondary", mode: "replace" },
      { from: "answers.color_accent", to: "org.brand.color_accent", mode: "replace" },
      { from: "answers.font_heading", to: "org.brand.font_heading", mode: "replace" },
      { from: "answers.font_body", to: "org.brand.font_body", mode: "replace" },
    ],
    fields,
    "manual",
    null
  );
  revalidatePath("/onboarding");
}

/**
 * Sales Motion bucket, funnel screen ("Your funnel"). Only
 * leads/sets/meetings/opportunities/closed_won/arr/cycle_length_days ever
 * reach here as typed input; every rate is recomputed server-side from
 * those counts before writing, same reasoning as computeSourceMetrics'
 * doc comment — the client shows a live preview using the same shared
 * function, but what gets persisted is never the client's number.
 *
 * Also does what saveDealShape used to do for everyone: with real funnel
 * data in hand, company.acv and company.cycle_length_days are DERIVED from
 * the blended numbers (arpa, opportunity-weighted cycle length) rather than
 * asked as a separate question — typing them twice, once here as counts and
 * again as a standalone estimate, was the redundancy this replaced.
 * stakeholder_count/procurement_involved are never covered by funnel data,
 * so they're still asked, just as two fields on this same screen instead of
 * a trailing "Your deal shape" step. company.target_customer_size/motion/
 * team.has_sales_manager are already known by this point in the onboarding
 * order (Customer's "Who you sell to" and Sales Motion both run earlier),
 * so recommendTrack can finish here — "Your deal shape" only still exists
 * as a fallback for orgs that skip or defer this screen (see
 * OnboardingFlow's hasFunnelData branching and saveDealShape below).
 */
export async function saveLeadSources(
  sources: SourceInput[],
  stakeholderCount: string,
  procurementInvolved: "yes" | "no"
) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const computed = sources.map(computeSourceMetrics);
  const blended = computeBlended(computed);
  const unusedSources = computeUnusedSources(sources.map((s) => s.source));

  const context = await readContext(supabase, user.orgId, user.id, [
    "company.target_customer_size",
    "company.motion",
    "team.has_sales_manager",
  ]);
  const acv = String(Math.round(blended.arpa));
  const cycleLengthDays = String(Math.round(blended.blendedCycleDays));
  const rec = recommendTrack({
    acv,
    cycleLengthDays,
    stakeholderCount,
    targetCustomerSize: context["company.target_customer_size"] as string | undefined,
    procurementInvolved,
    motion: context["company.motion"] as string | undefined,
    hasSalesManager: context["team.has_sales_manager"] as string | undefined,
  });

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [
      { from: "answers.lead_sources", to: "metrics.lead_sources", mode: "replace" },
      { from: "answers.velocity", to: "metrics.velocity", mode: "replace" },
      { from: "answers.reporting_period_days", to: "metrics.reporting_period_days", mode: "replace" },
      { from: "answers.unused_sources", to: "metrics.unused_sources", mode: "replace" },
      { from: "answers.acv", to: "company.acv", mode: "replace" },
      { from: "answers.cycle_length_days", to: "company.cycle_length_days", mode: "replace" },
      { from: "answers.stakeholder_count", to: "company.stakeholder_count", mode: "replace" },
      { from: "answers.procurement_involved", to: "company.procurement_involved", mode: "replace" },
      { from: "answers.__recommended_tier", to: "company.recommended_tier", mode: "replace" },
    ],
    {
      lead_sources: computed,
      velocity: blended.velocity,
      reporting_period_days: REPORTING_PERIOD_DAYS,
      unused_sources: unusedSources,
      acv,
      cycle_length_days: cycleLengthDays,
      stakeholder_count: stakeholderCount,
      procurement_involved: procurementInvolved,
      __recommended_tier: rec.tier,
    },
    "manual",
    null
  );
  revalidatePath("/onboarding");
}

/**
 * Sales Motion bucket, funnel screen deferred — "I'll pull these later."
 * Writes a commitment instead of fake data, so the CRO has a real blocked
 * state to point at rather than diagnosing off nothing. Also writes
 * metrics.deferred so onboarding's resume logic can tell "deferred" apart
 * from "has_existing_motion is no" — both leave metrics.lead_sources empty,
 * but only one of them means "Your deal shape" should still run to collect
 * the routing fields this screen didn't get to derive.
 */
export async function deferLeadSources() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const now = new Date().toISOString();
  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [
      { from: "answers.commitment", to: "rep.commitments", mode: "append" },
      { from: "answers.deferred", to: "metrics.deferred", mode: "replace" },
    ],
    {
      deferred: "yes",
      commitment: {
        agent: "cro",
        subject: "Bring your real funnel numbers by lead source",
        promised_on: now,
        due: "",
        status: "open",
        user_id: user.id,
      },
    },
    "manual",
    null
  );
  revalidatePath("/onboarding");
}
