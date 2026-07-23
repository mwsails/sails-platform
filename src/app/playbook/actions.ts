"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { generatePlaybookSection } from "@/lib/playbook/generate";

export async function regenerateSection(sectionSlug: string) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  await generatePlaybookSection(supabase, user.orgId, sectionSlug);
  revalidatePath("/playbook");
}

export async function approveSection(sectionSlug: string) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase
    .from("playbook_sections")
    .update({ status: "approved" })
    .eq("org_id", user.orgId)
    .eq("section_slug", sectionSlug);
  if (error) throw error;

  revalidatePath("/playbook");
}
