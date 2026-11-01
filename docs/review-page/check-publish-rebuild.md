# Check, publish and rebuild a review page

Part of [the review page](../review-page.md). This says how to check a built page in a real browser,
publish it, read and answer the reader's comments, and rebuild it when the branch moves. Building
it is in [Make a review page](make-a-page.md).

## Check the page

```sh
scripts/run review-page-gate <dir>
```

It serves `<dir>` on a loopback port, wraps `index.html` in the skeleton a host puts around a page, and
drives headless Chromium through Playwright at every width of the one-screen-at-a-time flow (390,
755, 823, 904, 1024 and 1199 px) and of the two-pane layout (1200 and 1440 px): light and dark at
390, 823 and 1440 px, light at the others, plus a plain run at 390 px without the
host skeleton. It fails on: console errors, a failed request outside the fonts and highlight.js hosts,
page-level horizontal overflow, a tap target under 44 px, text under 13 px, a control cut off by the
window or by a box around it (Wrap and the bars included), fonts not loaded, a hidden element that
is shown, and below 1200 px: two screens shown at once, the tree not edge to edge, a file tap that
does not open its diff alone, Wrap that does not fold the lines or leaves wrapped lines scrolling
sideways, Back that does not restore the tree's open folders and scroll position, a file tapped
right after Back that does not stay open, the browser's back gesture that does not restore them
either, previous and next, ticks that do not survive a reload, the comment box, search, expand and
collapse and the ruling links; from 1200 px it fails on the split layout (the tree at the left, the
file beside it, no Back button).

The page bridge is driven too, on the phone in light and dark and at 755 and 904 px, through a
stand-in viewer: `/host.html` frames the page in a sandbox with an origin of its own and answers its
messages as the contract says, and can delay, drop, fail, rate-limit or conflict. The checks are
`bridge-ticks` (ticks come back after a reload), `bridge-new-version` (the file whose diff changed
starts unticked), `bridge-not-saved` and `bridge-unanswered` (Not saved after 1.5 seconds with no
hello answered, and after 5 seconds with no write answered; the second on the phone in light only),
`bridge-conflict`, `bridge-comment` (it shows at once and arrives as a line anchor with the text of
its line) and `bridge-focus` (a line of each side of the diff). A check also fails if the stand-in
refused or ignored a message the page sent. With no viewer the Not saved line shows on every screen
of the other runs, which audit it like the rest. A control in the gate's tests puts a fault into the
page or the viewer, one at a time, and expects each to be named.

Every run but the plain one also looks at the rows of a diff (`diff-layout`), on the file with the
longest line, and fails on a sign column or a number column in front of the code, on code that
starts more than 16 px from the left edge (of the window, or of its own box beside the tree), and on
a line number that is not a faint layer behind the code: below it in stacking order, left aligned 6
px in from the left edge of the row (within 2 px) and centered down the row, never taking a tap,
between 0.15 and 0.5 alpha, and still 6 px in from the left edge of its row after its group is
scrolled sideways.

Every run but the plain one also serves the first file with a diff as a file of synthetic lines (a run
of three wide lines, a short line below it, a single wide line, a line a little wider than a phone, and
a run that depends on the width) and fails unless the lines wider than the box are in groups that are
exactly the runs of them and the two lines below each (`sideways`): each a scroll container with no
scrollbar and no scroll chained to the page, shaded at the edge it goes on past, that scrolls alone, with
the lines below it staying at its left edge and taking a touch. With touch, real swipes must move one
line's group alone and select nothing, and scroll the page from a line and from a file name; the comment
box stays at the left edge of its group and its text field leaves a sideways swipe to the page; the
groups are made again when the window is unfolded or folded and when the fonts change. On the file
screen, the overview, the order, the tree and the file list it gives every one-line label a path's worth
of text and fails unless each is wider than its place, on one row with a fade, scrolls alone with no
scrollbar, lies over no control and leaves the page its width; a tap on a name in the order list still
opens the file. A diff of more lines than the page draws
at a time gets its Show more button pressed (`show-more`): the button is part of no group and the group
keeps where it was scrolled.

Screenshots and `report.json` go to `--out` (default: a new temporary folder). `--quick` keeps 390
px light and dark, 1199 px light, 1200 px light and the plain run, so both sides of the 1200 px
split are always looked at. Exit 0 means every check passed, 1 means a check failed (the problems
are printed) or the arguments are wrong.

The repository has no browser dependency. Point the script at one: set `PLAYWRIGHT_CORE` to a
`playwright-core` or `playwright` package folder, and `CHROMIUM_PATH` to a Chromium executable (it
also looks in Playwright's cache folders). Without them it prints what to set and exits 2.

## Publish it

```sh
scripts/run pages publish <dir>/publish.html --slug review-<repo>-<number> --marks
```

`publish.html` is the page with its data inside it, so it is one file. `pages publish` runs the
publish command the person's `[pages]` settings name and no other ([the pages
contract](../pages-contract.md)); `--marks` adds one sentence about whether the host keeps the
reader's ticks, which it promises only when `state` is set. It prints `Title: <title>` and the
page's link on the next line, as the host printed them; give the reader both. The page's `<title>`
is its name (`--page-title` when it was built). `scripts/run pages status` says whether a publish
command is set: with none, the page is built and not published, and `pages publish` exits 2 naming
`publish`. Read `publish.html` for anything private first, as the next list says.

The rules a host's viewer may hold a page to, which the page already follows, so a change to it must
too:

- Scripts load only from cdnjs, pinned to an exact version at least two weeks old (highlight.js
  11.11.1). Stylesheets load only from Google Fonts, with real fallback stacks. Everything else is
  inline.
- No `window.print`, no `alert`.
- Colours come from tokens defined on `:root`, with the dark values in both dark blocks.
- The page works at 400 px and never scrolls sideways. Fixed bars add the safe-area insets, and the
  sticky header uses `top: env(safe-area-inset-top, 0px)`.
- Never publish a page that holds a credential, a home path, a host name, an email address or a link
  to this machine. Search `publish.html` for them before the first publish. The builder removes email
  addresses and nothing else, and an environment file is shown by its name only.

## Read the comments

```sh
scripts/run pages comments <slug>
```

prints the open comments on the page, each with its id, who and when, the version it was made on,
where it points and its words; `--all` adds the closed ones and `--json` prints them as one array.
A line comment points at a file, a side (`new` or `old`) and lines, with the text of those lines
when the host sends it; a comment on selected text points at the words; a comment the tool has no
place for is printed without one. When the reader says they have commented, read them, answer each
in the conversation, act on what the reader asked, and close each one answered:

```sh
scripts/run pages close <id>
```

With no `comments` command in the settings the tool says it cannot read comments for this host, and
with no `close` command it says the comments stay open; neither stops anything else.

## Rebuild on a new head

When the head moves, run the same build command with the new `--head` into the same folder, with
the same `--key`, and publish the new `publish.html` to the same slug: the page keeps its link, and
where the host keeps ticks (`state`) they stay on the files whose diff did not change. Comments
pinned to a file that changed may point at shifted lines. Rulings are found again by their text; if
one fails, fix the layout.
