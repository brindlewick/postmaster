// Tests beside scripts/lib/review-assets.ts: the manifest is validated as data, and the real page
// assets are loaded from the checkout, so a missing or broken asset fails here and not on a phone.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPageAssets, parseManifest } from "./review-assets.ts";

const TOOL = join(import.meta.dir, "..", "..");

describe("parseManifest", () => {
  test("a complete manifest is accepted as it is", () => {
    const m = { shell: "page.html", css: ["a.css"], modules: ["scripts/lib/x.ts"], js: ["a.js"] };
    expect(parseManifest(m)).toEqual(m);
  });

  test("a missing key, a wrong type or an empty list is refused with the key named", () => {
    expect(() => parseManifest(null)).toThrow(/manifest/u);
    expect(() => parseManifest({ shell: "p.html", css: [], modules: [], js: ["a.js"] })).toThrow(
      /css/u,
    );
    expect(() => parseManifest({ shell: 3, css: ["a"], modules: [], js: ["a"] })).toThrow(/shell/u);
    expect(() => parseManifest({ shell: "p", css: ["a"], modules: [], js: [1] })).toThrow(/js/u);
  });

  test("a path that leaves its folder is refused", () => {
    expect(() =>
      parseManifest({ shell: "p.html", css: ["../x.css"], modules: [], js: ["a.js"] }),
    ).toThrow(/\.\./u);
    expect(() =>
      parseManifest({ shell: "p.html", css: ["a.css"], modules: ["/etc/x.ts"], js: ["a.js"] }),
    ).toThrow(/absolute|\//u);
  });
});

describe("the page assets of this checkout", () => {
  const assets = loadPageAssets(TOOL);
  const manifest = JSON.parse(
    readFileSync(join(TOOL, "skills", "review-pages", "page", "assets.json"), "utf8"),
  );

  test("every file the manifest names is loaded, in the manifest's order", () => {
    expect(assets.css.length).toBe(manifest.css.length);
    expect(assets.js.length).toBe(manifest.js.length);
    expect(assets.modules.length).toBe(manifest.modules.length);
    expect(assets.shell).toContain("@@CSS@@");
  });

  test("modules arrive as plain JavaScript: types and imports are gone, exports remain for stripping", () => {
    for (const m of assets.modules) {
      // ASCII: the module text is the transpiler's own output.
      expect(m).not.toMatch(/^\s*import\b/mu);
      expect(m).not.toContain(": string");
      expect(m).toMatch(/^export function /mu);
    }
  });

  test("no asset holds an em dash or an en dash, a slot marker or a tool path", () => {
    const all = [assets.shell, ...assets.css, ...assets.modules, ...assets.js];
    for (const text of all) {
      expect(text).not.toMatch(/[–—]/u);
      expect(text).not.toContain("@@TITLE@@@@");
      expect(text).not.toMatch(/\/Users\/|\/home\//u);
    }
  });

  test("the page scripts parse as JavaScript", () => {
    for (const js of assets.js) {
      expect(() => new Function(`"use strict";\n${js}`)).not.toThrow();
    }
  });

  test("loading twice gives equal parts", () => {
    expect(loadPageAssets(TOOL)).toEqual(assets);
  });
});
