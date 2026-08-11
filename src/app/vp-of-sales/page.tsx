import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { readContext } from "@/lib/context/store";
import { loadPlaybookSections } from "@/lib/playbook/generate";
import { ChevronRightIcon, DocumentIcon, LightbulbIcon, SparkleIcon } from "@/components/icons";

export default async function VpOfSalesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const [context, sections] = await Promise.all([
    readContext(supabase, user.orgId, user.id, ["progress.vp_coaching", "progress.ikap"]),
    loadPlaybookSections(supabase, user.orgId),
  ]);

  // progress.vp_coaching is append-only (same precedent as
  // metrics.diagnosis/org.cro_diagnosis) — the most recent entry is the
  // rep's current coaching note. This card lived on /profile before the
  // agent-centric IA reorg; moved here since VP of Sales is now its own
  // top-level page, not folded into the org-data view.
  const vpCoachingEntries = context["progress.vp_coaching"] as { coaching_note: string }[] | undefined;
  const latestCoaching =
    vpCoachingEntries && vpCoachingEntries.length > 0 ? vpCoachingEntries[vpCoachingEntries.length - 1] : null;
  const hasIkapHistory = ((context["progress.ikap"] as unknown[] | undefined) ?? []).length > 0;

  const readyCount = sections.filter((s) => s.status !== "empty").length;
  const playbookPct = sections.length ? Math.round((readyCount / sections.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)]">
          <LightbulbIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Your VP of Sales</h1>
          <p className="text-sm text-muted">Coaches you personally, and keeps your Playbook current.</p>
        </div>
      </div>

      {latestCoaching && (
        <div className="mt-6 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2">
            <SparkleIcon className="h-4 w-4 shrink-0 text-[var(--sails-blue)]" />
            <h2 className="text-sm font-medium text-[var(--foreground)]">Your latest coaching</h2>
            <Link
              href="/journey/vp-of-sales-coaching"
              className="ml-auto text-xs font-medium text-[var(--sails-blue)] hover:underline"
            >
              Re-run
            </Link>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{latestCoaching.coaching_note}</p>
        </div>
      )}

      {!latestCoaching && hasIkapHistory && (
        <Link
          href="/journey/vp-of-sales-coaching"
          className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--sails-border)] bg-[var(--background)] px-4 py-3.5 text-sm text-[var(--sails-blue)] shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)]"
        >
          <SparkleIcon className="h-4 w-4 shrink-0" />
          Get coaching from your VP of Sales
          <ChevronRightIcon className="ml-auto h-3.5 w-3.5" />
        </Link>
      )}

      {!latestCoaching && !hasIkapHistory && (
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Complete a quiz-based exercise on your{" "}
          <Link href="/journey" className="text-[var(--sails-blue)] hover:underline">
            CRO&apos;s curriculum
          </Link>{" "}
          (like Objection Framework) and your VP of Sales will have something real to coach you on.
        </p>
      )}

      <Link
        href="/vp-of-sales/playbook"
        className="mt-8 flex items-center gap-4 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-[var(--sails-gray)]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)]">
          <DocumentIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-[var(--foreground)]">Your Playbook</h2>
          <p className="mt-0.5 text-sm text-muted">
            {readyCount > 0
              ? `${readyCount} of ${sections.length} sections started (${playbookPct}%)`
              : "The 14-section playbook your VP of Sales keeps current, built from your own exercise answers."}
          </p>
        </div>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    </main>
  );
}
