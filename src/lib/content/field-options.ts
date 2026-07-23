import { loadExercises } from "./loader";

export type FieldOption = { value: string; label: string };

/**
 * Maps a context key to the picklist options that originally populated it,
 * derived from the exercise content itself (whichever `select` step some
 * exercise's `writes` mapping points at) rather than hand-duplicated in the
 * Profile UI — the two would drift otherwise. Only single-select, plain
 * `answers.<stepId>` mappings qualify: array/field-path writes (`[].field`)
 * and `multiple: true` selects aren't single scalar picklists and fall back
 * to the default free-text editor.
 */
export function loadFieldOptions(): Record<string, FieldOption[]> {
  const options: Record<string, FieldOption[]> = {};

  for (const { data: exercise } of loadExercises()) {
    const stepsById = new Map(
      exercise.steps.filter((s): s is Extract<typeof s, { id: string }> => "id" in s && !!s.id).map((s) => [s.id, s])
    );

    for (const write of exercise.writes) {
      const m = write.from.match(/^answers\.([a-zA-Z0-9_]+)$/);
      if (!m) continue;
      const step = stepsById.get(m[1]);
      if (step?.type === "select" && !step.multiple) {
        options[write.to] = step.options;
      }
    }
  }

  return options;
}
