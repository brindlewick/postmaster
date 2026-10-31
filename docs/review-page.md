# The review page

A private page a person reads a code change on. It is made for a phone and works on an iPad and a
desktop. `scripts/run review-page change` builds it from a git range, a session publishes it as an
Artifact, and the reader ticks files off as reviewed and comments on lines. The skill that sessions
follow is [`skills/review-pages/SKILL.md`](../skills/review-pages/SKILL.md); this document says what
the reader gets and points to the three that hold the detail.

## What the reader gets

Three tabs and a file screen.

- **Overview.** The change's title and size, a reviewed count with a button to start or continue,
  the summary the session wrote, the rulings (open questions, each with links that jump to the lines
  they are about), the ticket's text, and a button that copies a note for the chat.
- **Tree.** The file tree of the whole change, to see its structure. Below 1200 px wide (a phone, a
  folded-out phone, a tablet) it is one column that runs edge to edge. Folders come first, then
  files, each alphabetical. A chain of folders with
  one child each is one row (`apps/shop/src`). A folder row shows its file count and its added and
  deleted lines. A file row shows its name, a status badge (A added, M modified, D deleted, R
  renamed), its added and deleted lines, a reviewed tick and a comment count. A search box filters
  the tree. The first two levels are open; folders holding only tests or generated files start
  closed. Expand all and Collapse all are buttons. What is open is remembered in the reader's
  browser.
- **Order.** The same files grouped by importance (source, config and docs, tests, generated files),
  each with a one-line purpose in plain words and a "read closely" mark where the layout says so.
  Tests and generated files start folded.
- **File.** One file's unified diff. Tapping a file in the tree or the order opens it. Below 1200 px
  it replaces the list; Back (the on-screen button, or the browser's back gesture through history)
  returns to the list with the same open folders and scroll position. Previous and next move
  through the files in the order of the list the reader came from: tree order from the tree, review
  order from the order or the overview. A button at the end of the file ticks it as reviewed and
  opens the next. Code scrolls sideways inside its own box and never moves the page; Wrap, in the
  file's head, folds long lines instead. A row is the code and nothing in front of it, so the code
  starts 8 px from the edge of the screen: there is no sign column and no number column. Added and
  removed lines are told apart by their colour and a 3 px edge in a stronger colour at the left of
  the row, and each line's number is a faint layer behind the code, centered across the box and
  down the row, that stays in the middle of what is shown as the code scrolls. Tapping anywhere on
  a row opens a comment box under it; tapping a second line extends the range.

Below 1200 px the page shows one screen at a time, however wide the screen is: a phone, a
folded-out phone and a tablet all read a file at its full width. From 1200 px up (a laptop or a
desktop window), the tree (or the order) is a left pane and the file is read beside it.

A sticky header shows the tabs and the reviewed count (`12/107`); on the file screen it shows Back,
the file's position and name, and previous and next. The count button, and the file name, open a
search sheet over every file's name and purpose.

Reviewed ticks are kept in the reader's browser and, when the page has the `db` capability, shared
across their devices. A tick is keyed by a short hash of the file's path and diff, so a rebuild on a
new head keeps the ticks of files whose diff did not change and clears the others.

## Where the detail is

1. [Make a review page](review-page/make-a-page.md): the build command and its inputs, the summary
   file, and the layout config that groups the files, describes them and ties the rulings to lines.
2. [Check, publish and rebuild](review-page/check-publish-rebuild.md): the render gate, publishing
   as an Artifact, reading and answering comments, and rebuilding when the head moves.
3. [How the page is made, and how to improve it](review-page/improve-it.md): the files behind the
   page, the tests and goldens, and how to add a tab, a grouping rule or a purpose.

The whole run, from a repository holding the change:

```sh
scripts/run review-page change <dir> --base <base> --head <full sha> --summary <summary.md> --page-title "<Name>"
```

```sh
scripts/run review-page-gate <dir>
```

Then publish `<dir>/index.html` with the Artifact tool and, when the reader has commented, read and
answer the comments there. To see the page without a change of your own, build the demo, an
invented sample repository:

```sh
scripts/run review-page demo <dir>
```
