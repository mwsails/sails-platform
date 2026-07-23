import { BuildingIcon } from "@/components/icons";

export default function LibraryPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Library</h1>
      <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--sails-border)] px-6 py-16 text-center">
        <BuildingIcon className="h-8 w-8 text-faint" />
        <p className="text-sm text-muted">Filterable reference frameworks and one-pagers ship in Phase 3.</p>
      </div>
    </main>
  );
}
