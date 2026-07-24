"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { loadExercises } from "@/lib/content/loader";
import { writeContext, readContext } from "@/lib/context/store";
import { recommendTrack } from "@/lib/tracks/recommend";
import { generateSuggestions } from "@/lib/ai/suggest";

export async function submitExercise(
  sessionId: string,
  exerciseSlug: string,
  answers: Record<string, unknown>
) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const exercise = loadExercises().find((e) => e.data.slug === exerciseSlug)?.data;
  if (!exercise) throw new Error(`unknown exercise "${exerciseSlug}"`);

  const { error } = await supabase
    .from("exercise_sessions")
    .update({ answers, status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("org_id", user.orgId);
  if (error) throw error;

  await writeContext(supabase, user.orgId, exercise.writes, answers, "exercise", sessionId);

  // The diagnostic is the one exercise whose completion also computes a
  // derived value (a tier recommendation across several fields) rather than
  // just mapping answers straight through — see recommendTrack's doc
  // comment for why that logic lives here and not in the exercise's own
  // `writes` mapping.
  if (exerciseSlug === "onboarding-diagnostic") {
    const rec = recommendTrack({
      acv: answers.acv as string,
      cycleLengthDays: answers.cycle_length as string,
      stakeholderCount: answers.stakeholder_count as string,
      targetCustomerSize: answers.target_customer_size as string,
      procurementInvolved: answers.procurement_involved as string,
      motion: answers.motion as string,
      hasSalesManager: answers.has_sales_manager as string,
    });
    await writeContext(
      supabase,
      user.orgId,
      [{ from: "answers.__recommended_tier", to: "company.recommended_tier", mode: "replace" }],
      { __recommended_tier: rec.tier },
      "exercise",
      sessionId
    );
  }

  revalidatePath("/journey");
  revalidatePath("/profile");
}

/**
 * Powers the AI-suggestions panel on input_list / dynamic input_table steps
 * (AiSuggestPanel). Returns a result object rather than throwing — Next.js
 * redacts thrown Server Action error messages in production builds down to
 * a generic "An error occurred" digest, so an expected, user-facing error
 * (no API key configured, bad prompt_ref) would never reach the panel.
 */
export async function suggestForStep(
  exerciseSlug: string,
  stepId: string,
  existingItems: Record<string, string>[]
): Promise<{ suggestions: Record<string, string>[] } | { error: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) return { error: "not authenticated" };

    const exercise = loadExercises().find((e) => e.data.slug === exerciseSlug)?.data;
    if (!exercise) return { error: `unknown exercise "${exerciseSlug}"` };

    const step = exercise.steps.find((s) => "id" in s && s.id === stepId);
    if (!step || !("suggest" in step) || !step.suggest) {
      return { error: `step "${stepId}" has no AI suggestions configured` };
    }

    const fields = step.type === "input_list" ? step.fields : step.type === "input_table" ? step.columns : [];
    const context = await readContext(supabase, user.orgId, step.suggest.reads);

    const suggestions = await generateSuggestions({
      promptRef: step.suggest.prompt_ref,
      count: step.suggest.count,
      context,
      existing: existingItems,
      fields: fields.map((f) => ({ name: f.name, label: f.label })),
    });
    return { suggestions };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
