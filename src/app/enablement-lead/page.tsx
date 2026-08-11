import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { readContext } from "@/lib/context/store";
import { BuildingIcon, ChevronRightIcon, SparkleIcon } from "@/components/icons";

export default async function EnablementLeadPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const context = await readContext(supabase, user.orgId, user.id, ["org.one_pagers", "icp.segments"]);
  const onePagerCount = ((context["org.one_pagers"] as unknown[] | undefined) ?? []).length;
  const hasIcp = ((context["icp.segments"] as unknown[] | undefined) ?? []).length > 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)]">
          <BuildingIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Your Enablement Lead</h1>
          <p className="text-sm text-muted">Builds sales assets in your own brand — decks, one-pagers, and more.</p>
        </div>
      </div>

      {hasIcp ? (
        <Link
          href="/journey/enablement-one-pager"
          className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--sails-border)] bg-[var(--background)] px-4 py-3.5 text-sm text-[var(--sails-blue)] shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)]"
        >
          <SparkleIcon className="h-4 w-4 shrink-0" />
          {onePagerCount > 0 ? "Build another one-pager" : "Build your first one-pager"}
          <ChevronRightIcon className="ml-auto h-3.5 w-3.5" />
        </Link>
      ) : (
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Once you have an ICP defined on your{" "}
          <Link href="/journey" className="text-[var(--sails-blue)] hover:underline">
            CRO&apos;s curriculum
          </Link>
          , your Enablement Lead can draft a one-pager you could actually send a prospect.
        </p>
      )}

      <Link
        href="/enablement-lead/library"
        className="mt-8 flex items-center gap-4 rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-[var(--sails-gray)]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)]">
          <BuildingIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-[var(--foreground)]">Your Library</h2>
          <p className="mt-0.5 text-sm text-muted">
            {onePagerCount > 0
              ? `${onePagerCount} asset${onePagerCount === 1 ? "" : "s"} built, in your brand, ready to export`
              : "Where everything your Enablement Lead builds shows up, ready to export."}
          </p>
        </div>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    </main>
  );
}
