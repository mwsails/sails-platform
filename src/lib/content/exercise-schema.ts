import { z } from "zod";

/**
 * Zod mirror of SAILS_Platform_Exercise_Schema_v1.md §3, §5, §6.
 * Structural/type checks live here; cross-file checks (namespace key
 * resolution, track/module slug existence, prompt_ref existence,
 * uniqueness across the corpus) live in validate.ts.
 */

const contextKey = z.string().min(1);

const writeMapping = z.object({
  from: z.string().min(1),
  to: contextKey,
  mode: z.enum(["replace", "append", "merge_by_key"]).default("replace"),
  key_field: z.string().optional(),
});

const fieldTypeEnum = z.enum(["text", "textarea", "number", "select"]);

const listField = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: fieldTypeEnum,
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});

const tableColumn = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: fieldTypeEnum,
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});

const fixedRow = z.object({
  row_id: z.string().min(1),
  label: z.string().min(1),
  reference_text: z.string().optional(),
});

const stepBaseFields = { id: z.string().min(1).optional() };

const teachStep = z.object({ ...stepBaseFields, type: z.literal("teach"), body: z.string().min(1) });
const exampleStep = z.object({ ...stepBaseFields, type: z.literal("example"), body: z.string().min(1) });

const inputTextStep = z.object({
  ...stepBaseFields,
  id: z.string().min(1),
  type: z.literal("input_text"),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  multiline: z.boolean().default(false),
  max_length: z.number().int().positive().optional(),
});

/**
 * Optional AI-suggestion companion for a list-shaped step (Exercise Schema
 * extension for the AI-suggestions feature). `reads` is explicit — like
 * ai_generate's own `reads` — so what context reaches the prompt is
 * auditable from the YAML, not implicitly "everything the org has."
 * Suggestions are never auto-written to context: the UI drops each one into
 * the step's own editable rows, so it goes through the exact same
 * `writes` mapping as a manually-typed entry (Exercise Schema §6/§9 spirit).
 */
const suggestConfig = z.object({
  prompt_ref: z.string().min(1),
  count: z.number().int().positive().default(3),
  reads: z.array(contextKey).default([]),
});

const inputListStep = z.object({
  ...stepBaseFields,
  id: z.string().min(1),
  type: z.literal("input_list"),
  label: z.string().min(1),
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  fields: z.array(listField).min(1),
  suggest: suggestConfig.optional(),
});

const inputTableStep = z.discriminatedUnion("row_mode", [
  z.object({
    id: z.string().min(1),
    type: z.literal("input_table"),
    label: z.string().min(1),
    row_mode: z.literal("fixed"),
    columns: z.array(tableColumn).min(1),
    fixed_rows: z.array(fixedRow).min(1),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("input_table"),
    label: z.string().min(1),
    row_mode: z.literal("dynamic"),
    columns: z.array(tableColumn).min(1),
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
    suggest: suggestConfig.optional(),
  }),
]);

const selectStep = z.object({
  ...stepBaseFields,
  id: z.string().min(1),
  type: z.literal("select"),
  label: z.string().min(1),
  options: z.array(z.object({ value: z.string(), label: z.string() })).min(1),
  multiple: z.boolean().default(false),
});

/**
 * A graded multiple-choice check — the Know (and Awareness, paired with a
 * preceding ai_generate step) mechanic in the IKAP teaching loop
 * (Install/Know/Awareness/Practice). Renders like `select` but shows
 * immediate correct/incorrect feedback + explanation client-side, no
 * server round-trip, so it doesn't need a new submission pattern.
 *
 * `scenario`, `correct`, and `explanation` all support the same
 * `{{answers.step_id.field}}` interpolation as `teach`/`example` bodies —
 * needed so an Awareness quiz can reference a prior ai_generate step's
 * dynamically-generated scenario and grade against whatever answer that
 * generation produced, not a fixed value.
 *
 * `stage` is optional and only tags which IKAP stage this check belongs
 * to (`know` or `awareness`) — inferring it from the step id's naming
 * convention (e.g. `know_check_1`) would be fragile the moment an author
 * picks a different id, so it is explicit instead. Read by
 * `submitExercise` (journey/[slug]/actions.ts) to write real per-rep
 * progress into `progress.ikap` whenever a tagged quiz is answered — a
 * quiz with no `stage` still renders and grades exactly the same, it just
 * does not contribute to progress tracking.
 */
const quizStep = z.object({
  ...stepBaseFields,
  id: z.string().min(1),
  type: z.literal("quiz"),
  label: z.string().min(1),
  scenario: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).min(2),
  correct: z.string().min(1),
  explanation: z.string().min(1),
  stage: z.enum(["know", "awareness"]).optional(),
});
// A literal (non-templated) `correct` value must be one of `options[].value`
// — checked in validate.ts (Rule 10), not here, since z.discriminatedUnion
// requires every member to be a plain object schema, not a `.refine()`
// wrapper.

