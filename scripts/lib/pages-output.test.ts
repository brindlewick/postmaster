// Tests beside scripts/lib/pages-output.ts: what a publish command prints is read as the contract
// says (the exact title and a link on the next line), what a comments command prints is read
// leniently, and a comment is shown as plain lines.
import { describe, expect, test } from "bun:test";
import { NO_PAGES, type PagesSettings } from "./pages-host.ts";
import { formatComment, parseComments, parsePublished, stateLine } from "./pages-output.ts";

const settings = (over: Partial<PagesSettings> = {}): PagesSettings => ({
  publish: "host-cli publish {file} --slug {slug}",
  comments: "host-cli comments {slug} --all --json",
  close: "host-cli close {id}",
  bridge: null,
  state: false,
  ...over,
});

/** One test per row, named for its row (bun's test.each is not declared in types/bun.d.ts). */
function cases<T>(rows: readonly T[], name: (row: T) => string, body: (row: T) => void): void {
  for (const row of rows) test(name(row), () => body(row));
}

describe("parsePublished: Title: and a link on the next line", () => {
  test("the title is the exact text after Title: and the link is the next line", () => {
    expect(
      parsePublished("Title: Review of the cart change\nhttps://host.example/p/review-x\n"),
    ).toEqual({
      title: "Review of the cart change",
      link: "https://host.example/p/review-x",
    });
  });

  test("other lines around the pair, and windows line ends, do not matter", () => {
    expect(
      parsePublished(
        "uploading\r\nTitle:  Two  spaces, kept\r\nhttp://127.0.0.1:8080/a#top\r\nversion 3\r\n",
      ),
    ).toEqual({ title: " Two  spaces, kept", link: "http://127.0.0.1:8080/a#top" });
  });

  test("the first Title: line with a link under it wins", () => {
    expect(
      parsePublished(
        "Title: No link under this\nnot a link\nTitle: Second\nhttps://host.example/b\nTitle: Third\nhttps://host.example/c\n",
      ),
    ).toEqual({ title: "Second", link: "https://host.example/b" });
  });

  cases(
    [
      ["no output", ""],
      ["a title with no link line", "Title: Only a title\n"],
      ["a link on the same line", "Title: X https://host.example/p\n"],
      ["a blank line between", "Title: X\n\nhttps://host.example/p\n"],
      ["the link first", "https://host.example/p\nTitle: X\n"],
      ["a relative link", "Title: X\n/p/review-x\n"],
      ["a link that is not http or https", "Title: X\nftp://host.example/p\n"],
      ["a file link", "Title: X\nfile:///tmp/p.html\n"],
      ["a script link", "Title: X\njavascript:alert(1)\n"],
      ["a link with a space in it", "Title: X\nhttps://host.example/a b\n"],
      ["an empty title", "Title: \nhttps://host.example/p\n"],
      ["a lowercase label", "title: X\nhttps://host.example/p\n"],
      ["a link with no host", "Title: X\nhttps://\n"],
    ],
    ([what]) => `${what} is not a published page`,
    ([, stdout]) => {
      expect(parsePublished(stdout)).toBeNull();
    },
  );
});

