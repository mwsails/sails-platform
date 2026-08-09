"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { writeContext } from "@/lib/context/store";

/**
 * Manual edits on the Profile page go through the exact same writeContext
 * path as exercise writes, just with source: 'manual' and no session id
 * (Exercise Schema §5) — staleness propagation is identical either way.
 */
export async function updateContextField(key: string, rawJson: string) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  let value: unknown;
  try {
    value = JSON.parse(rawJson);
  } catch {
    throw new Error("not valid JSON");
  }

  await writeContext(
    supabase,
    user.orgId,
    user.id,
    [{ from: "answers.__manual", to: key, mode: "replace" }],
    { __manual: value },
    "manual",
    null
  );

  revalidatePath("/profile");
}
