/** Minimal `{{path.to.value}}` interpolation for exercise `teach`/`example` bodies and prompts. */

function getPath(obj: unknown, path: string): unknown {
  const segments = path.split(".").flatMap((seg) => {
    const m = seg.match(/^([a-zA-Z0-9_]+)((?:\[\d+\])*)$/);
    if (!m) return [seg];
    const [, name, indices] = m;
    const idx = [...indices.matchAll(/\[(\d+)\]/g)].map((x) => x[1]);
    return [name, ...idx];
  });

  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/** data is typically `{ context: {...}, answers: {...} }`. Missing paths render as empty string. */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (_match, path: string) => {
    const value = getPath(data, path);
    if (value == null) return "";
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}
