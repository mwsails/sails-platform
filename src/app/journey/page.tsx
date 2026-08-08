import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTracks, loadModules, loadExercises } from "@/lib/content/loader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { readContext } from "@/lib/context/store";
import { applicableTracks, type Tier } from "@/lib/tracks/recommend";
import {
  CheckCircleIcon,
  CircleIcon,
  ChevronRightIcon,
  CompassIcon,
  TargetIcon,
  SparkleIcon,
  UsersIcon,
  ChartBarIcon,
} from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

const MODULE_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "orientation-diagnostic": CompassIcon,
  "icp-tiering": TargetIcon,
  "messaging-foundation": SparkleIcon,
  "personas-buyer-roles": UsersIcon,
  "sales-process-fundamentals": ChartBarIcon,
};

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
    readContext(supabase, user.orgId, user.id, [
      "company.recommended_tier",
      "company.motion",
      "company.has_existing_motion",
      "team.has_sales_manager",
      "metrics.diagnosis",
    ]),
  ]);
  const completedSlugs = new Set((sessions ?? []).map((s) => s.exercise_slug));

  // metrics.diagnosis is append-only (Exercise Schema §5) — the most recent
  // entry per metric is what's actionable now, older ones are history.
  const diagnoses = (context["metrics.diagnosis"] as
    | { metric: string; cause: string; confidence: string; reasoning: string }[]
    | undefined) ?? [];
  const latestOppRateDiagnosis = [...diagnoses].reverse().find((d) => d.metric === "opp_rate");
  const CAUSE_NEXT_STEP: Record<string, { slug: string; label: string } | undefined> = {
    discovery_depth: { slug: "discovery-focus-builder", label: "Build your FOCUS discovery script" },
    single_threading: { slug: "champion-strength-check", label: "Check your champion's strength" },
    qualification_handoff: { slug: "process-stages-builder", label: "Define your pipeline stages" },
  };
  // Keeps rep-coachable behavior gaps (fixable by the individual in their
  // next calls) visually distinct from team/process gaps (fixable only by
  // changing how the team operates) so the two never read as the same kind
  // of fix. Derived from `cause`, not stored on the diagnosis record or
  // asked of the model: the causes are already a closed, prompt-defined
  // enum (see diagnose-opp-rate.md), so this is a deterministic lookup,
  // same precedent as CAUSE_NEXT_STEP above and recommendTrack's tier score.
  const CAUSE_LEVEL: Record<string, { label: string; framing: string } | undefined> = {
    discovery_depth: { label: "Individual coaching", framing: "This is on you to fix in your next calls." },
    single_threading: { label: "Individual coaching", framing: "This is on you to fix in your next calls." },
    qualification_handoff: {
      label: "Team process",
      framing: "This is a process gap worth raising with your team, not something to fix solo.",
    },
  };

  const orientationModule = modules.find((m) => m.data.slug === "orientation-diagnostic");
  const diagnosticDone = completedSlugs.has("onboarding-diagnostic");
  const tier = context["company.recommended_tier"] as Tier | undefined;

  // opp_rate is a computed metric from real meeting history — asking a
  // zero-to-one org (no existing motion yet) for a conversion rate on zero
  // meetings is the exact "deals in motion" bug this gate exists to close.
  // Excluded from both the module list and the progress-count denominator,
  // not just grayed out, since it genuinely doesn't apply yet.
  const hideOppRateExercises = context["company.has_existing_motion"] === "no";
  const OPP_RATE_SLUGS = new Set(["opp-rate-check", "opp-rate-diagnosis"]);
  const visibleExercises = (list: typeof exercises) =>
    hideOppRateExercises ? list.filter((e) => !OPP_RATE_SLUGS.has(e.data.slug)) : list;

  const applicable = tier
    ? applicableTracks({
        tier,
        founderLed: context["company.motion"] === "founder_led",
        hasSalesManager: context["team.has_sales_manager"] === "yes",
      })
    : [];

  const visibleModules = [
    ...(orientationModule ? [orientationModule.data] : []),
    ...(diagnosticDone && tier && tier !== "enterprise"
      ? modules
          .filter((m) => m.data.slug !== "orientation-diagnostic" && m.data.tracks.some((t) => applicable.includes(t)))
          .map((m) => m.data)
      : []),
    ...(diagnosticDone && tier === "enterprise"
      ? modules
          .filter((m) => m.data.slug !== "orientation-diagnostic" && m.data.tracks.includes("mid-market"))
          .map((m) => m.data)
      : []),
  ].sort((a, b) => a.order - b.order);

  const allExercisesShown = visibleModules.flatMap((m) =>
    visibleExercises(exercises.filter((e) => e.data.module === m.slug)).sort((a, b) => a.data.order - b.data.order)
  );
  const doneCount = allExercisesShown.filter((e) => completedSlugs.has(e.data.slug)).length;
  const totalCount = allExercisesShown.length;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  function renderModule(mod: (typeof modules)[number]["data"], index: number) {
    const Icon = MODULE_ICONS[mod.slug] ?? CompassIcon;
    const moduleExercises = visibleExercises(exercises.filter((e) => e.data.module === mod.slug)).sort(
      (a, b) => a.data.order - b.data.order
    );
    return (
      <div
        key={mod.slug}
        className="mt-4 overflow-hidden rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--sails-border)] bg-[var(--sails-blue-light)]/40 px-5 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)]">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="font-medium text-[var(--foreground)]">{mod.title}</h3>
          <span className="ml-auto text-xs text-muted">Step {index + 1}</span>
        </div>
        <ul className="divide-y divide-[var(--sails-border)]">
          {moduleExercises.map(({ data: ex }) => {
            const done = completedSlugs.has(ex.slug);
            return (
              <li key={ex.slug}>
                <Link
                  href={`/journey/${ex.slug}`}
                  className="group flex items-center gap-3 px-5 py-3.5 text-sm transition-colors duration-150 hover:bg-[var(--sails-gray)]"
                >
                  {done ? (
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-[var(--sails-blue)]" />
                  ) : (
                    <CircleIcon className="h-5 w-5 shrink-0 text-faint" />
                  )}
                  <span className={done ? "text-muted line-through" : "text-[var(--foreground)]"}>
                    {ex.title}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-muted">
                    {done ? "Done" : ex.time_estimate}
                    <ChevronRightIcon className="h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                  </span>
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
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Journey</h1>
      <p className="mt-1 text-sm text-muted">
        Complete exercises in order — each one builds on what the last one wrote to your profile.
      </p>

      {totalCount > 0 && (
        <div className="mt-5 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--foreground)]">
              {doneCount} of {totalCount} exercises complete
            </span>
            <span className="text-muted">{progressPct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sails-gray)]">
            <div
              className="h-full rounded-full bg-[var(--sails-blue)] transition-all duration-500 ease-[var(--ease-out)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {tier && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--sails-blue-light)] px-4 py-3 text-sm text-[var(--foreground)]">
          <TargetIcon className="h-5 w-5 shrink-0 text-[var(--sails-blue)]" />
          <p>
            Recommended for you: <strong>{tracks.find((t) => t.data.slug === tier)?.data.title ?? tier}</strong>.
            Change this anytime on your{" "}
            <Link href="/profile" className="text-[var(--sails-blue)] hover:underline">
              Profile
            </Link>{" "}
            page (<code>company.recommended_tier</code>).
          </p>
        </div>
      )}

      {latestOppRateDiagnosis && (
        <div className="mt-4 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2">
            <SparkleIcon className="h-4 w-4 shrink-0 text-[var(--sails-blue)]" />
            <h2 className="text-sm font-medium text-[var(--foreground)]">
              Opportunity rate diagnosis: {latestOppRateDiagnosis.cause.replaceAll("_", " ")}
            </h2>
            <span className="ml-auto text-xs text-muted">
              {latestOppRateDiagnosis.confidence} confidence
            </span>
          </div>
          {CAUSE_LEVEL[latestOppRateDiagnosis.cause] && (
            <span className="mt-1.5 inline-block rounded-full bg-[var(--sails-gray)] px-2 py-0.5 text-[11px] font-medium text-muted">
              {CAUSE_LEVEL[latestOppRateDiagnosis.cause]!.label}
            </span>
          )}
          <p className="mt-2 text-sm leading-relaxed text-muted">{latestOppRateDiagnosis.reasoning}</p>
          {CAUSE_LEVEL[latestOppRateDiagnosis.cause] && (
            <p className="mt-1 text-xs text-muted">{CAUSE_LEVEL[latestOppRateDiagnosis.cause]!.framing}</p>
          )}
          {CAUSE_NEXT_STEP[latestOppRateDiagnosis.cause] ? (
            <Link
              href={`/journey/${CAUSE_NEXT_STEP[latestOppRateDiagnosis.cause]!.slug}`}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--sails-blue)] hover:underline"
            >
              {CAUSE_NEXT_STEP[latestOppRateDiagnosis.cause]!.label}
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <p className="mt-2 text-xs text-muted">
              No dedicated exercise for this yet — noted for the next build wave.
            </p>
          )}
        </div>
      )}

      {orientationModule && renderModule(orientationModule.data, 0)}

      {!diagnosticDone && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <CircleIcon className="h-4 w-4 shrink-0" />
          Complete your diagnostic above to unlock the rest of your personalized journey.
        </p>
      )}

      {diagnosticDone && !tier && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <CircleIcon className="h-4 w-4 shrink-0" />
          We don&apos;t have a track recommendation for you yet — redo the diagnostic above to
          get one.
        </p>
      )}

      {diagnosticDone && tier === "enterprise" && (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--sails-border)] p-5">
          <div className="flex items-center gap-2">
            <TargetIcon className="h-5 w-5 text-[var(--sails-blue)]" />
            <h2 className="font-medium text-[var(--foreground)]">Enterprise Motion — coming soon</h2>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Your deals look enterprise-complexity (formal buying committee, procurement review,
            longer cycles). We haven&apos;t built Enterprise-specific content yet. In the
            meantime, the Mid-Market exercises below are the closest fit — expect to adapt them
            upward for your buying committee and procurement process.
          </p>
          {visibleModules
            .filter((m) => m.slug !== "orientation-diagnostic")
            .map((m, i) => renderModule(m, i + 1))}
        </div>
      )}

      {diagnosticDone &&
        tier &&
        tier !== "enterprise" &&
        visibleModules.filter((m) => m.slug !== "orientation-diagnostic").map((m, i) => renderModule(m, i + 1))}
    </main>
  );
}
