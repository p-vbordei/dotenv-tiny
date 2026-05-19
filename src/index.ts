export interface ParseOptions {
  /** Expand `${VAR}` references in unquoted and double-quoted values. Default false. */
  expand?: boolean;
  /** Lookup source for expansion beyond already-parsed entries (e.g. `process.env`). */
  expandSource?: Record<string, string | undefined>;
}

function applyExpansion(
  raw: string,
  parsed: Record<string, string>,
  external: Record<string, string | undefined> | undefined,
): string {
  return raw.replace(/\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/gi, (_, braced, bare) => {
    const key = braced ?? bare;
    if (key in parsed) return parsed[key]!;
    if (external && key in external) return external[key] ?? "";
    return "";
  });
}

/**
 * Parse a `.env`-style document into a flat key/value object. Pure function;
 * does not touch `process.env`.
 *
 * Supports:
 *  - `KEY=value`
 *  - `KEY="quoted value"` with `\n`/`\r`/`\t`/`\\`/`\"` escapes and multi-line bodies
 *  - `KEY='literal value'` (no escapes, multi-line allowed)
 *  - `` KEY=`also literal` ``
 *  - `# comments` on their own line or after a value
 *  - `export KEY=value` (the `export` is ignored)
 *  - Optional `${VAR}` expansion when `expand: true`
 */
export function parse(text: string, opts: ParseOptions = {}): Record<string, string> {
  if (typeof text !== "string") return {};
  let src = text;
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);

  const out: Record<string, string> = {};
  let i = 0;

  while (i < src.length) {
    // Skip whitespace / blank lines
    while (i < src.length && (src[i] === " " || src[i] === "\t" || src[i] === "\n" || src[i] === "\r")) i++;
    if (i >= src.length) break;
    // Comment line
    if (src[i] === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    // Optional `export `
    if (src.startsWith("export ", i) || src.startsWith("export\t", i)) i += 7;

    // Key
    const keyStart = i;
    while (i < src.length && /[A-Za-z0-9_]/.test(src[i]!)) i++;
    const key = src.slice(keyStart, i);
    if (!key || !/^[A-Za-z_]/.test(key)) {
      // Skip the rest of the line — malformed.
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    // Skip whitespace before =
    while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
    if (src[i] !== "=") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    i++; // consume =
    while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;

    let value = "";
    const first = src[i];

    if (first === "\"") {
      i++;
      while (i < src.length && src[i] !== "\"") {
        if (src[i] === "\\" && i + 1 < src.length) {
          const next = src[i + 1]!;
          if (next === "n") { value += "\n"; i += 2; continue; }
          if (next === "r") { value += "\r"; i += 2; continue; }
          if (next === "t") { value += "\t"; i += 2; continue; }
          if (next === "\\") { value += "\\"; i += 2; continue; }
          if (next === "\"") { value += "\""; i += 2; continue; }
          if (next === "'") { value += "'"; i += 2; continue; }
          value += next; i += 2; continue;
        }
        value += src[i]!; i++;
      }
      if (src[i] === "\"") i++;
      if (opts.expand) value = applyExpansion(value, out, opts.expandSource);
    } else if (first === "'") {
      i++;
      while (i < src.length && src[i] !== "'") { value += src[i]!; i++; }
      if (src[i] === "'") i++;
    } else if (first === "`") {
      i++;
      while (i < src.length && src[i] !== "`") { value += src[i]!; i++; }
      if (src[i] === "`") i++;
    } else {
      // Unquoted: read until newline or comment
      while (i < src.length && src[i] !== "\n" && src[i] !== "\r") {
        if (src[i] === "#" && (i === 0 || src[i - 1] === " " || src[i - 1] === "\t")) break;
        value += src[i]!; i++;
      }
      value = value.trimEnd();
      if (opts.expand) value = applyExpansion(value, out, opts.expandSource);
    }

    // Skip trailing comment (after quoted value) and consume newline.
    while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
    if (src[i] === "#") {
      while (i < src.length && src[i] !== "\n") i++;
    }
    if (src[i] === "\n" || src[i] === "\r") i++;

    out[key] = value;
  }

  return out;
}

/**
 * Apply parsed values to a target object (default `process.env`). By default,
 * existing keys in the target are preserved (`override: false`).
 */
export function apply(
  parsed: Record<string, string>,
  target: Record<string, string | undefined> = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {},
  opts: { override?: boolean } = {},
): { applied: string[]; skipped: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const [k, v] of Object.entries(parsed)) {
    if (opts.override || target[k] === undefined) {
      target[k] = v;
      applied.push(k);
    } else {
      skipped.push(k);
    }
  }
  return { applied, skipped };
}
