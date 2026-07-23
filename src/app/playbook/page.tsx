import { DocumentIcon } from "@/components/icons";

export default function PlaybookPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Playbook</h1>
      <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--sails-border)] px-6 py-16 text-center">
        <DocumentIcon className="h-8 w-8 text-faint" />
        <p className="text-sm text-muted">Section rendering, staleness flags, and export ship in Phase 2.</p>
      </div>
    </main>
  );
}
