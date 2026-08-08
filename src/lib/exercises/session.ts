import type { SupabaseClient } from "@supabase/supabase-js";

export type ExerciseSession = {
  id: string;
  exercise_slug: string;
  status: "in_progress" | "completed";
  answers: Record<string, unknown>;
};

/** Multiple sessions per exercise are allowed (redo keeps history, plan §3) — this resumes the newest in-progress one rather than always starting fresh. */
export async function getOrCreateSession(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  exerciseSlug: string
): Promise<ExerciseSession> {
  const { data: existing } = await supabase
    .from("exercise_sessions")
    .select("id, exercise_slug, status, answers")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("exercise_slug", exerciseSlug)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as ExerciseSession;

  const { data: created, error } = await supabase
    .from("exercise_sessions")
    .insert({ org_id: orgId, user_id: userId, exercise_slug: exerciseSlug, answers: {} })
    .select("id, exercise_slug, status, answers")
    .single();
  if (error) throw error;
  return created as ExerciseSession;
}
