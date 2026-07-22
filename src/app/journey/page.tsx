import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTracks, loadModules, loadExercises } from "@/lib/content/loader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { readContext } from "@/lib/context/store";
import { applicableTracks, type Tier } from "@/lib/tracks/recommend";

export default async function JourneyPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const tracks = loadTracks();
  const modules = loadModules();
  const exercises = loadExercises();

  const [{ data: sessions }, context] = await Promise.all([
    supabase
      .from("exercise_sessions")
      .select("exercise_slug, status")
      .eq("org_id", user.orgId)
      .eq("status", "completed"),
    readContext(supabase, user.orgId, [
      "company.recommended_tier",
      "company.motion",
      "team.has_sales_manager",
    ]),
  ]);
  const completedSlugs = new Set((sessions ?? []).map((s) => s.exercise_slug));

  const orientationModule = modules.find((m) => m.data.slug === "orientation-diagnostic");
  const diagnosticDone = completedSlugs.has("onboarding-diagnostic");
  const tier = context["company.recommended_tier"] as Tier | undefined;

  const applicable = tier
    ? applicableTracks({
        tier,
        founderLed: context["company.motion"] === "founder_led",
        hasSalesManager: context["team.has_sales_manager"] === "yes",
      })
    : [];

  function renderModule(mod: (typeof modules)[number]["data"]) {
    return (
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
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--sails-navy)]">Journey</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Complete exercises in order — each one builds on what the last one wrote to your profile.
      </p>

      {tier && (
        <p className="mt-4 rounded-md bg-[var(--sails-gray)] px-3 py-2 text-sm text-[var(--sails-navy)]">
          Recommended for you: <strong>{tracks.find((t) => t.data.slug === tier)?.data.title ?? tier}</strong>.
          Change this anytime on your{" "}
          <Link href="/profile" className="text-[var(--sails-blue)] hover:underline">
            Profile
          </Link>{" "}
          page (<code>company.recommended_tier</code>).
        </p>
      )}

      {orientationModule && renderModule(orientationModule.data)}

      {!diagnosticDone && (
        <p className="mt-4 text-sm text-neutral-400">
          Complete your diagnostic above to unlock the rest of your personalized journey.
        </p>
      )}

      {diagnosticDone && !tier && (
        <p className="mt-4 text-sm text-neutral-400">
          We don&apos;t have a track recommendation for you yet — redo the diagnostic above to
          get one.
        </p>
      )}

      {diagnosticDone && tier === "enterprise" && (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-4">
          <h2 className="font-medium text-[var(--sails-navy)]">Enterprise Motion — coming soon</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Your deals look enterprise-complexity (formal buying committee, procurement review,
            longer cycles). We haven&apos;t built Enterprise-specific content yet. In the
            meantime, the Mid-Market exercises below are the closest fit — expect to adapt them
            upward for your buying committee and procurement process.
          </p>
          {modules
            .filter((m) => m.data.slug !== "orientation-diagnostic" && m.data.tracks.includes("mid-market"))
            .sort((a, b) => a.data.order - b.data.order)
            .map((m) => renderModule(m.data))}
        </div>
      )}

      {diagnosticDone && tier && tier !== "enterprise" && (
        <>
          {modules
            .filter((m) => m.data.slug !== "orientation-diagnostic" && m.data.tracks.some((t) => applicable.includes(t)))
            .sort((a, b) => a.data.order - b.data.order)
            .map((m) => renderModule(m.data))}
        </>
      )}
    </main>
  );
}
