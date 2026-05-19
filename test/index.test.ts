import { describe, it, expect } from "vitest";
import { parse, apply } from "../src/index.js";

describe("parse: basic", () => {
  it("simple key/value", () => {
    expect(parse("FOO=bar")).toEqual({ FOO: "bar" });
  });
  it("multiple lines", () => {
    expect(parse("A=1\nB=2\nC=3")).toEqual({ A: "1", B: "2", C: "3" });
  });
  it("ignores blank lines", () => {
    expect(parse("\n\nA=1\n\n")).toEqual({ A: "1" });
  });
  it("ignores comment lines", () => {
    expect(parse("# comment\nA=1\n# another")).toEqual({ A: "1" });
  });
  it("trims trailing whitespace from unquoted values", () => {
    expect(parse("A=hello   ")).toEqual({ A: "hello" });
  });
  it("strips BOM", () => {
    expect(parse("﻿A=1")).toEqual({ A: "1" });
  });
});

describe("parse: quoted values", () => {
  it("double quotes with escapes", () => {
    expect(parse('A="hello\\nworld"')).toEqual({ A: "hello\nworld" });
  });
  it("double quotes preserve spaces", () => {
    expect(parse('A="  spaced  "')).toEqual({ A: "  spaced  " });
  });
  it("single quotes are literal", () => {
    expect(parse("A='hello\\nworld'")).toEqual({ A: "hello\\nworld" });
  });
  it("backticks are literal", () => {
    expect(parse("A=`raw`")).toEqual({ A: "raw" });
  });
  it("multi-line double-quoted value", () => {
    const out = parse('A="line1\nline2\nline3"');
    expect(out.A).toBe("line1\nline2\nline3");
  });
});

describe("parse: comments and edge cases", () => {
  it("strips trailing # comment from unquoted value", () => {
    expect(parse("A=hello # note")).toEqual({ A: "hello" });
  });
  it("# inside quoted value is preserved", () => {
    expect(parse('A="#not a comment"')).toEqual({ A: "#not a comment" });
  });
  it("ignores 'export ' prefix", () => {
    expect(parse("export A=1")).toEqual({ A: "1" });
  });
  it("invalid lines are skipped", () => {
    expect(parse("not a valid line\nA=1")).toEqual({ A: "1" });
  });
  it("key starting with digit is invalid", () => {
    expect(parse("1ABC=value\nA=ok")).toEqual({ A: "ok" });
  });
});

describe("parse: expansion", () => {
  it("expand: false (default) leaves ${VAR} literal", () => {
    expect(parse("A=hello\nB=${A} world")).toEqual({ A: "hello", B: "${A} world" });
  });
  it("expand: true substitutes from parsed", () => {
    expect(parse("A=hello\nB=${A} world", { expand: true })).toEqual({ A: "hello", B: "hello world" });
  });
  it("expansion uses external source as fallback", () => {
    const out = parse("PATH_LIKE=${HOME}/bin", { expand: true, expandSource: { HOME: "/u/v" } });
    expect(out.PATH_LIKE).toBe("/u/v/bin");
  });
  it("missing var expands to empty", () => {
    expect(parse("A=${MISSING}.end", { expand: true })).toEqual({ A: ".end" });
  });
  it("$BARE form also works", () => {
    expect(parse("A=hi\nB=$A!", { expand: true })).toEqual({ A: "hi", B: "hi!" });
  });
  it("single-quoted values are NOT expanded", () => {
    expect(parse("A=hi\nB='${A}!'", { expand: true })).toEqual({ A: "hi", B: "${A}!" });
  });
});

describe("apply", () => {
  it("writes into target", () => {
    const env: Record<string, string | undefined> = {};
    apply({ A: "1", B: "2" }, env);
    expect(env).toEqual({ A: "1", B: "2" });
  });
  it("preserves existing keys by default", () => {
    const env: Record<string, string | undefined> = { A: "preexisting" };
    const r = apply({ A: "new", B: "added" }, env);
    expect(env).toEqual({ A: "preexisting", B: "added" });
    expect(r.applied).toEqual(["B"]);
    expect(r.skipped).toEqual(["A"]);
  });
  it("override: true replaces", () => {
    const env: Record<string, string | undefined> = { A: "old" };
    apply({ A: "new" }, env, { override: true });
    expect(env.A).toBe("new");
  });
});
