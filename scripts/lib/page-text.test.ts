// Tests beside scripts/lib/page-text.ts: the redaction keeps line numbers and
// example addresses, and languages come from the extension.
import { describe, expect, test } from "bun:test";
import { DATA_MARK, dataBlock, langOf, scrub, withData } from "./page-text.ts";

describe("page text", () => {
  test("addresses outside the example domains are removed, line numbers kept", () => {
    const r = scrub(
      "a: " +
        "som" +
        "eon" +
        "e@c" +
        "omp" +
        "any" +
        ".co" +
        "\nb:" +
        " u@" +
        "exa" +
        "mpl" +
        "e.c" +
        "om\n" +
        "c: " +
        "x@h" +
        "ost" +
        ".in" +
        "val" +
        "id\n" +
        "d: " +
        "é@e" +
        "xäm" +
        "ple" +
        ".co" +
        "m\n",
    );
    expect(r.text).toBe(
      "a: <address removed>\nb: u@example.com\nc: x@host.invalid\nd: <address removed>\n",
    );
    expect(r.removed).toBe(2);
    expect(scrub("no address here\n")).toEqual({ text: "no address here\n", removed: 0 });
  });

  test("a decorator is not an address", () => {
    expect(scrub("@contextlib.contextmanager\n").removed).toBe(0);
  });

  test("long top-level domains are removed, one-letter ones kept", () => {
    const r = scrub("a: " + "reviewer@host" + ".photography" + "\nb: a@b.c\n");
    expect(r.text).toBe("a: <address removed>\nb: a@b.c\n");
    expect(r.removed).toBe(1);
  });

  test("languages come from the extension", () => {
    expect(langOf("scripts/x.ts")).toBe("typescript");
    expect(langOf("apps/x/Widget.tsx")).toBe("typescript");
    expect(langOf("apps/x/view.jsx")).toBe("javascript");
    expect(langOf("a/b.sh")).toBe("bash");
    expect(langOf("README.md")).toBe("markdown");
    expect(langOf("Makefile")).toBe("plaintext");
  });

  test("inline data reads back whole, and no text in it can close its block", () => {
    const value = { a: "</script><b>", n: [1, 2], c: "<!-- x -->" };
    const block = dataBlock("d", value);
    expect(block.startsWith('<script type="application/json" id="d">')).toBe(true);
    const inner = block.slice(block.indexOf(">") + 1, block.lastIndexOf("</script>"));
    expect(inner).not.toContain("<");
    expect(JSON.parse(inner)).toEqual(value);
    expect(block.indexOf("</script>")).toBe(block.lastIndexOf("</script>"));
  });

  test("the data goes where the page marks it; a page without the mark is refused", () => {
    expect(withData(`<p>a</p>${DATA_MARK}<script>x</script>`, ["B1", "B2"])).toBe(
      "<p>a</p>B1\nB2<script>x</script>",
    );
    expect(withData(`<p>a</p>${DATA_MARK}<p>b</p>`, [])).toBe("<p>a</p><p>b</p>");
    expect(() => withData("<p>no mark</p>", ["B"])).toThrow("no data mark");
  });

  test("text that looks like a replacement pattern goes in as written", () => {
    expect(withData(`a${DATA_MARK}b`, ["$& $1 $$"])).toBe("a$& $1 $$b");
  });
});
