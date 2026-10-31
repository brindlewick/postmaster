---
name: review-pages
description: Show the user a change, or code named by a ticket, on a page made for a phone and an iPad. A review page opens on an overview (the summary and the open rulings with links to their lines), has a tab with the file tree of the whole change, a tab that orders the files by importance with a plain purpose each, and a diff screen with reviewed ticks and comments on lines. A code viewer shows ticket-linked code files in colour at the lines the ticket cites. A story page tells a finished change, or a ticket, as one scroll: the change drawn first, then shown in code beside the ticket's words. Each page is one file, published with the publish command the person's [pages] settings name. Use it when the user reviews a change with automatic merging off, or opens files named in a ticket, and to tell a finished change in the order of the ticket's criteria.
---

# Review pages

A **review page** for a change, a **code viewer** for code files a ticket names, and **story
pages**, shaped with the user in #214. Every page is one self-contained HTML file. `<tool>`
below is the postmaster repository: the folder two above this file once its link is resolved.
Run a builder from the repository the change belongs to; `<repo>` is that repository.

## Publishing a page

A page is published with `<tool>/scripts/run pages publish`, which runs the publish command the
person's `[pages]` settings name ([the pages contract](../../docs/pages-contract.md)) and no
other. This skill names no host and no host's command, and never publishes any other way.

- Before building a page the user will want to read, check that a publish command is set:
  `<tool>/scripts/run pages status --project <repo>` exits 2 when none is. Then build the page if
  it is still wanted, say in one line that nothing can be published because `publish` is not set
  in `[pages]`, and give the file's path.
- Publish: `<tool>/scripts/run pages publish <file> --slug <slug> --project <repo>`, with
  `--marks` for a page whose reader ticks files or comments on lines (the review page). It
  prints `Title: <title>` and the page's link on the next line; give the user both, exactly as
  printed. Publishing to a slug that exists adds that page's next version, so a rebuilt page
  goes to the slug it had.
