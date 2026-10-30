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
  js/                  core, data, ticks, diff, tree, order, overview, find, nav, boot
scripts/lib/review-tree.ts      the tree (pure; also inlined into the page)
scripts/lib/review-layout.ts    grouping, ordering, purposes and rulings (pure)
scripts/lib/review-model.ts     review.json and the chunks (pure)
scripts/lib/review-assemble.ts  the shell, stylesheets and scripts into one file (pure)
scripts/lib/review-assets.ts    reads the assets (the edge)
scripts/review-page.ts          the command (git and gh, files written)
scripts/review-page-gate.ts     the render gate
```

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
  Colours come from the tokens in `css/10-tokens.css`; add a token there with its dark value. The
  files in `js/` are one script cut into pieces that share a scope, so Oxlint's unused-name rule is
  off for that folder in `.oxlintrc.json`; the tests parse the assembled script.
- Add a tab: a button in `page.html`'s `.tabs`, a `<section class="screen" id="screen-<name>">`, a
  render function in a new `js/` file listed in `assets.json`, and the name in `applyScreens` and
  `selectTab` in `js/09-nav.js`; add its checks to `scripts/review-page-gate.ts`.
- Add a grouping rule: a group in the layout, or a pattern in a group's `match`; add a case to
  `scripts/lib/review-layout.test.ts`. Add a heuristic purpose in `defaultPurpose` with its test.
- Keep the rules the gate holds: 44 px targets, 13 px text, no horizontal page scroll, both themes,
  only the allowed external loads.
- Fixtures are invented. A test builds its sample repository in a temporary folder
  (`scripts/lib/review-sample.ts`); no file in this repository holds content from a real project.

Left for later: a diff renderer swapped in for the hand-written one (a library that draws unified
diffs), reading the page on a real phone, and a whole-file view.
