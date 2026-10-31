# How the review page is made, and how to improve it

Part of [the review page](../review-page.md). This is for changing the page or its builder: what the
files are, how the build stays the same every time, and how to add to it.

## How the page is made

```
skills/review-pages/page/
  page.html            the markup: header, four screens, the file list sheet, the toast
  assets.json          the order of the files below; the builder inlines them
  layout.default.json  the default groups, withheld rule and area roots
  css/                 tokens, header, overview, tree, order, file, find, wide
  js/                  core, data, ticks, diff, tree, order, overview, find, nav, boot (ES modules)
scripts/lib/review-tree.ts      the tree (pure; also inlined into the page)
scripts/lib/review-layout.ts    grouping, ordering, purposes and rulings (pure)
scripts/lib/review-model.ts     review.json and the chunks (pure)
scripts/lib/review-assemble.ts  the shell, stylesheets and scripts into one file (pure)
scripts/lib/review-assets.ts    reads the assets (the edge)
scripts/review-page.ts          the command (git and gh, files written)
scripts/review-page-gate.ts     the render gate
```

The scripts in `js/` are ES modules: each exports what the others use and imports what it takes, so
Oxlint checks them one by one. The builder takes the import and export lines off and inlines the
files, in the order of `assets.json`, as one script; a test checks that every import names a file of
the manifest and a name that file exports.

The page is one HTML file plus `review.json` (the files, groups, rulings and summary) and
`chunks/<k>.json` (the diffs, loaded when a file is opened). `review.json` has a `version` (now 2).
The builder keeps no clock, random id or machine path in any output, so two builds of the same range
with the same inputs are byte for byte the same; the tests build an invented sample repository twice
and compare. The tree's logic is the one file `scripts/lib/review-tree.ts`, unit tested, and the page
inlines a transpiled copy with its `export` keywords removed, so it is written once.

## Improve it

- Run the tests for what you touch: `bun test scripts/lib/review-tree.test.ts` and its siblings, and
  `bun test scripts/review-page.test.ts` for the demo build. The demo's data and the page's structure
  (its loads, its ids) are compared with goldens in `scripts/fixtures/review-page/`; after an
  intended change run the test with `REVIEW_PAGE_GOLDEN=update`, read the diff of the goldens, and
  commit them.
- Run the gate on a demo build: build with `scripts/run review-page demo <dir>`, then
  `scripts/run review-page-gate <dir>`, and look at the screenshots.
- Change the look or behaviour in the asset files; each file has one job and a comment at its top.
  Colours come from the tokens in `css/10-tokens.css`; add a token there with its dark value.
- Add a tab: a button in `page.html`'s `.tabs`, a `<section class="screen" id="screen-<name>">`, a
  render function in a new `js/` module listed in `assets.json` (export it, and import what it
  uses), and the name in `applyScreens` and `selectTab` in `js/09-nav.js`; add its checks to
  `scripts/review-page-gate.ts`.
- Add a grouping rule: a group in the layout, or a pattern in a group's `match`; add a case to
  `scripts/lib/review-layout.test.ts`. Add a heuristic purpose in `defaultPurpose` with its test.
- Keep the rules the gate holds: 44 px targets, 13 px text, no horizontal page scroll, no control cut
  off by the window or by a box around it, both themes, only the allowed external loads. A diff row
  is the code and nothing in front of it (the code starts within 16 px of the left edge), with the
  line number on a faint layer behind it, left aligned `--numgap` in from the left edge of the row
  (the gate holds it to `NUMBER_INSET`, and a test fails when the two differ); the number's colour
  is the token `--lnum`, and the gate keeps its alpha between 0.15 and 0.5.
- Keep the one width that matters, 1200 px: below it the page shows one screen at a time, from it the
  tree is a left pane. It is written in `css/80-wide.css`, in `js/09-nav.js` and as `WIDE_FROM` in
  `scripts/review-page-gate.ts`, and a test in `scripts/review-page-gate.test.ts` fails when the
  three differ or a second width query appears. The gate walks 1199 and 1200 px so a change of the
  number in one place only is caught by the browser as well.
- Fixtures are invented. A test builds its sample repository in a temporary folder
  (`scripts/lib/review-sample.ts`); no file in this repository holds content from a real project.

Left for later: a diff renderer swapped in for the hand-written one (a library that draws unified
diffs), reading the page on a real phone, and a whole-file view.
