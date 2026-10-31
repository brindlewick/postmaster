# Check, publish and rebuild a review page

Part of [the review page](../review-page.md). This says how to check a built page in a real browser,
publish it, read and answer the reader's comments, and rebuild it when the branch moves. Building
it is in [Make a review page](make-a-page.md).

## Check the page

```sh
scripts/run review-page-gate <dir>
```

It serves `<dir>` on a loopback port, wraps `index.html` the way the Artifact publisher does, and
drives headless Chromium through Playwright at every width of the one-screen-at-a-time flow (390,
755, 823, 904, 1024 and 1199 px) and of the two-pane layout (1200 and 1440 px): light and dark at
390, 823 and 1440 px, light at the others, plus a plain run at 390 px without the publisher's
wrapper. It fails on: console errors, a failed request outside the fonts and highlight.js hosts,
page-level horizontal overflow, a tap target under 44 px, text under 13 px, a control cut off by the
window or by a box around it (Wrap and the bars included), fonts not loaded, a hidden element that
is shown, and below 1200 px: two screens shown at once, the tree not edge to edge, a file tap that
does not open its diff alone, Wrap that does not fold the lines or leaves wrapped lines scrolling
sideways, Back that does not restore the tree's open folders and scroll position, a file tapped
right after Back that does not stay open, the browser's back gesture that does not restore them
either, previous and next, ticks that do not survive a reload, the comment box, search, expand and
collapse and the ruling links; from 1200 px it fails on the split layout (the tree at the left, the
file beside it, no Back button).

Every run but the plain one also looks at the rows of a diff (`diff-layout`), on the file with the
longest line, and fails on a sign column or a number column in front of the code, on code that
starts more than 16 px from the left edge (of the window, or of its own box beside the tree), and on
a line number that is not a faint layer behind the code: below it in stacking order, left aligned 6
px in from the left edge of the row (within 2 px) and centered down the row, never taking a tap,
between 0.15 and 0.5 alpha, and still 6 px in from the left edge of the box after the box is
scrolled sideways.

Screenshots and `report.json` go to `--out` (default: a new temporary folder). `--quick` keeps 390
px light and dark, 1199 px light, 1200 px light and the plain run, so both sides of the 1200 px
split are always looked at. Exit 0 means every check passed, 1 means a check failed (the problems
are printed) or the arguments are wrong.

The repository has no browser dependency. Point the script at one: set `PLAYWRIGHT_CORE` to a
`playwright-core` or `playwright` package folder, and `CHROMIUM_PATH` to a Chromium executable (it
also looks in Playwright's cache folders). Without them it prints what to set and exits 2.

## Publish it

Publish `<dir>/index.html` with the Artifact tool, private (the default), with
`capabilities: {"db": {}}` and `files` mapping `review.json` and each `chunks/<k>.json` to their
paths in `<dir>`. Pass the `title` as the page name (it is read from the page's `<title>`), an `icon`
of `code`, and a one-sentence `description`. Then stop the session's watch on it at once. Read
`review.json` back with the Artifact tool's `read` and `path` and take the uuid from the folder it is
saved in; the link is `https://claude.ai/code/artifact/<uuid>`, given together with the exact title.

The Artifact rules the page already follows, so a change to it must too:

- Scripts load only from cdnjs, pinned to an exact version at least two weeks old (highlight.js
  11.11.1). Stylesheets load only from Google Fonts, with real fallback stacks. Everything else is
  inline.
- No `window.print`, no `alert`.
- Colours come from tokens defined on `:root`, with the dark values in both dark blocks.
- The page works at 400 px and never scrolls sideways. Fixed bars add the safe-area insets, and the
  sticky header uses `top: env(safe-area-inset-top, 0px)`.
- Never publish a page that holds a credential, a home path, a host name, an email address or a link
  to this machine. Read `review.json` and the chunks for them before the first publish. The builder
  removes email addresses and nothing else, and an environment file is shown by its name only.

## Read the comments

A comment is a document in the `comments` collection: `path`, `side` (`new` or `old`), `from`, `to`,
`text`, `by`, `at`. When the reader says they have commented, read them with ArtifactData `list` of
`comments`. Answer each with ArtifactData `set` in `comments`, document id `reply-<its id>`, data
`{replyTo, path, side, from, to, by: "claude", text, at}`; the reply shows under the comment without
a reload. Ticks are documents `r-<signature>` in the `reviewed` collection. Then act on what the
reader asked, in the conversation.

## Rebuild on a new head

When the head moves, run the same build command with the new `--head` into the same folder, with
the same `--key`, and publish the same file path again: the Artifact keeps its link, and ticks stay
on the files whose diff did not change. Comments pinned to a file that changed may point at shifted
lines. Rulings are found again by their text; if one fails, fix the layout.