- Slugs, from `<tool>/scripts/run pages slug <word>...`: `review-<repo>-<number>` for a review
  page (the pull request's number, else the ticket's, else the head's first seven characters),
  `code-<repo>-<sha>` for a code viewer, `story-<repo>-<ticket>` for a story page, where
  `<repo>` is the repository's folder name.
- Comments: when the user says they have commented, read the open ones with
  `<tool>/scripts/run pages comments <slug> --project <repo>`. Each has its id, where it points
  and its words. Answer each one in the chat, act on what it asks, and close it with
  `<tool>/scripts/run pages close <id> --project <repo>` once answered. When the command says
  it cannot read comments for this host, say so and ask the user what they wrote.
- The tool says nothing about ticks being kept unless the person's settings say the host keeps
  them (`state`); do not promise it either.
- A page is for the user alone: never share it, and never write its link into a repository or
  into text that becomes public.
- Before the first publish, read the page for home paths, host names, private addresses and
  anything private. The builders remove email addresses and nothing else, and show an
  environment file by its name only; publish nothing private.

## A review page for a change

A phone-first page: an overview, a Tree tab with the file tree of the whole change (folders with
their file and line counts, a search box, full width below 1200 px), an Order tab with the files by
importance and a plain purpose each, and a diff screen reached by tapping a file, with Back, previous
and next, reviewed ticks and a comment box under a tapped line. It shows one screen at a time below
1200 px, a folded-out phone and a tablet included, and a tree pane beside the file from 1200 px.
What the reader gets, and where the detail is: [the review page](../../docs/review-page.md).

1. Write the summary in a Markdown file in your scratchpad: what the change does, how the files are
   grouped, where to look first, then the questions for the reader as a numbered list under a
   heading with "rulings", "decisions" or "open questions" in it. Plain words, no bold, no dashes,
   a few words of definition for any jargon.
2. Where the default grouping does not fit, or the page should carry purposes, "read closely" marks
   and rulings with links to lines, write a layout config in a JSON file in your scratchpad. The keys
   are in [Make a review page](../../docs/review-page/make-a-page.md).
3. Build the page into a folder of your scratchpad:
   - a pull request: `<tool>/scripts/run review-page change <dir> --pr <number>`. The title, its text as
     the summary, and the ticket it names (`#<n>, <title>`) come from GitHub.
   - a run's branch before its pull request: `<tool>/scripts/run review-page change <dir> --base <base>
     --head <full sha> --summary <file> --layout <file> --page-title <name>`. Pin the head to a full
     SHA. A ticket that is not a GitHub issue has its text in a Markdown file, given with
     `--ticket-body <file>`.
   It prints the files, groups, lines and chunks, how many addresses it removed, how many
   purposes came from the heuristics (write the rest in the layout) and how many files are withheld,
   then the page to publish: `<dir>/publish.html`, the page with its data inside it. `index.html`
   beside it is the same page loading its data from `review.json` and `chunks/`, which the next step
   checks. The builder fails, naming the text, when a ruling's link no longer finds its line.
4. Look at it before publishing: `<tool>/scripts/run review-page-gate <dir>` serves the page and
   checks it in a headless browser at widths from 390 to 1440 px (one screen at a time below
   1200 px, two panes from it), in light and dark, then writes screenshots. Read what it prints,
   look at the 390 px and the 904 px screenshots, and fix what it names. The browser it needs and
   its checks are in
   [Check, publish and rebuild](../../docs/review-page/check-publish-rebuild.md).
5. Read `<dir>/publish.html` for anything private, as the previous section says, then publish it
   with `--marks` to the slug `review-<repo>-<number>`.
6. When the user says they have commented, read and answer the comments as the previous section
   says. A line comment carries its file, its side (`new` or `old`) and its lines.
7. When the head moves, build again into the same folder with the same `--key` and publish the
   new `publish.html` to the same slug: the link stays, and where the host keeps ticks they stay
   on the files whose diff did not change.
8. The verdict comes in the chat. The page has no verdict control and shows no checks or review
   findings, by the user's choice.

## A code viewer for a ticket's files

1. Build one viewer for the files the ticket names, code and Markdown alike:
   `<tool>/scripts/run review-page files <dir> <ref> <path>...`. It writes `<dir>/index.html`
   with every file inside it, the one file to publish. Read it for anything private, then publish
   it to the slug `code-<repo>-<sha>`.
2. Link each file from the ticket at the lines it cites, with the page's link and
   `#f<k>-L<a>-L<b>`, where `f<k>` is the file's id (`f0` for the first path given, `f1` for the
   second). The link opens the page at those lines, lit. Put the links in the ticket's draft or
   document, never in text that becomes public.
3. The viewer takes no comment box of its own: the user comments on selected text where the host
   takes comments, and the session reads them as the publishing section says.

## A story page for a ticket

