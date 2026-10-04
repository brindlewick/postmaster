---
name: review-pages
description: Show the user a change, or code named by a ticket, on a private claude.ai page made for a phone and an iPad. A review page has tabs for the ticket, the change's summary, the diff and the files as they stand, and takes comments on lines that the session reads and answers. A code viewer shows ticket-linked code files in colour at the lines the ticket cites. Use it when the user reviews a change with automatic merging off, or opens files named in a ticket. Claude Code only, until the dashboard shows changes.
---

# Review pages

Two pages the user shaped in #214 ("Research: review a change in an artifact page instead of in
code-server"): a **review page** for a change, and a **code viewer** for code files a ticket names.
Both are private artifacts that only Claude Code can publish. `<tool>` below is the postmaster
repository: the folder two above this file once its link is resolved. Run the builder from the
repository the change belongs to.

## A review page for a change

1. Build its data into a folder of your scratchpad:
   - a pull request: `<tool>/scripts/run review-page change <dir> --pr <number>`. The title,
     its text as the summary, and the ticket it names (`#<n>, <title>`) come from GitHub.
   - a run's branch before its pull request: `<tool>/scripts/run review-page change <dir>
     --base <base> --head <branch> --ticket <n> --summary <file>`, the summary
     being what the card says the change does.
   It prints one line with the files, lines and chunks, and how many email addresses it removed.
2. Before the first publish, read `review.json` and search the chunks for home paths, host
   names, private addresses and anything private. The builder removes email addresses and
   nothing else; publish nothing private.
3. Publish `<dir>/index.html` with the Artifact tool, `capabilities: {"db": {}}`, and `files`
   mapping `review.json` and each `chunks/<k>.json` to their paths. Then, at once, stop the watch
   on it (ArtifactComments, `action: watch`, `on: false`), as `AGENTS.md` says.
4. Give the user the link as `https://claude.ai/code/artifact/<uuid>`: read `review.json` back
   with the Artifact tool's `read` and `path`, and take the uuid from the folder it is saved in.
5. When the user says they have commented, read the comments: ArtifactData `list` of the
   collection `comments`. Each has `path`, `side` (`new` or `old`), `from`, `to`, `text` and
   `at`. Answer each one on the page with ArtifactData `set` in `comments`, `doc_id`
   `reply-<its id>`, data `{replyTo, path, side, from, to, by: "claude", text, at}`; the reply
   shows under the comment without a reload. Then act on what they asked in the conversation.
6. The verdict comes in the chat. The page has no verdict control and shows no checks or review
   findings, by the user's choice.

## A code viewer for a ticket's files

1. Markdown files the ticket names go in the ticket's Claude Docs document as tabs, placed whole by
   upload so the text is exact: upload each file to the document's artifact (Artifact `publish`
   with `url`, `asset: true`), create a blob from it in the document, and fill a new tab from
   the blob; the Docs connector's `topic.uploads` and `topic.tabs` say how. Link each tab from
   the ticket with a tab chip.
2. Code files go in one viewer: `<tool>/scripts/run review-page files <dir> <ref> <path>...`
   writes `index.html`, `files.json` and `files/<k>.txt`. Read them as step 2 above says, then
   publish `index.html` with `capabilities: {"comments": {}}` and `files` mapping `files.json`
   and each `files/<k>.txt`, and stop the watch at once.
3. Link each file from the ticket at the lines it cites:
   `https://claude.ai/code/artifact/<uuid>#f<k>-L<a>-L<b>`, where `f<k>` is the file's `id` in
   `files.json`.
4. A comment from the viewer is pinned to its first line and starts with the file and the
   lines. When the user says they have commented, read it with ArtifactComments `read`.

## Never

- Share a page, or publish one that holds a credential, a home path, a host name, an email
  address, a link to this machine, or a value from `~/.config`, `~/.claude` or `~/.postmaster`.
- Delete a page without the user's word.
- Record a page's link in a repository.
