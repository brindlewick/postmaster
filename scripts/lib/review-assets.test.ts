// Tests beside scripts/lib/review-assets.ts: the manifest is validated as data, and the real page
// assets are loaded from the checkout, so a missing or broken asset fails here and not on a phone.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { stripExports, stripImports } from "./review-assemble.ts";
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
      expect(text).not.toMatch(/[\u2013\u2014]/u);
      expect(text).not.toContain("@@TITLE@@@@");
      expect(text).not.toMatch(/\/Users\/|\/home\//u);
    }
  });

  test("the page scripts parse as JavaScript once their imports and exports are taken off", () => {
    for (const js of assets.js) {
      const plain = stripImports(stripExports(js));
      expect(() => new Function(`"use strict";\n${plain}`)).not.toThrow();
    }
  });

  test("loading twice gives equal parts", () => {
    expect(loadPageAssets(TOOL)).toEqual(assets);
  });
});

describe("the imports of the page scripts", () => {
  const page = join(TOOL, "skills", "review-pages", "page");
  const manifest = JSON.parse(readFileSync(join(page, "assets.json"), "utf8")) as {
    js: string[];
    modules: string[];
  };
  const scripts = manifest.js.map((f) => join(page, f));
  const known = new Set([...scripts, ...manifest.modules.map((f) => join(TOOL, f))]);
  const IMPORT = /^import[ \t\r\n]*\{([^}]*)\}[ \t\r\n]*from[ \t\r\n]*["']([^"'\r\n]*)["']/gmu;
  const DECLARATION =
    /^(?:export )?(?:async function|function|const|let|var|class) ([A-Za-z0-9_$]+)/gmu;
  const EXPORT = /^export (?:async function|function|const|let|var|class) ([A-Za-z0-9_$]+)/gmu;
  const names = (text: string, pattern: RegExp): string[] =>
    [...text.matchAll(pattern)].map((m) => m[1] ?? "");

  test("each import names another file of the manifest, and every name is exported there", () => {
    const problems: string[] = [];
    for (const file of scripts) {
      for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
        const target = resolve(dirname(file), m[2] ?? "");
        if (!known.has(target) || target === file) {
          problems.push(`${file}: imports ${m[2]}, which is not another file of the manifest`);
          continue;
        }
        const exported = new Set(names(readFileSync(target, "utf8"), EXPORT));
        for (const name of (m[1] ?? "").split(",").map((n) => n.trim())) {
          if (name !== "" && !exported.has(name)) {
            problems.push(`${file}: ${name} is not exported by ${m[2]}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test("every name a page script exports is imported by another", () => {
    const imported = new Set<string>();
    for (const file of scripts) {
      for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
        for (const name of (m[1] ?? "").split(",")) imported.add(name.trim());
      }
    }
    const unused = scripts.flatMap((file) =>
      names(readFileSync(file, "utf8"), EXPORT).filter((name) => !imported.has(name)),
    );
    expect(unused).toEqual([]);
  });

  test("no two page scripts declare the same top-level name", () => {
    const seen = new Map<string, string>();
    const doubled: string[] = [];
    for (const file of scripts) {
      for (const name of names(readFileSync(file, "utf8"), DECLARATION)) {
        const before = seen.get(name);
        if (before !== undefined) doubled.push(`${name}: ${before} and ${file}`);
        seen.set(name, file);
      }
    }
    expect(doubled).toEqual([]);
  });
});
