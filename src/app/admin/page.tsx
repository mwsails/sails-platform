import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { AdminForm } from "./AdminForm";
import { LockIcon } from "@/components/icons";

export default async function AdminPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");

  if (user.role !== "owner_admin") {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <LockIcon className="h-8 w-8 text-faint" />
        <p className="text-sm text-muted">You don&apos;t have access to this page.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Admin</h1>
      <p className="mt-1 text-sm text-muted">
        Provision a new org and invite its first user. They&apos;ll get a magic-link email —
        there&apos;s no password to set.
      </p>
      <AdminForm />
    </main>
  );
}
