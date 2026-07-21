"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { loadExercises } from "@/lib/content/loader";
import { writeContext } from "@/lib/context/store";

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

  revalidatePath("/journey");
  revalidatePath("/profile");
}
