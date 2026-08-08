import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { USER_SCOPED_NAMESPACES } from "@/lib/content/namespace-dictionary";

/** A key's user-scoping is a property of its namespace, not a per-call choice — org-scoped keys always write/read with user_id null regardless of who's calling. */
function scopedUserId(key: string, callerUserId: string | null): string | null {
  const namespace = key.split(".")[0];
  return USER_SCOPED_NAMESPACES.has(namespace) ? callerUserId : null;
}

export type WriteMode = "replace" | "append" | "merge_by_key";

export type WriteMapping = {
  from: string;
  to: string;
  mode: WriteMode;
  key_field?: string;
};

/** `answers.<stepId>`, `answers.<stepId>.<field>`, or `answers.<stepId>[].<field>` (Exercise Schema §4/§5). */
function resolveAnswerValue(answers: Record<string, unknown>, from: string): unknown {
  const m = from.match(/^answers\.([a-zA-Z0-9_]+)(\[\])?(?:\.(.+))?$/);
  if (!m) throw new Error(`unresolvable "from" path: ${from}`);
  const [, stepId, isArray, field] = m;
  const stepAnswer = answers[stepId];

  if (isArray) {
    const items = Array.isArray(stepAnswer) ? stepAnswer : [];
    return field ? items.map((item) => (item as Record<string, unknown>)[field]) : items;
  }
  if (field) {
    return (stepAnswer as Record<string, unknown> | undefined)?.[field];
  }
  return stepAnswer;
}

function withId(item: unknown): unknown {
  if (item !== null && typeof item === "object" && !Array.isArray(item) && !("id" in item)) {
    return { id: randomUUID(), ...item };
  }
  return item;
}

function mergeByKey(existing: unknown[], incoming: unknown[], keyField: string): unknown[] {
  const result = [...existing];
  for (const raw of incoming) {
    const item = withId(raw) as Record<string, unknown>;
    const matchKey = item[keyField];
    const existingIndex = result.findIndex(
      (e) => (e as Record<string, unknown>)[keyField] === matchKey
    );
    if (existingIndex >= 0) {
      result[existingIndex] = item;
    } else {
      result.push(item);
    }
  }
  return result;
}

async function readLatestValue(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | null,
  key: string
): Promise<unknown> {
  let query = supabase.from("context_fields_latest").select("value").eq("org_id", orgId).eq("key", key);
  query = userId === null ? query.is("user_id", null) : query.eq("user_id", userId);
  const { data } = await query.maybeSingle();
  return data?.value ?? null;
}

/**
 * Marks playbook sections stale when a context key they were generated from
 * changes. Safe no-op today (no `playbook_sections` rows exist until Phase
 * 2's playbook generation ships) but the mechanism needs to exist now so
 * writes are correct once it does — see Exercise Schema §5, rule 1.
 */
async function markDependentSectionsStale(supabase: SupabaseClient, orgId: string, key: string) {
  const { data: sections } = await supabase
    .from("playbook_sections")
    .select("id, generated_from")
    .eq("org_id", orgId);

  const staleIds = (sections ?? [])
    .filter((s) =>
      Array.isArray(s.generated_from) &&
      (s.generated_from as { key: string }[]).some((g) => g.key === key)
    )
    .map((s) => s.id);

  if (staleIds.length > 0) {
    await supabase.from("playbook_sections").update({ status: "stale" }).in("id", staleIds);
  }
}

/**
 * Applies an exercise's `writes` mappings against the context layer.
 * context_fields is append-only (plan §4) — every call INSERTs a new row
 * per key; it never UPDATEs history in place. `source`/`sourceSessionId`
 * carry provenance (Exercise Schema §5): 'exercise' writes always pass a
 * session id, 'manual' Profile-page edits pass null.
 *
 * `callerUserId` is the person doing the writing, not necessarily who the
 * row ends up scoped to — a single exercise (onboarding-diagnostic) can
 * write both org-scoped (`company.*`) and user-scoped (`respondent.*`)
 * fields in one call, so scoping is decided per-mapping from
 * USER_SCOPED_NAMESPACES, not once for the whole write.
 */
