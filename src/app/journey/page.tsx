import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTracks, loadModules, loadExercises } from "@/lib/content/loader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";

export default async function JourneyPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const tracks = loadTracks();
  const modules = loadModules();
  const exercises = loadExercises();

  const { data: sessions } = await supabase
    .from("exercise_sessions")
    .select("exercise_slug, status")
    .eq("org_id", user.orgId)
    .eq("status", "completed");
  const completedSlugs = new Set((sessions ?? []).map((s) => s.exercise_slug));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--sails-navy)]">Journey</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Complete exercises in order — each one builds on what the last one wrote to your profile.
      </p>

      {tracks.map(({ data: track }) => (
        <section key={track.slug} className="mt-8">
          <h2 className="text-lg font-medium text-[var(--sails-navy)]">{track.title}</h2>
          <p className="mt-1 text-sm text-neutral-600">{track.description}</p>

          {modules
            .filter((m) => m.data.tracks.includes(track.slug))
            .sort((a, b) => a.data.order - b.data.order)
            .map(({ data: mod }) => (
              <div key={mod.slug} className="mt-4 rounded-lg border border-neutral-200 p-4">
                <h3 className="font-medium">{mod.title}</h3>
                <ul className="mt-2 space-y-2">
                  {exercises
                    .filter((e) => e.data.module === mod.slug)
                    .map(({ data: ex }) => {
                      const done = completedSlugs.has(ex.slug);
                      return (
                        <li key={ex.slug}>
                          <Link
                            href={`/journey/${ex.slug}`}
                            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-[var(--sails-gray)]"
                          >
                            <span className={done ? "text-neutral-400 line-through" : ""}>{ex.title}</span>
                            <span className="text-neutral-400">{done ? "Done" : ex.time_estimate}</span>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
        </section>
      ))}
    </main>
  );
}
