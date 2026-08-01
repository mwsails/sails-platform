import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { load as loadYaml } from "js-yaml";
import { type ExerciseDef } from "./exercise-schema";
import { loadTracks, loadModules, loadExercises } from "./loader";
import { resolveContextKey, namespaceOf } from "./path-resolver";
import { RESERVED_NAMESPACES } from "./namespace-dictionary";

export type ValidationIssue = { file: string; message: string };

const CONTENT_ROOT = path.join(process.cwd(), "content");

/** `answers.<step_id>` or `answers.<step_id>[...]<.subpath>` -> step_id, else null. */
function stepIdFromAnswerPath(from: string): string | null {
  const m = from.match(/^answers\.([a-zA-Z0-9_]+)(\[[^\]]*\])?(\..+)?$/);
  return m ? m[1] : null;
}

/** Restricted arithmetic-expression identifier extraction for calculator.formula. */
function identifiersInFormula(formula: string): string[] {
  return Array.from(new Set(formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []));
}

function previousCommittedSchemaVersion(file: string): number | null {
  try {
    const raw = execFileSync("git", ["show", `HEAD:content/${file}`], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    const parsed = loadYaml(raw) as { schema_version?: number } | undefined;
    return parsed?.schema_version ?? null;
  } catch {
    return null; // no prior committed version (new file) or not a git repo — nothing to compare
  }
}

export function validateContent(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const onError = (err: { file: string; message: string }) => issues.push(err);
  const tracks = loadTracks(onError);
  const modules = loadModules(onError);
  const exercises = loadExercises(onError);

  const trackSlugs = new Set(tracks.map((t) => t.data.slug));
  const moduleSlugs = new Set(modules.map((m) => m.data.slug));
  const promptDir = path.join(CONTENT_ROOT, "prompts");
  const promptRefs = new Set(
    fs.existsSync(promptDir)
      ? fs.readdirSync(promptDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
      : []
  );

  // Rule: module slugs must each belong to >=1 track that exists.
  for (const { file, data } of modules) {
    for (const t of data.tracks) {
      if (!trackSlugs.has(t)) {
        issues.push({ file, message: `module references unknown track slug "${t}"` });
      }
    }
  }

  for (const { file, data } of exercises) {
    validateExercise(file, data, { trackSlugs, moduleSlugs, promptRefs }, issues);
  }

  return issues;
}

function validateExercise(
  file: string,
  data: ExerciseDef,
  ctx: { trackSlugs: Set<string>; moduleSlugs: Set<string>; promptRefs: Set<string> },
  issues: ValidationIssue[]
) {
  const push = (message: string) => issues.push({ file, message });

  // Rule 3: tracks/module slugs resolve.
  for (const t of data.tracks) {
    if (!ctx.trackSlugs.has(t)) push(`references unknown track slug "${t}"`);
  }
  if (!ctx.moduleSlugs.has(data.module)) push(`references unknown module slug "${data.module}"`);

  // Rule: enterprise-reserved namespaces may not be read/written by any v1-track exercise.
  const reservedNames = new Set(Object.keys(RESERVED_NAMESPACES));
  for (const key of [...data.reads, ...data.requires, ...data.writes.map((w) => w.to)]) {
    if (reservedNames.has(namespaceOf(key))) {
      push(`references reserved Enterprise-track namespace "${namespaceOf(key)}" in key "${key}" — out of scope for v1 (plan §2)`);
    }
  }

  // Rule 1: reads/requires/writes[].to resolve against the namespace dictionary.
  for (const key of data.reads) {
    const r = resolveContextKey(key);
    if (!r.ok) push(`invalid "reads" key: ${r.reason}`);
  }
  for (const key of data.requires) {
    const r = resolveContextKey(key);
    if (!r.ok) push(`invalid "requires" key: ${r.reason}`);
  }
  for (const w of data.writes) {
    const r = resolveContextKey(w.to);
    if (!r.ok) push(`invalid "writes.to" key: ${r.reason}`);
    if (w.mode === "merge_by_key" && !w.key_field) {
      // Not an error per se — key_field defaults to "id" per Exercise Schema §5/§9 decision — but
      // surface it so authors know the default is in effect rather than silently assuming intent.
    }
  }

  // Rule 2: requires ⊆ reads.
  const readsSet = new Set(data.reads);
  for (const key of data.requires) {
    if (!readsSet.has(key)) push(`"requires" key "${key}" is not also declared in "reads" (Exercise Schema §3.1)`);
  }

  // Rule 4: step ids unique; writes[].from references an existing step id.
  const stepIds = new Set<string>();
  for (const step of data.steps) {
    const id = (step as { id?: string }).id;
    if (id) {
      if (stepIds.has(id)) push(`duplicate step id "${id}"`);
      stepIds.add(id);
    }
  }
  for (const w of data.writes) {
    const stepId = stepIdFromAnswerPath(w.from);
    if (!stepId) {
      push(`"writes.from" value "${w.from}" is not a valid "answers.<step_id>[...]" path`);
    } else if (!stepIds.has(stepId)) {
      push(`"writes.from" references step id "${stepId}" which does not exist in this exercise`);
    }
  }

  // Rule 5: calculator.formula identifiers ⊆ declared inputs[].name.
  for (const step of data.steps) {
    if (step.type === "calculator") {
      const names = new Set(step.inputs.map((i) => i.name));
      for (const ident of identifiersInFormula(step.formula)) {
        if (!names.has(ident)) {
          push(`calculator "${step.id}" formula references undeclared input "${ident}"`);
        }
      }
    }
  }

  // Rule 6: ai_review / ai_generate prompt_ref resolves to /content/prompts/<ref>.md.
  for (const step of data.steps) {
    if ((step.type === "ai_review" || step.type === "ai_generate") && !ctx.promptRefs.has(step.prompt_ref)) {
      push(`step references missing prompt file "content/prompts/${step.prompt_ref}.md"`);
    }
  }

  // Rule 7: every ai_generate step's id is referenced by >=1 writes[].from (no bypassed AI output).
  const writeFromStepIds = new Set(data.writes.map((w) => stepIdFromAnswerPath(w.from)).filter(Boolean));
  for (const step of data.steps) {
    if (step.type === "ai_generate" && !writeFromStepIds.has(step.id)) {
      push(`ai_generate step "${step.id}" is never referenced by a "writes.from" — its output would bypass the required edit-before-save step (Exercise Schema §6/§9)`);
    }
  }

  // Rule 8: input_list / dynamic input_table `suggest.prompt_ref` resolves, and
  // `suggest.reads` keys are valid and non-reserved (same checks as top-level reads).
  for (const step of data.steps) {
    const suggest = (step as { suggest?: { prompt_ref: string; reads: string[] } }).suggest;
    if (!suggest) continue;
    if (!ctx.promptRefs.has(suggest.prompt_ref)) {
      push(`step "${(step as { id: string }).id}" suggest.prompt_ref references missing prompt file "content/prompts/${suggest.prompt_ref}.md"`);
    }
    for (const key of suggest.reads) {
      const r = resolveContextKey(key);
      if (!r.ok) push(`invalid "suggest.reads" key: ${r.reason}`);
      if (reservedNames.has(namespaceOf(key))) {
        push(`suggest.reads references reserved Enterprise-track namespace "${namespaceOf(key)}" in key "${key}" — out of scope for v1 (plan §2)`);
      }
    }
  }

  // Rule 9: schema_version never decreases vs. the previously committed version of this file.
  const prevVersion = previousCommittedSchemaVersion(file);
  if (prevVersion !== null && data.schema_version < prevVersion) {
    push(`schema_version decreased from ${prevVersion} to ${data.schema_version}`);
  }

  // Rule 10: quiz.correct, when literal (not a {{...}} template), must be one
  // of that quiz's own options[].value. A templated `correct` (Awareness,
  // graded against a prior ai_generate step's dynamic output) can't be
  // checked at authoring time and is skipped.
  for (const step of data.steps) {
    if (step.type === "quiz" && !step.correct.includes("{{")) {
      const validValues = new Set(step.options.map((o) => o.value));
      if (!validValues.has(step.correct)) {
        push(`quiz step "${step.id}" has correct: "${step.correct}", which is not one of its own options[].value`);
      }
    }
  }
}
