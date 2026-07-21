import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { readAllContextByNamespace } from "@/lib/context/store";
import { ContextField } from "./ContextField";

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

export default async function ProfilePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  const grouped = await readAllContextByNamespace(supabase, user.orgId);
  const namespaces = Object.keys(grouped).sort();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--sails-navy)]">Your Sales Profile</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Everything your exercises have written so far. Edit directly here if something needs
        correcting — it flows through the same pipeline as an exercise.
      </p>

      {namespaces.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">
          Nothing yet — complete an exercise on the{" "}
          <Link href="/journey" className="text-[var(--sails-blue)] hover:underline">
            Journey
          </Link>{" "}
          page to see your profile fill in.
        </p>
      ) : (
        namespaces.map((ns) => (
          <section key={ns} className="mt-8">
            <h2 className="text-lg font-medium text-[var(--sails-navy)]">
              {NAMESPACE_LABELS[ns] ?? ns}
            </h2>
            <div className="mt-2">
              {grouped[ns].map((field) => (
                <ContextField key={field.key} fieldKey={field.key} value={field.value} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
