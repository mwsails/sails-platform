import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Server-only: never import
 * this from a Client Component, and never expose SUPABASE_SERVICE_ROLE_KEY
 * via a NEXT_PUBLIC_ variable. Used for admin actions that can't go through
 * a user's own session: org creation and inviteUserByEmail (plan §2 —
 * invite-only, Matt provisions orgs manually).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
