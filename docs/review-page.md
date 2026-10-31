# The review page

A page a person reads a code change on. It is made for a phone and works on an iPad and a
desktop. `scripts/run review-page change` builds it from a git range, a session publishes it with
`scripts/run pages publish`, and the reader ticks files off as reviewed and comments on lines. The skill that sessions
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
  opens the next. Lines wider than the screen scroll sideways with no scrollbar, a run of
  consecutive ones together as a group and a single one alone; a line that fits ends a run, but the
  first two below it stay in the group, pinned at the left, so that a finger can sit under the
  text, and the page never moves sideways. Wrap, in the file's head, folds long lines instead. A row
  is the code and nothing in front of it, so the code starts 8 px from the edge of the screen: there
  is no sign column and no number column. Added and removed lines are told apart by their colour and a 3 px
  edge in a stronger colour at the left of the row, and each line's number is a faint layer behind
  the code, left aligned 6 px in from the left edge of the row and centered down it, that stays at
  the left edge of its group as the group scrolls. Tapping anywhere on a row opens a comment box
  under it, pinned at the left edge of the group; tapping a second line extends the range.
- **Long names.** A name, a path or a count wider than its place scrolls sideways on its own with
  no scrollbar and a fade at the end it goes on past: in the tree, the order, the file list, a
  file's head and bar, and under a ruling link. Text meant to be read as prose wraps.

Below 1200 px the page shows one screen at a time, however wide the screen is: a phone, a
folded-out phone and a tablet all read a file at its full width. From 1200 px up (a laptop or a
desktop window), the tree (or the order) is a left pane and the file is read beside it.

A sticky header shows the tabs and the reviewed count (`12/107`); on the file screen it shows Back,
the file's position and name, and previous and next. The count button, and the file name, open a
search sheet over every file's name and purpose.

## How ticks and comments are kept

A page in a sandboxed frame has no storage of its own, so it asks the viewer around it through the
page bridge, an open contract of messages (Page bridge v1). A viewer that answers the page's hello
within 1.5 seconds keeps its state between visits and stores the line comments it sends.

- A tick is the key `tick:<path>:<sha256 hex>`. The builder hashes the file's diff as the page shows
  it (`hash` in `review.json`), so a file whose diff did not change keeps its tick on a new head and a
  changed one starts unticked.
- A new line comment shows at once and is sent with a line anchor: file, side, lines and their text.
  The viewer's comments are shown when the page opens, and its request to show lines opens the file
  there.
- With no answer the page keeps both in memory for the visit (ticks also in the browser's storage,
  where the frame allows it) and says "Not saved". A page with the `db` capability keeps them in its
  database.

The page's side is `scripts/lib/page-bridge*.ts`; the contract is [Page bridge v1](page-bridge.md).

## Where the detail is

1. [Make a review page](review-page/make-a-page.md): the build command and its inputs, the summary
   file, and the layout config that groups the files, describes them and ties the rulings to lines.
2. [Check, publish and rebuild](review-page/check-publish-rebuild.md): the render gate, publishing
   with the person's own `[pages]` commands, reading and answering comments, and rebuilding when
   the head moves.
3. [How the page is made, and how to improve it](review-page/improve-it.md): the files behind the
   page, the tests and goldens, and how to add a tab, a grouping rule or a purpose.

The whole run, from a repository holding the change:

```sh
scripts/run review-page change <dir> --base <base> --head <full sha> --summary <summary.md> --page-title "<Name>"
```

```sh
scripts/run review-page-gate <dir>
```

Then publish `<dir>/publish.html`, the page with its data inside it, with
`scripts/run pages publish <dir>/publish.html --slug <slug> --marks` and, when the reader has
commented, read and answer the comments with `scripts/run pages comments <slug>`. To see the page
without a change of your own, build the demo, an invented sample repository:

```sh
scripts/run review-page demo <dir>
```
