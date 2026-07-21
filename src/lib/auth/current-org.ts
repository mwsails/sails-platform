import type { SupabaseClient } from "@supabase/supabase-js";

export type CurrentUser = { id: string; email: string; orgId: string; role: "owner_admin" | "member" };

/** Null if the caller has a session but no matching `public.users` row yet (shouldn't happen post-invite, but fail closed). */
export async function getCurrentUser(supabase: SupabaseClient): Promise<CurrentUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("org_id, role, email")
    .eq("id", user.id)
    .single();
  if (!data) return null;

  return { id: user.id, email: data.email, orgId: data.org_id, role: data.role };
}