describe("parseComments: one JSON array, tolerant of what it does not know", () => {
  const line = {
    id: 41,
    status: "open",
    author: "reviewer",
    body: "Why is this retried?",
    createdAt: "2026-10-31T09:12:00Z",
    version: 3,
    anchor: { kind: "line", file: "src/retry.ts", side: "new", from: 18, to: 22 },
  };
  const text = {
    id: "c-42",
    status: "closed",
    author: "",
    body: "Typo.",
    createdAt: "2026-10-31T09:15:40Z",
    version: 3,
    anchor: { kind: "text", quote: "recieve", prefix: "will ", suffix: " the reply" },
  };
  const read = (value: unknown) => {
    const r = parseComments(JSON.stringify(value));
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };

  test("the contract's two comments read as they are", () => {
    const r = read([line, text]);
    expect(r.skipped).toBe(0);
    expect(r.comments).toEqual([
      {
        id: 41,
        status: "open",
        author: "reviewer",
        body: "Why is this retried?",
        createdAt: "2026-10-31T09:12:00Z",
        version: 3,
        anchor: { kind: "line", file: "src/retry.ts", side: "new", from: 18, to: 22 },
      },
      {
        id: "c-42",
        status: "closed",
        author: "",
        body: "Typo.",
        createdAt: "2026-10-31T09:15:40Z",
        version: 3,
        anchor: { kind: "text", quote: "recieve", prefix: "will ", suffix: " the reply" },
      },
    ]);
  });

  test("an empty array is success: no comments", () => {
    expect(read([])).toEqual({ comments: [], skipped: 0 });
    expect(parseComments("  []\n").ok).toBe(true);
  });

  test("fields the tool does not know are ignored, on the comment and on its anchor", () => {
    const r = read([
      {
        ...line,
        reaction: "thumbs",
        thread: { depth: 2 },
        anchor: { ...line.anchor, sha: "abc", extra: [1] },
      },
    ]);
    expect(r.comments[0]).toEqual({
      id: 41,
      status: "open",
      author: "reviewer",
      body: "Why is this retried?",
      createdAt: "2026-10-31T09:12:00Z",
      version: 3,
      anchor: { kind: "line", file: "src/retry.ts", side: "new", from: 18, to: 22 },
    });
    expect(Object.keys(r.comments[0] ?? {})).not.toContain("reaction");
  });

  test("a line anchor keeps the quote of its lines when the host sends it", () => {
    const r = read([{ ...line, anchor: { ...line.anchor, quote: "retry(3)" } }]);
    expect(r.comments[0]?.anchor).toEqual({
      kind: "line",
      file: "src/retry.ts",
      side: "new",
      from: 18,
      to: 22,
      quote: "retry(3)",
    });
  });

  cases(
    [
      ["a kind nobody defined", { kind: "region", x: 1, y: 2 }],
      ["no kind", { file: "a.ts", from: 1, to: 2 }],
      ["a missing anchor", undefined],
      ["a null anchor", null],
      ["a string for an anchor", "src/retry.ts:18"],
      ["a line anchor with no file", { kind: "line", side: "new", from: 1, to: 2 }],
      [
        "a line anchor that runs backwards",
        { kind: "line", file: "a.ts", side: "new", from: 9, to: 2 },
      ],
      ["a line anchor at line zero", { kind: "line", file: "a.ts", side: "new", from: 0, to: 2 }],
      [
        "a line anchor on a side nobody defined",
        { kind: "line", file: "a.ts", side: "both", from: 1, to: 2 },
      ],
      ["a text anchor with no quote", { kind: "text", prefix: "a", suffix: "b" }],
    ],
    ([what]) => `a comment with ${what} is kept, and unanchored`,
    ([, anchor]) => {
      const r = read([{ ...line, anchor }]);
      expect(r.skipped).toBe(0);
      expect(r.comments).toHaveLength(1);
      expect(r.comments[0]?.anchor).toBeNull();
      expect(r.comments[0]?.body).toBe("Why is this retried?");
      expect(r.comments[0]?.id).toBe(41);
    },
  );

  test("a text anchor with no prefix or suffix keeps its quote", () => {
    const r = read([{ ...text, anchor: { kind: "text", quote: "recieve" } }]);
    expect(r.comments[0]?.anchor).toEqual({
      kind: "text",
      quote: "recieve",
      prefix: "",
      suffix: "",
    });
  });

  test("a status that is neither open nor closed reads as open, so no comment is hidden", () => {
    expect(read([{ ...line, status: "resolved" }]).comments[0]?.status).toBe("open");
    expect(read([{ ...line, status: undefined }]).comments[0]?.status).toBe("open");
    expect(read([{ ...line, status: "closed" }]).comments[0]?.status).toBe("closed");
  });

  test("fields of the wrong type read as empty, and an element with no usable id is skipped and counted", () => {
    const r = read([
      { ...line, author: 7, createdAt: null, version: "3", body: ["x"] },
      { ...line, id: undefined },
      { ...line, id: "" },
      { ...line, id: 1.5 },
      { ...line, id: {} },
      "not an object",
      null,
      42,
    ]);
    expect(r.comments).toHaveLength(1);
    expect(r.skipped).toBe(7);
    expect(r.comments[0]).toMatchObject({ author: "", createdAt: "", version: null, body: "" });
  });

  cases(
    [
      ["nothing at all", ""],
      ["text that is not JSON", "no comments yet"],
      ["an object", '{"comments": []}'],
      ["a string", '"[]"'],
      ["two arrays", "[] []"],
      ["an array with text after it", "[]\nDone."],
    ],
    ([what]) => `${what} is not one JSON array`,
    ([, stdout]) => {
      const r = parseComments(stdout);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/one JSON array/u);
    },
  );
});

