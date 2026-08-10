"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { loadExercises } from "@/lib/content/loader";
import { writeContext, readContext } from "@/lib/context/store";
import { generateSuggestions } from "@/lib/ai/suggest";
import { generateContent } from "@/lib/ai/generate";
import { reviewContent } from "@/lib/ai/review";
import { scrapeAndExtract } from "@/lib/scrape/firecrawl";

/**
 * Autosave for in-progress exercise answers — otherwise nothing persists
 * before the final submit (a closed tab mid-onboarding loses everything
 * typed). Fires on every field change, debounced client-side in
 * ExerciseForm. Deliberately partial: never touches status/completed_at,
 * never writes context — that's still submitExercise's job alone. Scoped to
 * `status: "in_progress"` so it can't reach back and mutate an already-
 * completed session, and silently no-ops on failure — a dropped autosave
 * shouldn't interrupt someone mid-thought, the next successful save or the
 * final submit catches up regardless.
 */
export async function saveProgress(sessionId: string, answers: Record<string, unknown>) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return;

  await supabase
    .from("exercise_sessions")
    .update({ answers })
    .eq("id", sessionId)
    .eq("org_id", user.orgId)
    .eq("status", "in_progress");
}

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

  await writeContext(supabase, user.orgId, user.id, exercise.writes, answers, "exercise", sessionId);

  // Tier recommendation used to be computed here as a special case tied to
  // completing onboarding-diagnostic. That exercise is retired (see its
  // header comment) and unreachable from the UI now, so this special case
  // is gone — recommendTrack runs instead inside the bespoke onboarding
  // flow itself, in src/app/onboarding/actions.ts's saveDealShape.

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
    const context = await readContext(supabase, user.orgId, user.id, step.suggest.reads);

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

/**
 * Powers the ai_generate step renderer (AiGenerateField). Same
 * return-not-throw shape as suggestForStep, and the same reason: Next.js
 * redacts thrown Server Action errors to a generic digest in production.
 * Never writes anything — the generated value only reaches context if the
 * user keeps/edits it and submits the exercise, same as any other step's
 * answer (Exercise Schema §6/§9, CLAUDE.md rule 5).
 */
export async function generateForStep(
  exerciseSlug: string,
  stepId: string
): Promise<{ content: Record<string, string> } | { error: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) return { error: "not authenticated" };

    const exercise = loadExercises().find((e) => e.data.slug === exerciseSlug)?.data;
    if (!exercise) return { error: `unknown exercise "${exerciseSlug}"` };

    const step = exercise.steps.find((s) => "id" in s && s.id === stepId);
    if (!step || step.type !== "ai_generate") {
      return { error: `step "${stepId}" is not an ai_generate step` };
    }

    const context = await readContext(supabase, user.orgId, user.id, step.reads ?? []);
    const fields = step.fields ?? [{ name: "content", label: "Content" }];

    const content = await generateContent({
      promptRef: step.prompt_ref,
      context,
      fields: fields.map((f) => ({ name: f.name, label: f.label })),
    });
    return { content };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Powers the ai_review panel (AiReviewPanel). Same return-not-throw shape as
 * suggestForStep/generateForStep. ai_review has no `id` of its own (Exercise
 * Schema: it never writes, so nothing needs to name it as a writes target) —
 * looked up by `reviews_step` instead, the id of the step it critiques,
 * assumed unique per exercise. `currentAnswer` is the reviewed step's
 * in-progress value from the client's own form state, not readContext: that
 * step has not been submitted yet, so there is nothing in context to read.
 */
export async function reviewForStep(
  exerciseSlug: string,
  reviewsStepId: string,
  currentAnswer: unknown
): Promise<{ critique: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) return { error: "not authenticated" };

    const exercise = loadExercises().find((e) => e.data.slug === exerciseSlug)?.data;
    if (!exercise) return { error: `unknown exercise "${exerciseSlug}"` };

    const step = exercise.steps.find((s) => s.type === "ai_review" && s.reviews_step === reviewsStepId);
    if (!step || step.type !== "ai_review") return { error: `no ai_review step reviews "${reviewsStepId}"` };

    const context = await readContext(supabase, user.orgId, user.id, exercise.reads);

    const critique = await reviewContent({
      promptRef: step.prompt_ref,
      context,
      answers: { [reviewsStepId]: currentAnswer },
    });
    return { critique };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Powers the url_scrape step renderer. Same return-not-throw shape and same
 * "never writes directly" contract as generateForStep — the scraped/edited
 * value only reaches context if the user submits the exercise.
 */
export async function scrapeForStep(
  exerciseSlug: string,
  stepId: string,
  url: string
): Promise<{ content: Record<string, string> } | { error: string }> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) return { error: "not authenticated" };

    const exercise = loadExercises().find((e) => e.data.slug === exerciseSlug)?.data;
    if (!exercise) return { error: `unknown exercise "${exerciseSlug}"` };

    const step = exercise.steps.find((s) => "id" in s && s.id === stepId);
    if (!step || step.type !== "url_scrape") {
      return { error: `step "${stepId}" is not a url_scrape step` };
    }

    const trimmed = url.trim();
    if (!trimmed) return { error: "Enter a website URL first." };
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      new URL(normalized);
    } catch {
      return { error: "That doesn't look like a valid URL." };
    }

    const content = await scrapeAndExtract({
      url: normalized,
      fields: step.fields.map((f) => ({ name: f.name, label: f.label })),
    });
    return { content };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
