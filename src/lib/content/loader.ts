import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import {
  exerciseSchema,
  trackSchema,
  moduleSchema,
  promptFrontmatterSchema,
  type ExerciseDef,
  type TrackDef,
  type ModuleDef,
  type PromptDef,
} from "./exercise-schema";

const CONTENT_ROOT = path.join(process.cwd(), "content");

export type LoadError = { file: string; message: string };

/**
 * `onError`, when provided, receives per-file failures and the file is
 * skipped rather than thrown — used by the validator so one broken file
 * surfaces as a reportable issue instead of crashing the whole run. Without
 * it (the runtime app read path), a bad file throws — content is assumed to
 * have already passed `npm run content:validate` in CI by the time the app
 * reads it, so a throw here means that gate was skipped.
 */
function loadDir<T>(
  dir: string,
  schema: { parse: (v: unknown) => T },
  onError?: (err: LoadError) => void
): { file: string; data: T }[] {
  const full = path.join(CONTENT_ROOT, dir);
  if (!fs.existsSync(full)) return [];
  const out: { file: string; data: T }[] = [];
  for (const name of fs.readdirSync(full)) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    const file = path.join(dir, name);
    const raw = fs.readFileSync(path.join(full, name), "utf8");
    if (onError) {
      try {
        out.push({ file, data: schema.parse(loadYaml(raw)) });
      } catch (err) {
        onError({ file, message: err instanceof Error ? err.message : String(err) });
      }
    } else {
      out.push({ file, data: schema.parse(loadYaml(raw)) });
    }
  }
  return out;
}

export function loadTracks(onError?: (err: LoadError) => void): { file: string; data: TrackDef }[] {
  return loadDir("tracks", trackSchema, onError);
}

export function loadModules(onError?: (err: LoadError) => void): { file: string; data: ModuleDef }[] {
  return loadDir("modules", moduleSchema, onError);
}

export function loadExercises(onError?: (err: LoadError) => void): { file: string; data: ExerciseDef }[] {
  return loadDir("exercises", exerciseSchema, onError);
}

const PROMPT_FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

/** Prompt files are markdown with YAML frontmatter (prompt_ref/model/max_tokens), not YAML — a bespoke reader instead of loadDir's schema.parse-a-whole-file shape. */
export function loadPrompts(onError?: (err: LoadError) => void): { file: string; data: PromptDef }[] {
  const full = path.join(CONTENT_ROOT, "prompts");
  if (!fs.existsSync(full)) return [];
  const out: { file: string; data: PromptDef }[] = [];
  for (const name of fs.readdirSync(full)) {
    if (!name.endsWith(".md")) continue;
    const file = path.join("prompts", name);
    const raw = fs.readFileSync(path.join(full, name), "utf8");
    try {
      const match = raw.match(PROMPT_FRONTMATTER_RE);
      if (!match) throw new Error("missing --- frontmatter block");
      const frontmatter = promptFrontmatterSchema.parse(loadYaml(match[1]));
      out.push({ file, data: { ...frontmatter, body: match[2].trim() } });
    } catch (err) {
      if (onError) onError({ file, message: err instanceof Error ? err.message : String(err) });
      else throw err;
    }
  }
  return out;
}
