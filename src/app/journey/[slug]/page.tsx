import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { loadExercises } from "@/lib/content/loader";
import { readContext } from "@/lib/context/store";
import { getOrCreateSession } from "@/lib/exercises/session";
import { ExerciseForm } from "./ExerciseForm";
import { ArrowRightIcon, CheckCircleIcon } from "@/components/icons";

export default async function ExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const exercise = loadExercises().find((e) => e.data.slug === slug)?.data;
  if (!exercise) notFound();

  const session = await getOrCreateSession(supabase, user.orgId, user.id, slug);
  const context = await readContext(supabase, user.orgId, user.id, exercise.reads);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/journey"
        className="inline-flex items-center gap-1 text-sm text-muted transition-colors duration-150 hover:text-[var(--sails-blue)]"
      >
        <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
        CRO
      </Link>
      <p className="mt-4 text-sm text-muted">{exercise.time_estimate}</p>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-[var(--foreground)]">
        {exercise.title}
      </h1>

      {session.status === "completed" ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-[var(--sails-blue-light)] p-4 text-sm text-[var(--foreground)]">
          <CheckCircleIcon className="h-5 w-5 shrink-0 text-[var(--sails-blue)]" />
          You&apos;ve completed this exercise.
        </div>
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
