import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { readContext } from "@/lib/context/store";
import { BuildingIcon, SparkleIcon, ChevronRightIcon, DownloadIcon } from "@/components/icons";

type OnePager = {
  id: string;
  headline: string;
  subheadline: string;
  value_bullets: string;
  proof_point: string;
  cta: string;
};

export default async function LibraryPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const context = await readContext(supabase, user.orgId, user.id, [
    "org.one_pagers",
    "org.brand.logo",
    "org.brand.color_primary",
    "org.brand.color_secondary",
  ]);
  const onePagers = (context["org.one_pagers"] as OnePager[] | undefined) ?? [];
  const logo = context["org.brand.logo"] as string | undefined;
  const primary = (context["org.brand.color_primary"] as string) || "var(--sails-blue)";
  const secondary = (context["org.brand.color_secondary"] as string) || "var(--sails-blue-light)";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/enablement-lead"
        className="inline-flex items-center gap-1 text-sm text-muted transition-colors duration-150 hover:text-[var(--sails-blue)]"
      >
        <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
        Enablement Lead
      </Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Library</h1>
          <p className="mt-1 text-sm text-muted">
            Enablement assets your Enablement Lead has built, in your own brand.
          </p>
        </div>
        {onePagers.length > 0 && (
          <Link
            href="/journey/enablement-one-pager"
            className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--sails-border)] bg-[var(--background)] px-3.5 py-2 text-xs font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-[var(--sails-gray)]"
          >
            <SparkleIcon className="h-3.5 w-3.5" />
            Generate another
          </Link>
        )}
      </div>

      {onePagers.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--sails-border)] px-6 py-16 text-center">
          <BuildingIcon className="h-8 w-8 text-faint" />
          <p className="max-w-sm text-sm text-muted">
            Nothing built yet — once you have an ICP defined, your Enablement Lead can draft a
            one-pager you could actually send a prospect.
          </p>
          <Link
            href="/journey/enablement-one-pager"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--sails-blue)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors duration-150 hover:bg-[var(--sails-navy)]"
          >
            <SparkleIcon className="h-3.5 w-3.5" />
            Generate a one-pager
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          {[...onePagers].reverse().map((p) => (
            <article
              key={p.id}
              className="overflow-hidden rounded-2xl shadow-[var(--shadow-soft)]"
            >
              {/* Fixed light "paper" surface, not the app's own theme tokens —
                  this is a preview of a document meant to be sent or printed,
                  so it needs to look the same regardless of whether the
                  viewer's app is in light or dark mode, and needs to stay
                  legible against brand colors of unpredictable lightness
                  (scraped or hand-entered, not chosen for this UI). */}
              <div className="bg-white p-6" style={{ borderTop: `4px solid ${primary}` }}>
                <div className="flex items-center gap-3">
                  {logo && (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary scraped domain, next/image needs a known allowlist
                    <img src={logo} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
                  )}
                  <h2 className="font-[family-name:var(--font-serif)] text-xl font-semibold text-slate-900">
                    {p.headline}
                  </h2>
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{p.subheadline}</p>

                <ul className="mt-4 flex flex-col gap-2">
                  {p.value_bullets
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-800">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: primary }}
                        />
                        {line}
                      </li>
                    ))}
                </ul>

                <p
                  className="mt-4 rounded-xl p-3.5 text-xs leading-relaxed text-slate-800"
                  style={{ backgroundColor: secondary }}
                >
                  {p.proof_point}
                </p>

                <p className="mt-4 text-sm font-medium" style={{ color: primary }}>
                  {p.cta}
                </p>
              </div>
              {/* Outside the "paper" surface — these are app controls, not
                  part of the document, so they use the app's normal
                  theme-aware tokens like everywhere else in the UI. */}
              <div className="flex items-center gap-2 border-t border-[var(--sails-border)] bg-[var(--background)] px-6 py-3">
                <a
                  href={`/enablement-lead/library/${p.id}/export/pdf`}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)]"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Export PDF
                </a>
                <a
                  href={`/enablement-lead/library/${p.id}/export/pptx`}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--sails-blue)] transition-colors duration-150 hover:bg-[var(--sails-blue-light)]"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Export PowerPoint
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
