// Text shown on published pages: the highlight.js language for a path, the
// email redaction that runs before any text is shown, line numbers unchanged,
// and the data a page carries inline, since a page is published as one file.
// Shared by the review page, the code viewer, the experiments page and the story page builders.
const LANG: Record<string, string> = {
  ".sh": "bash",
  ".ts": "typescript",
  ".js": "javascript",
  ".tsx": "typescript",
  ".jsx": "javascript",
  ".md": "markdown",
  ".json": "json",
  ".jsonl": "json",
  ".toml": "ini",
  ".py": "python",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".css": "css",
  ".html": "xml",
};

/** The highlight.js language for a path, or plaintext. */
export function langOf(path: string): string {
  const name = path.split("/").at(-1) ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? (LANG[name.slice(dot)] ?? "plaintext") : "plaintext";
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[A-Za-z]{2,}(?![A-Za-z])/gu;
const KEEP = /(^|\.)example\.(com|org|net)$|\.(invalid|test|example)$/iu;

/** Replace every email address outside the reserved example domains; line numbers stay. */
export function scrub(text: string): { text: string; removed: number } {
  let removed = 0;
  const out = text.replace(EMAIL, (m) => {
    if (KEEP.test(m.slice(m.indexOf("@") + 1))) return m;
    removed += 1;
    return "<address removed>";
  });
  return { text: out, removed };
}

/** Where a page template takes its inline data. */
export const DATA_MARK = "<!-- page data -->";

/** A value as an inline JSON block a page reads by id; `<` is escaped so no text closes the block. */
export function dataBlock(id: string, value: unknown): string {
  return `<script type="application/json" id="${id}">${JSON.stringify(value).replace(/</gu, "\\u003c")}</script>`;
}

/** The page with its data mark replaced by the blocks, or an error when it has no mark. */
export function withData(html: string, blocks: readonly string[]): string {
  const at = html.indexOf(DATA_MARK);
  if (at < 0) throw new Error("the page has no data mark");
  return html.slice(0, at) + blocks.join("\n") + html.slice(at + DATA_MARK.length);
}
