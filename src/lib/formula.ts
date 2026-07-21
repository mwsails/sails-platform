/**
 * Restricted arithmetic evaluator for `calculator` steps (Exercise Schema
 * §6) — identifiers + numbers + `+ - * / ( )` only. No `eval`/`Function`:
 * this runs client-side against content-authored formulas, and there's no
 * reason to hand it more power than the schema allows.
 */
export function evaluateFormula(formula: string, values: Record<string, number>): number {
  const tokens = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*|\d+(?:\.\d+)?|[+\-*/()]/g) ?? [];
  let pos = 0;

  function peek() {
    return tokens[pos];
  }
  function next() {
    return tokens[pos++];
  }

  function parseAtom(): number {
    const tok = next();
    if (tok === "(") {
      const value = parseExpr();
      if (next() !== ")") throw new Error("unbalanced parentheses in formula");
      return value;
    }
    if (tok === undefined) throw new Error("unexpected end of formula");
    if (/^\d/.test(tok)) return parseFloat(tok);
    if (!(tok in values)) throw new Error(`unknown identifier "${tok}" in formula`);
    return values[tok];
  }

  function parseTerm(): number {
    let value = parseAtom();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseAtom();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseExpr(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("trailing tokens in formula");
  return result;
}
