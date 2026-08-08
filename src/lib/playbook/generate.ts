import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYBOOK_SECTIONS } from "./sections";

type GeneratedFrom = { key: string; context_field_id: string };

/**
 * Reads the exact context rows a section declares in `reads`, including
 * each row's context_fields_latest id — that id is what `generated_from`
 * stores for staleness comparison (a context write inserts a new id even
 * when the key is unchanged, so `markDependentSectionsStale`'s key-match
 * check in src/lib/context/store.ts is what actually flips status; the id
 * here is provenance for the UI, not the staleness mechanism itself).
 */
async function readContextForSection(
  supabase: SupabaseClient,
  orgId: string,
  keys: string[]
): Promise<{ ctx: Record<string, unknown>; generatedFrom: GeneratedFrom[] }> {
  if (keys.length === 0) return { ctx: {}, generatedFrom: [] };

  // Playbook sections are org-level documents, not per-rep — only ever read
  // org-scoped facts (user_id null). Without this filter, context_fields_latest
  // now returns one row per distinct user_id that's ever written a key (see
  // migration 0002), so this needs the same explicit filter store.ts's
  // readContext applies, even though no section currently declares a
  // user-scoped key in its `reads`.
  const { data, error } = await supabase
    .from("context_fields_latest")
    .select("id, key, value")
    .eq("org_id", orgId)
    .is("user_id", null)
    .in("key", keys);
  if (error) throw error;

  const ctx: Record<string, unknown> = {};
  const generatedFrom: GeneratedFrom[] = [];
  for (const row of data ?? []) {
    ctx[row.key] = row.value;
    generatedFrom.push({ key: row.key, context_field_id: row.id });
  }
  return { ctx, generatedFrom };
}

export async function generatePlaybookSection(
  supabase: SupabaseClient,
  orgId: string,
  sectionSlug: string
) {
  const section = PLAYBOOK_SECTIONS.find((s) => s.slug === sectionSlug);
  if (!section) throw new Error(`unknown playbook section: ${sectionSlug}`);

  const { ctx, generatedFrom } = await readContextForSection(supabase, orgId, section.reads);
  const content = section.render(ctx);
  const status = content.trim() === "" ? "empty" : "draft";

  const { error } = await supabase.from("playbook_sections").upsert(
    {
      org_id: orgId,
      section_slug: sectionSlug,
      status,
      current_content: content ? { body: content } : null,
      generated_from: generatedFrom,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,section_slug" }
  );
  if (error) throw error;

  return { status, content };
}

export async function generateAllPlaybookSections(supabase: SupabaseClient, orgId: string) {
  const results = [];
  for (const section of PLAYBOOK_SECTIONS) {
    results.push({ slug: section.slug, ...(await generatePlaybookSection(supabase, orgId, section.slug)) });
  }
  return results;
}

/** Loads every section's current DB row (for the Playbook page), keyed by slug — sections never generated yet come back as `status: 'empty'` with no row. */
export async function loadPlaybookSections(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from("playbook_sections")
    .select("section_slug, status, current_content, generated_from, updated_at")
    .eq("org_id", orgId);
  if (error) throw error;

  const bySlug = new Map((data ?? []).map((row) => [row.section_slug, row]));

  return PLAYBOOK_SECTIONS.map((section) => {
    const row = bySlug.get(section.slug);
    return {
      slug: section.slug,
      title: section.title,
      status: row?.status ?? "empty",
      content: (row?.current_content as { body: string } | null)?.body ?? null,
      updatedAt: row?.updated_at ?? null,
    };
  });
}
