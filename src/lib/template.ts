/** Minimal `{{path.to.value}}` interpolation for exercise `teach`/`example` bodies and prompts. */

function tokenize(path: string): (string | number)[] {
  return path.split(".").flatMap((seg) => {
    // name is optional so a bare leading "[0]" (no preceding identifier in
    // this segment) still tokenizes correctly — happens after
    // resolveContextPath slices a matched key off the front of the path.
    const m = seg.match(/^([a-zA-Z0-9_]*)((?:\[\d+\])*)$/);
    if (!m) return [seg];
    const [, name, indices] = m;
    const idx = [...indices.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]));
    return name ? [name, ...idx] : idx;
  });
}

function walk(obj: unknown, tokens: (string | number)[]): unknown {
  let current = obj;
  for (const tok of tokens) {
    if (current == null) return undefined;
    current = (current as Record<string | number, unknown>)[tok];
  }
  return current;
}

/**
 * `context` (from readContext/readAllContextByNamespace) is a FLAT map keyed
 * by full namespaced strings — `{"icp.segments": [...], "company.name": "..."}`
 * — not a nested object. A naive dot-split would treat "icp"/"segments" as
 * two separate hops and always miss. Match the longest actual context key
 * that prefixes the template path, then walk any `[n].field` remainder into
 * that key's value normally.
 */
function resolveContextPath(context: Record<string, unknown>, path: string): unknown {
  const keys = Object.keys(context).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (path === key) return context[key];
    if (path.startsWith(key) && /^[.[]/.test(path.slice(key.length))) {
      const rest = path.slice(key.length).replace(/^\./, "");
      return walk(context[key], tokenize(rest));
    }
  }
  return undefined;
}

/** data is `{ context: {...flat...}, answers: {...step-id-keyed...} }`. Missing paths render as empty string. */
export function renderTemplate(template: string, data: { context: Record<string, unknown>; answers: Record<string, unknown> }): string {
  return template.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (_match, fullPath: string) => {
    const [root, ...rest] = fullPath.split(".");
    const subPath = rest.join(".");
    const value =
      root === "context"
        ? resolveContextPath(data.context, subPath)
        : root === "answers"
          ? walk(data.answers, tokenize(subPath))
          : undefined;
    if (value == null) return "";
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}
