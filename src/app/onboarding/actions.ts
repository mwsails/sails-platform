"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { writeContext } from "@/lib/context/store";
import { scrapeAndExtract } from "@/lib/scrape/firecrawl";

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
