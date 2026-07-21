"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-org";

/**
 * Org/user provisioning (plan §2 — invite-only, Matt provisions orgs
 * manually). Uses the service-role client for the actual writes since
 * `orgs` has no client insert policy and inviting a user is an admin-API
 * call, not something RLS governs — but every call still starts by
 * confirming the caller is an owner_admin via their own session first.
 */
export async function createOrgAndInvite(orgName: string, inviteEmail: string, inviteName: string) {
  const supabase = await createClient();
  const caller = await getCurrentUser(supabase);
  if (!caller || caller.role !== "owner_admin") {
    throw new Error("not authorized");
  }

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("orgs")
    .insert({ name: orgName, created_by: caller.id })
    .select("id")
    .single();
  if (orgError) throw orgError;

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(inviteEmail, {
    data: { org_id: org.id, role: "owner_admin", name: inviteName },
  });
  if (inviteError) throw inviteError;

  revalidatePath("/admin");
  return { orgId: org.id };
}
