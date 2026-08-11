import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { loadPlaybookSections } from "@/lib/playbook/generate";
import { buildPlaybookDocx } from "@/lib/playbook/export";

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "playbook";
}

/**
 * A plain GET route, not a Server Action — a real file download needs
 * Content-Disposition headers on the response itself, not a value handed
 * back to client JS to wrap in a Blob URL. The Playbook page just links
 * here directly.
 */
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const sections = await loadPlaybookSections(supabase, user.orgId);

  const { data: companyRow } = await supabase
    .from("context_fields_latest")
    .select("value")
    .eq("org_id", user.orgId)
    .is("user_id", null)
    .eq("key", "company.name")
    .maybeSingle();
  const companyName = (companyRow?.value as string) || "Sales Playbook";

  const buffer = await buildPlaybookDocx({
    companyName,
    sections: sections.map((s) => ({ title: s.title, content: s.content })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${slugify(companyName)}-sales-playbook.docx"`,
    },
  });
}
