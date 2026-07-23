import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { readAllContextByNamespace } from "@/lib/context/store";
import { loadFieldOptions } from "@/lib/content/field-options";
import { ContextField } from "./ContextField";
import {
  BuildingIcon,
  TargetIcon,
  UsersIcon,
  LightbulbIcon,
  SparkleIcon,
  ArrowRightIcon,
  CompassIcon,
  XIcon,
  ChartBarIcon,
  DocumentIcon,
} from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

const NAMESPACE_LABELS: Record<string, string> = {
  company: "Company",
  icp: "ICP",
  personas: "Personas",
  pain_tree: "Pain Tree",
  messaging: "Messaging",
  outbound: "Outbound",
  process: "Process",
  objections: "Objections",
  cadence: "Cadence",
  team: "Team",
};

const NAMESPACE_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  company: BuildingIcon,
  icp: TargetIcon,
  personas: UsersIcon,
  pain_tree: LightbulbIcon,
  messaging: SparkleIcon,
  outbound: ArrowRightIcon,
  process: CompassIcon,
  objections: XIcon,
  cadence: ChartBarIcon,
  team: UsersIcon,
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const grouped = await readAllContextByNamespace(supabase, user.orgId);
  const namespaces = Object.keys(grouped).sort();
  const fieldOptions = loadFieldOptions();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Your Sales Profile</h1>
      <p className="mt-1 text-sm text-muted">
        Everything your exercises have written so far. Edit directly here if something needs
        correcting — it flows through the same pipeline as an exercise.
      </p>

      {namespaces.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--sails-border)] px-6 py-12 text-center">
          <DocumentIcon className="h-8 w-8 text-faint" />
          <p className="text-sm text-muted">
            Nothing yet — complete an exercise on the{" "}
            <Link href="/journey" className="text-[var(--sails-blue)] hover:underline">
              Journey
            </Link>{" "}
            page to see your profile fill in.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {namespaces.map((ns) => {
            const Icon = NAMESPACE_ICONS[ns] ?? DocumentIcon;
            return (
              <section
                key={ns}
                className="overflow-hidden rounded-2xl border border-[var(--sails-border)] bg-[var(--background)] shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center gap-3 border-b border-[var(--sails-border)] bg-[var(--sails-blue-light)]/40 px-5 py-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sails-blue-light)] text-[var(--sails-blue)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h2 className="font-medium text-[var(--foreground)]">{NAMESPACE_LABELS[ns] ?? ns}</h2>
                  <span className="ml-auto text-xs text-muted">
                    {grouped[ns].length} field{grouped[ns].length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="px-5">
                  {grouped[ns].map((field) => (
                    <ContextField
                      key={field.key}
                      fieldKey={field.key}
                      value={field.value}
                      options={fieldOptions[field.key]}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
