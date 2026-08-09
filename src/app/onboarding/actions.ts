"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { writeContext } from "@/lib/context/store";
import { scrapeAndExtract } from "@/lib/scrape/firecrawl";
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
 * (journey/[slug]/actions.ts). Not that function reused directly: this
 * screen isn't an exercise step, it's the bespoke onboarding shell, but the
 * underlying scrapeAndExtract call and error handling are identical.
 */
export async function scrapeBusiness(
  url: string
): Promise<{ content: Record<string, string> } | { error: string }> {
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

    const content = await scrapeAndExtract({ url: normalized, fields: BUSINESS_FIELDS });
    return { content: { ...content, domain: normalized } };
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

/** Sales Motion bucket, step 1 — the existing-motion fork. Org-scoped: shared company fact, not per-rep. Gates whether the Metrics screen is even reachable — a zero-to-one founder never sees it. */
export async function saveHasExistingMotion(hasExistingMotion: "yes" | "no") {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [{ from: "answers.has_existing_motion", to: "company.has_existing_motion", mode: "replace" }],
    { has_existing_motion: hasExistingMotion },
    "manual",
    null
  );
  revalidatePath("/onboarding");
}

/**
 * Sales Motion bucket, step 2 — the funnel-by-source screen. Only
 * leads/sets/meetings/opportunities/closed_won/arr/cycle_length_days ever
 * reach here as typed input; every rate is recomputed server-side from
 * those counts before writing, same reasoning as computeSourceMetrics'
 * doc comment — the client shows a live preview using the same shared
 * function, but what gets persisted is never the client's number.
 */
export async function saveLeadSources(sources: SourceInput[]) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const computed = sources.map(computeSourceMetrics);
  const blended = computeBlended(computed);
  const unusedSources = computeUnusedSources(sources.map((s) => s.source));

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [
      { from: "answers.lead_sources", to: "metrics.lead_sources", mode: "replace" },
      { from: "answers.velocity", to: "metrics.velocity", mode: "replace" },
      { from: "answers.reporting_period_days", to: "metrics.reporting_period_days", mode: "replace" },
      { from: "answers.unused_sources", to: "metrics.unused_sources", mode: "replace" },
    ],
    {
      lead_sources: computed,
      velocity: blended.velocity,
      reporting_period_days: REPORTING_PERIOD_DAYS,
      unused_sources: unusedSources,
    },
    "manual",
    null
  );
  revalidatePath("/onboarding");
}

/** Sales Motion bucket, step 2 deferred — "I'll pull these later." Writes a commitment instead of fake data, so the CRO has a real blocked state to point at rather than diagnosing off nothing. */
export async function deferLeadSources() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const now = new Date().toISOString();
  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [{ from: "answers.commitment", to: "rep.commitments", mode: "append" }],
    {
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
