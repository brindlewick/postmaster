// Tests beside scripts/lib/review-assemble.ts: the page is put together from its parts by
// plain substitution, so the same parts always give the same bytes.
import { describe, expect, test } from "bun:test";
import { assemblePage, stripExports } from "./review-assemble.ts";

const SHELL = [
  "<title>@@TITLE@@</title>",
  "<style>",
  "@@CSS@@",
  "</style>",
  "<main></main>",
  "<script>",
  "@@SCRIPT@@",
  "</script>",
  "",
].join("\n");

describe("stripExports", () => {
  test("declarations lose their export keyword", () => {
    const js = [
      "export const a = 1;",
      "export function f(x) { return x; }",
      "export async function g() {}",
      "export class C {}",
      "export let n = 2;",
    ].join("\n");
    expect(stripExports(js)).toBe(
      [
        "const a = 1;",
        "function f(x) { return x; }",
        "async function g() {}",
        "class C {}",
        "let n = 2;",
      ].join("\n"),
    );
  });

  test("an export list line is removed whole, single and multi-name", () => {
    expect(stripExports("const a = 1;\n\nexport { a };\nexport { a, b as c };\n")).toBe(
      "const a = 1;\n\n\n\n",
    );
  });

  test("only declarations at the start of a line are touched", () => {
    const js = 'const s = "export const x";\n  // export function y\n';
    expect(stripExports(js)).toBe(js);
  });

  test("output holds no export or import statement", () => {
    const out = stripExports("export const a = 1;\nexport { a };\n");
    expect(out).not.toMatch(/^\s*(export|import)\b/mu);
  });
});

describe("assemblePage", () => {
  const parts = {
    shell: SHELL,
    title: "Code Review",
    css: [":root { --a: 1; }", "body { margin: 0; }"],
    modules: ["export function one() { return 1; }\nexport { one };"],
    js: ["const x = one();", "document.title = String(x);"],
  };

  test("parts are placed in order inside the shell", () => {
    const html = assemblePage(parts);
    expect(html).toContain("<title>Code Review</title>");
    expect(html.indexOf(":root { --a: 1; }")).toBeLessThan(html.indexOf("body { margin: 0; }"));
    expect(html.indexOf("function one()")).toBeLessThan(html.indexOf("const x = one();"));
    expect(html).not.toContain("@@");
    expect(html).not.toMatch(/^export\b/mu);
  });

  test("the script runs in its own strict function scope", () => {
    const html = assemblePage(parts);
    expect(html).toContain('(() => {\n"use strict";');
    expect(html).toContain("})();");
  });

  test("markup characters in the title are dropped, so the head cannot be broken", () => {
    const html = assemblePage({ ...parts, title: "A <b>bold</b> & name" });
    expect(html).toContain("<title>A bbold/b  name</title>");
  });

  test("the same parts give the same bytes", () => {
    expect(assemblePage(parts)).toBe(assemblePage({ ...parts, css: [...parts.css] }));
  });

  test("a shell without a slot, or with a slot twice, is refused", () => {
    expect(() => assemblePage({ ...parts, shell: "<title>@@TITLE@@</title>" })).toThrow(/@@CSS@@/u);
    expect(() => assemblePage({ ...parts, shell: `${SHELL}@@CSS@@` })).toThrow(/@@CSS@@/u);
  });

  test("a part that holds a slot marker is refused rather than substituted twice", () => {
    expect(() => assemblePage({ ...parts, css: ["/* @@SCRIPT@@ */"] })).toThrow(/@@SCRIPT@@/u);
  });

  test("a closing script or style tag inside a part is refused", () => {
    expect(() => assemblePage({ ...parts, js: ['const s = "</script>";'] })).toThrow(/<\/script/u);
    expect(() => assemblePage({ ...parts, css: ["a { content: '</STYLE>'; }"] })).toThrow(
      /<\/style/iu,
    );
  });
});
