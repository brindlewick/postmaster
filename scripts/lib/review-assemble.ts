// The review page is put together from parts: a shell with three slots, the stylesheets, the
// inlined modules and the page scripts. Plain substitution, no timestamps, so the same parts
// always give the same bytes. The parts are read at the edge (scripts/lib/review-assets.ts).

const SLOTS = ["@@TITLE@@", "@@CSS@@", "@@SCRIPT@@"] as const;

export interface PageParts {
  /** skills/review-pages/page/page.html: the markup with the slots. */
  shell: string;
  /** The page's name, shown as the tab title. */
  title: string;
  /** Stylesheets, in cascade order. */
  css: readonly string[];
  /** Plain JavaScript modules (already transpiled), inlined before the page scripts. */
  modules: readonly string[];
  /** The page scripts, in load order. */
  js: readonly string[];
}

/** Drop the `export` keyword from declarations and remove export lists, so a module inlines as plain code. */
export function stripExports(js: string): string {
  return js
    .replace(/^export\s*\{[^}]*\}\s*;?[ \t]*$/gmu, "")
    .replace(/^export (?=(?:async function|function|const|let|var|class)\b)/gmu, "");
}

function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** Put the parts into the shell. Throws on a missing or doubled slot, or a part that would break out of its tag. */
export function assemblePage(parts: PageParts): string {
  for (const slot of SLOTS) {
    const n = countOf(parts.shell, slot);
    if (n !== 1) throw new Error(`the shell must hold ${slot} exactly once, found ${n}`);
  }
  const all = [...parts.css, ...parts.modules, ...parts.js];
  for (const part of all) {
    for (const slot of SLOTS) {
      if (part.includes(slot)) throw new Error(`a page part holds the slot marker ${slot}`);
    }
  }
  for (const part of [...parts.modules, ...parts.js]) {
    if (/<\/script/iu.test(part)) throw new Error("a page script holds a closing </script tag");
  }
  for (const part of parts.css) {
    if (/<\/style/iu.test(part)) throw new Error("a stylesheet holds a closing </style tag");
  }
  const title = parts.title.replace(/[<>&]/gu, "");
  const script = [
    '(() => {\n"use strict";',
    ...parts.modules.map(stripExports),
    ...parts.js,
    "})();",
  ].join("\n");
  return parts.shell
    .replace("@@TITLE@@", () => title)
    .replace("@@CSS@@", () => parts.css.join("\n"))
    .replace("@@SCRIPT@@", () => script);
}
