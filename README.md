# dotenv-tiny

[![ci](https://github.com/p-vbordei/dotenv-tiny/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/dotenv-tiny/actions/workflows/ci.yml)

Tiny `.env` parser. Multi-line quoted values, escape sequences, comments, `export` prefix, optional `${VAR}` expansion. Zero dependencies, no `fs` access (pure function — you bring the text).

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

## Why not `dotenv`?

`dotenv` is fine, but CJS-first, has a confusing options surface, and reads files for you. `dotenv-tiny` is a pure parser — you read the file yourself, you decide the target. Simpler and edge-runtime-friendly.

## License

Apache-2.0 © Vlad Bordei
