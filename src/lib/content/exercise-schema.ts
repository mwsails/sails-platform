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
  rankStep,
  calculatorStep,
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
