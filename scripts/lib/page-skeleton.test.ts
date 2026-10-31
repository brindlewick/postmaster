// Tests beside scripts/lib/page-skeleton.ts: a one-file page is published in a complete document, the one
// the render gate checks pages in, so a host that stores the file as it is shows it as the gate saw it.
import { describe, expect, test } from "bun:test";
import { inSkeleton } from "./page-skeleton.ts";
import { wrapSkeleton } from "../review-page-gate.ts";

describe("inSkeleton", () => {
  test("the page sits in a document with a doctype, a viewport and a closed body", () => {
    const html = inSkeleton("<title>A page</title><p>hello</p>");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain(
      '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">',
    );
    expect(html).toContain("<meta charset=utf8>");
    expect(html).toContain("<title>A page</title><p>hello</p>");
    expect(html.endsWith("</body></html>")).toBe(true);
    // the page's own text is neither changed nor repeated
    expect(html.split("<p>hello</p>").length).toBe(2);
  });

  test("the margin and the hidden attribute are reset, as the gate has them", () => {
    const html = inSkeleton("");
    expect(html).toContain("body{margin:0;padding:0;");
    expect(html).toContain("[hidden]:not([hidden=until-found i]){display:none!important}");
  });

  test("it is the skeleton the render gate puts a page in, byte for byte", () => {
    for (const page of [
      "",
      "<p>x</p>",
      "<title>T</title><div class=app>é &amp; <script>1</script></div>",
    ]) {
      expect(inSkeleton(page)).toBe(wrapSkeleton(page));
    }
  });

  test("text that looks like a replacement pattern goes in as written", () => {
    expect(inSkeleton("a$&b$1c")).toContain("a$&b$1c");
  });
});