const rankStep = z.discriminatedUnion("source", [
  z.object({
    id: z.string().min(1),
    type: z.literal("rank"),
    label: z.string().min(1),
    source: z.literal("fixed"),
    items: z.array(z.object({ value: z.string(), label: z.string() })).min(2),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("rank"),
    label: z.string().min(1),
    source: z.literal("context"),
    context_key: contextKey,
  }),
]);

const calculatorStep = z.object({
  ...stepBaseFields,
  id: z.string().min(1),
  type: z.literal("calculator"),
  label: z.string().min(1),
  inputs: z
    .array(
      z.object({
        name: z.string().min(1),
        label: z.string().min(1),
        unit: z.string().optional(),
        type: z.literal("number"),
        default: z.number().optional(),
      })
    )
    .min(1),
  formula: z.string().min(1),
  output: z.object({ label: z.string().min(1), unit: z.string().optional(), format: z.string().optional() }),
});

const aiReviewStep = z.object({
  ...stepBaseFields,
  type: z.literal("ai_review"),
  prompt_ref: z.string().min(1),
  reviews_step: z.string().min(1),
});

const aiGenerateStep = z.object({
  ...stepBaseFields,
  id: z.string().min(1),
  type: z.literal("ai_generate"),
  prompt_ref: z.string().min(1),
  reads: z.array(contextKey).optional(),
  // Optional structured-output shape, reusing the same field type list() steps
  // already use. Omitted -> the step generates a single free-text string.
  // Present -> the model returns one object matching these fields, shown as
  // an editable form (same "AI proposes, human edits, submit writes" flow as
  // `suggest`) rather than a single textarea.
  fields: z.array(listField).min(1).optional(),
});

/**
 * Fetches a URL, extracts structured fields via Firecrawl's schema-guided
 * scrape (src/lib/scrape/firecrawl.ts), then shows the result as an editable
 * form — same "AI/scrape output always routes through an edit step before
 * it can be written" contract as ai_generate (Exercise Schema §6/§9,
 * CLAUDE.md rule 5), just fed by a scrape instead of a model call.
 */
const urlScrapeStep = z.object({
  ...stepBaseFields,
  id: z.string().min(1),
  type: z.literal("url_scrape"),
  label: z.string().min(1),
  fields: z.array(listField).min(1),
});

const outputPreviewStep = z.object({
  ...stepBaseFields,
  type: z.literal("output_preview"),
  shows_writes: z.boolean().default(true),
  custom_body: z.string().optional(),
});

export const stepSchema = z.discriminatedUnion("type", [
  teachStep,
  exampleStep,
  inputTextStep,
  inputListStep,
  inputTableStep,
  selectStep,
  quizStep,
  rankStep,
  calculatorStep,
  urlScrapeStep,
  aiReviewStep,
  aiGenerateStep,
  outputPreviewStep,
]);

export type Step = z.infer<typeof stepSchema>;

export const exerciseSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case"),
  schema_version: z.number().int().positive(),
  title: z.string().min(1),
  module: z.string().min(1),
  tracks: z.array(z.string().min(1)).min(1),
  time_estimate: z.string().min(1),
  intent: z.enum(["training", "development"]),
  reads: z.array(contextKey).default([]),
  requires: z.array(contextKey).default([]),
  writes: z.array(writeMapping).default([]),
  // Exercises within a module otherwise render in filesystem read order
  // (effectively alphabetical by filename) — an accident, not a design.
  // Default high so unordered exercises keep behaving exactly as before;
  // only exercises that need to render ahead of a sibling set this
  // explicitly (e.g. an IKAP module's Install/Know/Awareness exercise
  // needs to sort before its Practice exercise).
  order: z.number().int().default(100),
  steps: z.array(stepSchema).min(1),
});

export type ExerciseDef = z.infer<typeof exerciseSchema>;

export const trackSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  audience_tags: z.array(z.string()).default([]),
});
export type TrackDef = z.infer<typeof trackSchema>;

export const moduleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(1),
  tracks: z.array(z.string().min(1)).min(1),
  order: z.number().int().nonnegative(),
});
export type ModuleDef = z.infer<typeof moduleSchema>;

/** Frontmatter schema for /content/prompts/*.md — see review-impact-areas.md for the shape. */
export const promptFrontmatterSchema = z.object({
  prompt_ref: z.string().min(1),
  model: z.string().min(1),
  max_tokens: z.number().int().positive(),
});
export type PromptFrontmatter = z.infer<typeof promptFrontmatterSchema>;
export type PromptDef = PromptFrontmatter & { body: string };