describe("formatComment: a comment as plain lines for a person", () => {
  const base = {
    id: 41,
    status: "open" as const,
    author: "reviewer",
    body: "Why is this retried?\nIt looks safe to drop.",
    createdAt: "2026-10-31T09:12:00Z",
    version: 3,
    anchor: null,
  };

  test("a line comment says the file, the side and the lines, then the words", () => {
    const text = formatComment({
      ...base,
      anchor: { kind: "line", file: "src/retry.ts", side: "new", from: 18, to: 22 },
    });
    expect(text).toBe(
      [
        "41 open, reviewer, 2026-10-31T09:12:00Z, version 3",
        "  on src/retry.ts, new side, lines 18 to 22",
        "  Why is this retried?",
        "  It looks safe to drop.",
      ].join("\n"),
    );
  });

  test("one line is said as one line, and a quote of the lines follows", () => {
    const text = formatComment({
      ...base,
      anchor: { kind: "line", file: "a.ts", side: "old", from: 5, to: 5, quote: "let x = 1;" },
    });
    expect(text).toContain("  on a.ts, old side, line 5");
    expect(text).toContain('  lines read: "let x = 1;"');
  });

  test("a text comment says the words it is on; no anchor says so", () => {
    expect(
      formatComment({
        ...base,
        anchor: { kind: "text", quote: "recieve", prefix: "will ", suffix: " the reply" },
      }),
    ).toContain('  on the text "recieve"');
    expect(formatComment(base)).toContain("  not anchored to a place on the page");
  });

  test("no author and no version leave those words out", () => {
    const first = formatComment({ ...base, author: "", version: null }).split("\n")[0];
    expect(first).toBe("41 open, 2026-10-31T09:12:00Z");
  });

  test("control characters in a comment are not passed to the terminal", () => {
    const text = formatComment({ ...base, body: "red \u001b[31mtext\u0007 here\ttab" });
    expect(text).not.toContain("\u001b");
    expect(text).not.toContain("\u0007");
    expect(text).toContain("red [31mtext here\ttab");
  });
});

describe("stateLine: what may be said about ticks", () => {
  test("with state set, ticks and line comments are said to be kept", () => {
    const line = stateLine(settings({ bridge: "page-bridge-v1", state: true }));
    expect(line).toContain("kept between visits");
  });

  test("without state, nothing says ticks will be kept", () => {
    for (const s of [
      settings(),
      settings({ bridge: "page-bridge-v1" }),
      settings({ bridge: "page-bridge-v1", state: false }),
      NO_PAGES,
    ]) {
      const line = stateLine(s);
      expect(line).not.toMatch(/kept between visits/u);
      expect(line).not.toMatch(/will be kept|are kept|stay|saved/u);
      expect(line).toContain("state");
    }
  });
});
