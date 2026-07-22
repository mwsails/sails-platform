import { createAdminClient } from "../src/lib/supabase/admin";
import { loadTracks, loadModules, loadExercises } from "../src/lib/content/loader";

/**
 * Mirrors /content into tracks/modules/exercises (plan §3 — these tables
 * are "loaded from content files", git is the source of truth). Run after
 * `npm run content:validate` passes: `npm run content:sync`. Service-role
 * only — these tables have no client write policy (Phase 0 migration).
 */
async function main() {
  const supabase = createAdminClient();

  const tracks = loadTracks();
  const modules = loadModules();
  const exercises = loadExercises();

  if (tracks.length) {
    const { error } = await supabase.from("tracks").upsert(
      tracks.map(({ data }) => ({
        slug: data.slug,
        title: data.title,
        description: data.description,
        audience_tags: data.audience_tags,
      }))
    );
    if (error) throw error;
  }

  if (modules.length) {
    const { error } = await supabase.from("modules").upsert(
      modules.map(({ data }) => ({
        slug: data.slug,
        title: data.title,
        track_slugs: data.tracks,
        order_index: data.order,
      }))
    );
    if (error) throw error;
  }

  if (exercises.length) {
    const { error } = await supabase.from("exercises").upsert(
      exercises.map(({ data }) => ({
        slug: data.slug,
        title: data.title,
        module_slug: data.module,
        tracks: data.tracks,
        intent: data.intent,
        schema_version: data.schema_version,
        time_estimate: data.time_estimate,
        reads: data.reads,
        requires: data.requires,
        writes: data.writes,
      }))
    );
    if (error) throw error;
  }

  // Delete rows for content that no longer exists (e.g. a renamed track
  // slug) — upsert alone leaves those as stale orphans forever.
  async function pruneStale(table: string, currentSlugs: string[]) {
    if (currentSlugs.length === 0) return;
    const { error } = await supabase.from(table).delete().not("slug", "in", `(${currentSlugs.join(",")})`);
    if (error) throw error;
  }
  await pruneStale("tracks", tracks.map((t) => t.data.slug));
  await pruneStale("modules", modules.map((m) => m.data.slug));
  await pruneStale("exercises", exercises.map((e) => e.data.slug));

  console.log(
    `Synced ${tracks.length} track(s), ${modules.length} module(s), ${exercises.length} exercise(s).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
