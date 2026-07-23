import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { loadPlaybookSections } from "@/lib/playbook/generate";
import { SectionCard } from "./SectionCard";
import { DocumentIcon } from "@/components/icons";

export default async function PlaybookPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const sections = await loadPlaybookSections(supabase, user.orgId);
  const readyCount = sections.filter((s) => s.status !== "empty").length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Playbook</h1>
      <p className="mt-1 text-sm text-muted">
        Every section below is built from your own exercise answers. Generate a section once
        there&apos;s context to draw from, and regenerate it whenever it&apos;s flagged stale.
      </p>

      {readyCount > 0 ? (
        <div className="mt-5 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--foreground)]">
              {readyCount} of {sections.length} sections started
            </span>
            <span className="text-muted">{Math.round((readyCount / sections.length) * 100)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sails-gray)]">
            <div
              className="h-full rounded-full bg-[var(--sails-blue)] transition-all duration-500 ease-[var(--ease-out)]"
              style={{ width: `${Math.round((readyCount / sections.length) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--sails-border)] px-6 py-16 text-center">
          <DocumentIcon className="h-8 w-8 text-faint" />
          <p className="text-sm text-muted">
            Complete a few exercises on your Journey, then come back to generate your first
            section.
          </p>
        </div>
      )}

      {sections.map((section, i) => (
        <SectionCard
          key={section.slug}
          slug={section.slug}
          title={section.title}
          status={section.status as "empty" | "draft" | "approved" | "stale"}
          content={section.content}
          stepNumber={i + 1}
        />
      ))}
    </main>
  );
}
