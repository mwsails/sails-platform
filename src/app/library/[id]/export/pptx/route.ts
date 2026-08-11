import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-org";
import { readContext } from "@/lib/context/store";
import { buildOnePagerPptx, type OnePager } from "@/lib/library/one-pager-export";

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "one-pager";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const context = await readContext(supabase, user.orgId, user.id, [
    "org.one_pagers",
    "org.brand.logo",
    "org.brand.color_primary",
    "org.brand.color_secondary",
    "company.name",
  ]);
  const onePagers = (context["org.one_pagers"] as OnePager[] | undefined) ?? [];
  const onePager = onePagers.find((p) => p.id === id);
  if (!onePager) return NextResponse.json({ error: `no one-pager with id "${id}"` }, { status: 404 });

  const buffer = await buildOnePagerPptx(onePager, {
    logo: (context["org.brand.logo"] as string) || "",
    colorPrimary: (context["org.brand.color_primary"] as string) || "#0D1B4B",
    colorSecondary: (context["org.brand.color_secondary"] as string) || "#F4F5F7",
  });

  const companyName = (context["company.name"] as string) || "";
  const filename = `${slugify(companyName || onePager.headline)}-one-pager.pptx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
