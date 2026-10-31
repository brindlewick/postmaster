// The page assets, read from skills/review-pages/page: the shell, the stylesheets, the modules
// (TypeScript that the page shares with the builder, transpiled here to plain JavaScript) and the
// page scripts, in the order assets.json names them. The pure assembly is review-assemble.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PageParts } from "./review-assemble.ts";

export interface AssetManifest {
  shell: string;
  css: string[];
  modules: string[];
  js: string[];
}

const strings = (raw: unknown, key: string, allowEmpty: boolean): string[] => {
  if (!Array.isArray(raw) || !raw.every((x) => typeof x === "string")) {
    throw new Error(`assets manifest: ${key} must be a list of paths`);
  }
  if (!allowEmpty && raw.length === 0) throw new Error(`assets manifest: ${key} must not be empty`);
  for (const p of raw as string[]) checkPath(p, key);
  return raw as string[];
};

const checkPath = (p: string, key: string): void => {
  if (p.startsWith("/")) throw new Error(`assets manifest: ${key} holds an absolute path: ${p}`);
  if (p.split("/").includes(".."))
    throw new Error(`assets manifest: ${key} leaves its folder: ${p}`);
};

/** Check the manifest's shape: a shell, and lists of stylesheets, modules and scripts, all relative paths. */
export function parseManifest(raw: unknown): AssetManifest {
  if (typeof raw !== "object" || raw === null) throw new Error("assets manifest: not an object");
  const m = raw as Record<string, unknown>;
  if (typeof m.shell !== "string") throw new Error("assets manifest: shell must be a path");
  checkPath(m.shell, "shell");
  return {
    shell: m.shell,
    css: strings(m.css, "css", false),
    modules: strings(m.modules, "modules", true),
    js: strings(m.js, "js", false),
  };
}

/** Read every asset of the checkout at `toolRoot`; the page's title is the caller's. */
export function loadPageAssets(toolRoot: string): Omit<PageParts, "title"> {
  const dir = join(toolRoot, "skills", "review-pages", "page");
  const manifest = parseManifest(JSON.parse(readFileSync(join(dir, "assets.json"), "utf8")));
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  return {
    shell: readFileSync(join(dir, manifest.shell), "utf8"),
    css: manifest.css.map((f) => readFileSync(join(dir, f), "utf8")),
    modules: manifest.modules.map((f) =>
      transpiler.transformSync(readFileSync(join(toolRoot, f), "utf8")),
    ),
    js: manifest.js.map((f) => readFileSync(join(dir, f), "utf8")),
  };
}