1. Write the story beside the ticket: a `story.json` naming the sections (the opening, one
   per acceptance criterion, the end), the scenes (the picture; the ticket's text, as
   excerpts or whole; a drawing per part with named states; code and Markdown files at the
   ticket's base with the cited lines lit; the list of cited code no step shows) and the
   steps (a title, two to four sentences, the scene, what it lights, and whether the
   ticket's words show as an excerpt), with each drawing as an SVG beside it. Draw the
   mechanism, not its name; label the arrows; keep text at 11 to 13 pixels in a view box
   about 360 wide; take every colour from the page's tokens; give each drawing a caption.
   The opening's image scene names the picture's prompt file, which asks Codex's image
   tool for one picture saved as `picture.png`, in the style of `<tool>/docs/poster.jpg`,
   with the exact words of every ribbon.
2. Build it: `<tool>/scripts/run story-page build <repo> <story-dir> <dir>
   --ticket-body <ticket.json>`, where `ticket.json` holds the ticket's title and body
   (`gh issue view <n> --json title,body` writes it) and `<repo>` is the repository the
   ticket cites. The builder draws the picture through `<tool>/scripts/run story-picture`
   with the postmaster poster as its style; each picture counts against the Codex limit
   the Codex lanes use. It refuses a section that shows code before any drawing, a state
   the story does not declare, and a link at another commit, and writes `index.html`,
   `sheet.html` and the picture file only when every check passes.
3. Look at the picture, its lettering included, in the picture file beside the page, and
   at every drawing in every state in `sheet.html`, at phone width in light and dark,
   before publishing. Rebuild, for a newly drawn picture, if a word comes out wrong.
4. Read `index.html` back for home paths, host names, private addresses and anything
   private, as the publishing section says: the builder removes email addresses and
   nothing else.
5. Publish `index.html`, which holds the picture and the data inside it, to the slug
   `story-<repo>-<ticket>`, as the publishing section says. Without `--marks`: the page has
   no ticks.
6. The page is for reading: it has no verdict. The user answers in the chat and edits the
   ticket in its document, as now; a comment left on the page is read and answered as the
   publishing section says.

## A story page for a finished change

The change drawn first, then shown in code: one scroll from an opening through a section per
acceptance criterion to what is left out, with the ticket's words, a drawing or the code in the
panel beside each step. Build it for a change that is verified and not yet pushed, or already
merged. The review page stays the place for comments on lines.

1. Write the story in a folder of your scratchpad:
   - `ticket.md`: the ticket's signed-off text, cut before the pipeline's own sections.
   - `diagrams/<name>.svg`: one drawing per part, with named states. Draw the mechanism, not
     its name; label the arrows; keep text at 11 to 13 pixels in a view box about 360 wide.
     Classes: `dg` on the svg, `bx`, `t1`, `t2`, `t3`, `mono`, `ok`, `bad`, `ln`, `dash`,
     `ah`. `on-<state>` shows an element only in that state, `hl-<state>` lights it,
     `dim-<state>` fades it; every state a class names is declared in the scene.
   - `story.json`: `title`, `ticketLabel`, `ticketTitle`, optionally `ticketUrl`, `eyebrow` and
     `footer` (the closing line; the default is written for the user who asked for the page and
     points comments to the chat, so set it, and the eyebrow, for a page that others will read); `base` and `head`, the commits the change is read between; `sections` (`id`,
     `label`, `title`: the opening, one per criterion, the tests, the end); `scenes`; `steps`.
   - Scenes, each with an `id`: `{kind: "doc", from: "file", file, title, label, chip}` for
     the ticket; `{kind: "diagram", svg, states, label, chip, caption}`; `{kind: "head", file,
     from, to}` for a file as it stands at the head, its changed lines marked; `{kind: "base",
     file, from, to}` for a file as it stood at the base; `{kind: "leftovers", label, chip}`
     for the list of changed lines no step shows.
   - Steps: `id`, `section`, `scene`, `title`, `text` of two to four sentences, and what the
     scene needs: `focus` as `[from, to]` line ranges lit in a code scene, `marks` as `{line,
     text: [words]}` on a lit line, `find` as ticket strings lit (each in exactly one block
     of the ticket), `state` for a diagram. The first step has `kind: "title"`; a step that
     opens a criterion has `kind: "criterion"`. The last step shows the leftovers scene, and
     its text may use `{shown}`, `{changed}` and `{left}` for the counts.
2. Check it: `<tool>/scripts/run story-change check <repo> <story-dir>`. It names every
   problem at once: a mark not on its line, a focus outside its window, a state a drawing does
   not declare, a ticket string in no block or in two, a changed line no step shows and no list
   holds. Fix them and run it again until it prints its one line.
3. Build it: `<tool>/scripts/run story-change build <repo> <story-dir> <dir>`. It writes
   `index.html`, `preview-light.html` and `preview-dark.html` only when every check passes, and
   prints the steps, lines and email addresses it removed.
4. Look at the page, not only the data: the two previews at desktop and phone width, in light
   and dark, with every drawing in every state. Nothing scrolls sideways, the fonts load and the
   console is clean.
5. Read `index.html` back for home paths, host names, private addresses and anything private, as
   the publishing section says: the builder removes email addresses and nothing else.
6. Publish `index.html` to the slug `story-<repo>-<ticket>`, as the publishing section says, and
   give the user the title and the link as it prints them.
7. The page is for reading and has no verdict; a comment left on it is read and answered as the
   publishing section says.

## Never

- Share a page, or publish one that holds a credential, a home path, a host name, an email
  address, a link to this machine, or a value from `~/.config`, `~/.claude` or `~/.postmaster`.
- Delete a page without the user's word.
- Record a page's link in a repository.
