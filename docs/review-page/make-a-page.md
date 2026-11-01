# Make a review page

Part of [the review page](../review-page.md). This says how to build the page for a change: the
command, what it takes, the summary file and the layout config. Checking, publishing and rebuilding
are in [Check, publish and rebuild](check-publish-rebuild.md).

## The command

```sh
scripts/run review-page change <dir> --base <base> --head <full sha> --summary <summary.md> --page-title "<Name>"
```

Run it from the repository the change belongs to. `<dir>` is a new folder in the session's
scratchpad. The command reads git (and `gh` for `--pr` and `--ticket`) and writes `index.html`,
`review.json` and `chunks/<k>.json` into `<dir>`, and `publish.html` beside them: the same page with
that data inside it and in a complete document, the one file to publish. It prints one line: files, groups, lines, chunks,
addresses removed, how many file purposes came from the heuristics, how many files are withheld, and
then the path of `publish.html`. It exits 1, naming the text, when the layout does not parse or a
ruling's link finds no line.

| input | what it is |
|---|---|
| `--base`, `--head` | the range; the page diffs the head against the merge base, as GitHub does. Pin the head to a full SHA, because a branch moves. |
| `--pr <n>` | instead of the two refs: title, summary (the pull request's text), base and head come from the pull request through `gh`. A title of the form `#<n>, <title>` also names the ticket. |
| `--ticket <n>`, `--title` | the ticket's text from a GitHub issue, or just a title for the page's heading. |
| `--ticket-body <file>` | the ticket's text from a Markdown file, for a ticket that is not a GitHub issue. Give only the part the reader signed off. |
| `--summary <file>` | Markdown shown on the Overview. See below. |
| `--layout <file>` | a layout config merged over the default one. See below. |
| `--purposes <file>` | a JSON object of file path to one-line purpose, merged into the layout's purposes. |
| `--page-title <name>` | the page's `<title>`, which is its name on the host: two to four words, a name and not a caption. Default `Code Review`. |
| `--key <name>` | prefix of what the page keeps in the reader's browser. Keep it the same across rebuilds of one review so ticks and open folders survive. Default `review-page`. |

An email address outside the reserved example domains becomes `<address removed>` in every diff and
text, with line numbers unchanged. Nothing else is removed.

## The summary file

Plain words, no bold, no em or en dashes, and a few words of definition for any jargon. Use `###`
headings. A useful shape: what the change does; how the files are grouped; where to look first.

Questions for the reviewer go last, under a heading that contains the word "rulings", "decisions" or
"open questions", as a numbered list. Each item starts with a short title sentence, then the word
`Open.` or `Decided.`, then a few plain sentences. The Overview turns that list into cards, one per
item, using the layout's `rulings` for the state and the links.

## The layout config

A JSON file with these keys, all optional. The default is
[`skills/review-pages/page/layout.default.json`](../../skills/review-pages/page/layout.default.json).
A `--layout` file is merged over it: `groups`, `withheld` and `rulings` replace the default lists,
`areaRoots` is replaced, `purposes` merge by path, `first` appends.

- `groups`: the groups of the Order tab, in display order. Each has `id`, `title`, and optionally
  `num` (the importance tier shown in a badge; empty for none), `sub` (what the group is, one line),
  `note` (a caution shown on the group), `collapsed` (starts folded, and its folders start closed in
  the tree), `match` (regular expressions, `u` flag, tested against the whole path), `priority`
  (matching order, higher first; display order is the list order), `by: "area"` (split the group
  into one group per area, an area being `apps/<name>`, `packages/<name>` and so on for the roots in
  `areaRoots`, else the first folder) and `order` (paths placed first). A file joins the first
  group, by priority, whose `match` it satisfies. A group with no `match` is the fallback for files
  no other group takes.
- `areaRoots`: folder names under which each child is an area.
- `withheld`: `{ match, text }` rules. A file whose path matches is listed with its name and size of
  change, and `text` is shown instead of its diff. The default withholds environment files.
- `first`: paths or globs (`*`, `**`) of files to mark "read closely".
- `purposes`: path to one plain sentence. A file with no entry gets a purpose from the heuristics
  ("New file, 120 lines.", "Tests for cart.", "Dependency lockfile, rewritten by the package
  manager."). The build line says how many came from the heuristics; write the rest.
- `rulings`: `{ n, state: "open" | "decided", title, links: [{ path, match, to_match?, span?, label }] }`.
  A link names a line by text: `match` is a substring of one line of the file at the head,
  `to_match` ends a range at the next line containing it, `span` ends it that many lines on. The
  build resolves them to line numbers and fails, naming the text, when one is not found, so a head
  that moves a line is noticed. The `title` must be the first sentence of the matching numbered item
  of the summary.

Within a group, files come in `order` first, then by changed lines, most first, then by path. The
same input always gives the same page: order never depends on the order git lists files.
