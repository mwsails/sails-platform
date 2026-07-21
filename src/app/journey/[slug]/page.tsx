import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { loadExercises } from "@/lib/content/loader";
import { readContext } from "@/lib/context/store";
import { getOrCreateSession } from "@/lib/exercises/session";
import { ExerciseForm } from "./ExerciseForm";

export default async function ExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const exercise = loadExercises().find((e) => e.data.slug === slug)?.data;
  if (!exercise) notFound();

  const session = await getOrCreateSession(supabase, user.orgId, user.id, slug);
  const context = await readContext(supabase, user.orgId, exercise.reads);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm text-neutral-400">{exercise.time_estimate}</p>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-[var(--sails-navy)]">
        {exercise.title}
      </h1>

      {session.status === "completed" ? (
        <p className="mt-6 rounded-lg bg-[var(--sails-gray)] p-4 text-sm text-[var(--sails-navy)]">
          You&apos;ve completed this exercise.
        </p>
      ) : (
        <ExerciseForm
          exercise={exercise}
          sessionId={session.id}
          initialAnswers={session.answers}
          context={context}
        />
      )}
    </main>
  );
}
