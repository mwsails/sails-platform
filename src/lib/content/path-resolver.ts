import { ALL_NAMESPACES, type FieldNode } from "./namespace-dictionary";

const SEGMENT_RE = /^([a-zA-Z0-9_]+)(\[[^\]]*\])?$/;

/**
 * Injects the implicit `id` field every array-of-objects carries
 * (Exercise Schema §5/§9, Namespace Dictionary §1) without requiring it
 * to be declared on every node in namespace-dictionary.ts.
 */
function fieldsOf(node: Extract<FieldNode, { kind: "object" }>): Record<string, FieldNode> {
  return { id: { kind: "scalar" }, ...node.fields };
}

export type ResolveResult = { ok: true } | { ok: false; reason: string };

/**
 * Resolves a context key like `personas.personas[0].title` or
 * `outbound.sequences[].touches[].body_slots.trigger` against the
 * namespace dictionary. Does not enforce array-index bounds (that's a
 * runtime concern, not a content-authoring one) — only that the path
 * shape exists.
 */
export function resolveContextKey(key: string): ResolveResult {
  const segments = key.split(".");
  if (segments.length === 0) return { ok: false, reason: `empty key` };

  const [namespaceName, ...rest] = segments;
  const namespaceRoot = ALL_NAMESPACES[namespaceName];
  if (!namespaceRoot) {
    return { ok: false, reason: `unknown namespace "${namespaceName}" in key "${key}"` };
  }
  if (rest.length === 0) {
    return { ok: false, reason: `key "${key}" is a bare namespace with no field` };
  }

  let currentFields: Record<string, FieldNode> = namespaceRoot;

  for (let i = 0; i < rest.length; i++) {
    const raw = rest[i];
    const match = raw.match(SEGMENT_RE);
    if (!match) {
      return { ok: false, reason: `malformed path segment "${raw}" in key "${key}"` };
    }
    const [, name, indexPart] = match;
    const node = currentFields[name];
    if (!node) {
      return { ok: false, reason: `field "${name}" does not exist on this path in key "${key}"` };
    }

    const isLast = i === rest.length - 1;

    if (node.kind === "scalar") {
      if (!isLast) {
        return {
          ok: false,
          reason: `"${name}" is a scalar but key "${key}" continues past it`,
        };
      }
      if (indexPart) {
        return { ok: false, reason: `"${name}" is a scalar and cannot be indexed in key "${key}"` };
      }
      return { ok: true };
    }

    if (node.kind === "any") {
      // Loosely-typed subtree (e.g. team.onboarding_plan) — anything below resolves.
      return { ok: true };
    }

    if (node.kind === "array" || node.kind === "map") {
      const of = node.of;
      if (!indexPart && isLast) {
        // Referencing the whole array/map is valid as a terminal reference.
        return { ok: true };
      }
      if (!indexPart && !isLast) {
        return {
          ok: false,
          reason: `"${name}" is a collection and must be indexed (e.g. "${name}[]") to address a field inside it, in key "${key}"`,
        };
      }
      if (isLast) {
        // Indexed but nothing follows — valid (references one item as a whole).
        return { ok: true };
      }
      if (of.kind === "object") {
        currentFields = fieldsOf(of as Extract<FieldNode, { kind: "object" }>);
        continue;
      }
      if (of.kind === "scalar") {
        return {
          ok: false,
          reason: `"${name}" holds scalars, not objects — cannot address a subfield in key "${key}"`,
        };
      }
      if (of.kind === "any") return { ok: true };
      // nested array/map-of-array is not part of v1's namespace shapes
      return { ok: false, reason: `unsupported nested collection at "${name}" in key "${key}"` };
    }

    if (node.kind === "object") {
      currentFields = fieldsOf(node);
      continue;
    }
  }

  return { ok: true };
}

/** Which top-level namespace a key belongs to, e.g. "personas" for "personas.personas[0].title". */
export function namespaceOf(key: string): string {
  return key.split(".")[0];
}
