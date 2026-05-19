# dotenv-tiny

[![ci](https://github.com/p-vbordei/dotenv-tiny/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/dotenv-tiny/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/dotenv-tiny.svg)](https://www.npmjs.com/package/dotenv-tiny)
[![downloads](https://img.shields.io/npm/dm/dotenv-tiny.svg)](https://www.npmjs.com/package/dotenv-tiny)
[![bundle](https://img.shields.io/bundlejs/size/dotenv-tiny)](https://bundlejs.com/?q=dotenv-tiny)

> Tiny `.env` parser. Multi-line quoted values, escape sequences, comments, `export` prefix, optional `${VAR}` expansion. Zero dependencies, no `fs` access (pure function — you bring the text).

```ts
import { parse, apply } from "dotenv-tiny";
import { readFileSync } from "node:fs";

const parsed = parse(readFileSync(".env", "utf8"), { expand: true });

apply(parsed);                       // writes into process.env (preserves existing)
apply(parsed, target, { override: true });
```

## Install

```sh
npm install dotenv-tiny
```

Works with Node 20+, browsers, Bun, Deno. ESM + CJS.

## Why

The classic `dotenv` package is fine but:

- CJS-first, awkward in modern ESM projects
- Reads files for you — you can't use it in edge runtimes that don't have `fs`
- Confusing options surface (`override`, `preload`, `processEnv`, ...)

`dotenv-tiny` is a **pure parser**. You read the file yourself (in any way that makes sense for your runtime), pass the text in, get a flat key/value object back. Optionally call `apply()` to push into `process.env`.

Edge runtime? `parse(env_string_from_kv_store)`. Vite? Pass the result through `define`. Test? Use the object directly without touching env.

## What's supported

```env
# Comments on their own line
PLAIN=hello
QUOTED="hello world"
ESCAPED="multi\nline\tvalue"
SINGLE='${LITERAL}'           # single quotes: no escapes, no expansion
BACKTICK=`also literal`

MULTILINE="
  line 1
  line 2
"

export EXPORTED=1             # `export` prefix is accepted (and ignored)

WITH_COMMENT=value # inline comment

EXPANDED=${PLAIN}/x           # only with parse(text, { expand: true })
```

## Recipes

### Load .env file in Node

```ts
import { parse, apply } from "dotenv-tiny";
import { readFileSync } from "node:fs";

const parsed = parse(readFileSync(".env", "utf8"), {
  expand: true,
  expandSource: process.env,
});
apply(parsed);
```

### Load from a Cloudflare Workers KV

```ts
import { parse, apply } from "dotenv-tiny";

export default {
  async fetch(req: Request, env: Env) {
    const envText = await env.CONFIG_KV.get("env-config");
    if (!envText) return new Response("missing config", { status: 500 });

    const parsed = parse(envText);
    // Merge into a config object instead of process.env (which doesn't exist on Workers)
    const config = { ...defaultConfig, ...parsed };
    return handle(req, config);
  },
};
```

### Pattern: load + validate

```ts
import { parse } from "dotenv-tiny";
import { v } from "@p-vbordei/tiny-validator";
import { readFileSync } from "node:fs";

const Env = v.object({
  PORT: v.string().pattern(/^\d+$/).transform(Number),
  DATABASE_URL: v.string().min(1),
  DEBUG: v.string().optional(),
});

const raw = parse(readFileSync(".env", "utf8"), { expand: true });
const config = Env.parse(raw);
// config is typed: { PORT: number; DATABASE_URL: string; DEBUG?: string }
```

### Layered config (.env, .env.local, .env.production)

```ts
import { parse, apply } from "dotenv-tiny";
import { readFileSync, existsSync } from "node:fs";

function loadIfExists(path: string, opts?: any) {
  if (!existsSync(path)) return {};
  return parse(readFileSync(path, "utf8"), opts);
}

const merged = {
  ...loadIfExists(".env"),
  ...loadIfExists(`.env.${process.env.NODE_ENV}`),
  ...loadIfExists(".env.local"),  // last wins
};
apply(merged, process.env, { override: true });
```

### Inline expansion without touching process.env

```ts
import { parse } from "dotenv-tiny";

const config = parse(`
  HOME_DIR=/home/vlad
  CONFIG_PATH=\${HOME_DIR}/.config
`, { expand: true });
// config.CONFIG_PATH === "/home/vlad/.config"
```

## API

### `parse(text, opts?): Record<string, string>`

Pure function. Returns a flat object. Never throws.

| Option | Type | Meaning |
|---|---|---|
| `expand` | `boolean` | Substitute `${VAR}` / `$VAR` in unquoted and double-quoted values |
| `expandSource` | `Record<string, string \| undefined>` | Fallback source for expansion (e.g. `process.env`) |

Single-quoted and backtick-quoted values are **never** expanded.

### `apply(parsed, target?, opts?): { applied: string[]; skipped: string[] }`

Write parsed values into a target object. Defaults: target is `process.env`, `override: false` (existing keys preserved).

## Caveats

- **No file watching.** Read the file when your app starts; if you need live reload, watch and re-parse yourself.
- **No `.env.local` etc. conventions** — bring your own layering (see Recipes).
- **String values only.** All values are strings. Coerce types yourself (or use `tiny-validator.transform`).

## License

Apache-2.0 © Vlad Bordei