export async function writeContext(
  supabase: SupabaseClient,
  orgId: string,
  callerUserId: string | null,
  writes: WriteMapping[],
  answers: Record<string, unknown>,
  source: "exercise" | "manual",
  sourceExerciseSessionId: string | null
) {
  for (const mapping of writes) {
    const newValue = resolveAnswerValue(answers, mapping.from);
    // An unanswered step resolves to undefined — skip rather than insert a
    // null into a NOT NULL column. A step going unanswered isn't a context
    // fact to record, and previously this threw and crashed the whole page.
    if (newValue === undefined) continue;
    let finalValue: unknown;
    const rowUserId = scopedUserId(mapping.to, callerUserId);

    if (mapping.mode === "replace") {
      finalValue = Array.isArray(newValue) ? newValue.map(withId) : newValue;
    } else {
      const existing = ((await readLatestValue(supabase, orgId, rowUserId, mapping.to)) as unknown[]) ?? [];
      const incoming = Array.isArray(newValue) ? newValue : [newValue];
      finalValue =
        mapping.mode === "merge_by_key"
          ? mergeByKey(existing, incoming, mapping.key_field ?? "id")
          : [...existing, ...incoming.map(withId)];
    }

    const { error } = await supabase.from("context_fields").insert({
      org_id: orgId,
      user_id: rowUserId,
      key: mapping.to,
      value: finalValue,
      source,
      source_exercise_session_id: sourceExerciseSessionId,
    });
    if (error) throw error;

    await markDependentSectionsStale(supabase, orgId, mapping.to);
  }
}

/**
 * Reads the latest value for each requested key — the only read path for
 * "current" context (never query context_fields directly). `callerUserId`
 * scopes any user-scoped keys in the request to that user; org-scoped keys
 * ignore it. A single `reads` array can mix both, so this splits into at
 * most two queries rather than one — filtering `context_fields_latest` by
 * org_id+key alone would now return one row per distinct user_id who's
 * ever written that key (not just one), so the user_id filter isn't
 * optional once a namespace can be user-scoped at all.
 */
export async function readContext(
  supabase: SupabaseClient,
  orgId: string,
  callerUserId: string | null,
  keys: string[]
): Promise<Record<string, unknown>> {
  if (keys.length === 0) return {};
  const orgKeys = keys.filter((k) => scopedUserId(k, callerUserId) === null);
  const userKeys = keys.filter((k) => scopedUserId(k, callerUserId) !== null);
  const result: Record<string, unknown> = {};

  if (orgKeys.length > 0) {
    const { data, error } = await supabase
      .from("context_fields_latest")
      .select("key, value")
      .eq("org_id", orgId)
      .is("user_id", null)
      .in("key", orgKeys);
    if (error) throw error;
    for (const row of data ?? []) result[row.key] = row.value;
  }

  if (userKeys.length > 0 && callerUserId) {
    const { data, error } = await supabase
      .from("context_fields_latest")
      .select("key, value")
      .eq("org_id", orgId)
      .eq("user_id", callerUserId)
      .in("key", userKeys);
    if (error) throw error;
    for (const row of data ?? []) result[row.key] = row.value;
  }

  return result;
}

/**
 * All latest context visible to a user, grouped by top-level namespace —
 * powers the Sales Profile page. That's every org-scoped field (user_id
 * null) plus this caller's own user-scoped fields — not other reps'.
 */
export async function readAllContextByNamespace(
  supabase: SupabaseClient,
  orgId: string,
  callerUserId: string | null
): Promise<Record<string, { key: string; value: unknown }[]>> {
  let query = supabase.from("context_fields_latest").select("key, value").eq("org_id", orgId).order("key");
  query = callerUserId ? query.or(`user_id.is.null,user_id.eq.${callerUserId}`) : query.is("user_id", null);
  const { data, error } = await query;
  if (error) throw error;

  const grouped: Record<string, { key: string; value: unknown }[]> = {};
  for (const row of data ?? []) {
    const namespace = row.key.split(".")[0];
    grouped[namespace] ??= [];
    grouped[namespace].push({ key: row.key, value: row.value });
  }
  return grouped;
}
