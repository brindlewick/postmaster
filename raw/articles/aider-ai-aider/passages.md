# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Whenever aider edits a file, it commits those changes with a descriptive commit message.

Section "Commit", first bullet; checked (raw file)

> If aider authored the changes in a commit, they will have "(aider)" appended to the git author and git committer name metadata.

Section "Commit attribution", first bullet; checked (raw file)

> If aider simply committed changes (found in dirty files), the commit will have "(aider)" appended to the git committer name metadata.

Section "Commit attribution", second bullet; checked (raw file)

> Finally, you can use `--attribute-co-authored-by` to have aider append a Co-authored-by trailer to the end of the commit string.

Section "Commit attribution", last paragraph; checked (raw file). A fetch through the summarising tool returned this sentence without the word "Finally,"; the raw file has it, and the raw file is used here.

## Numbers from the GitHub API, 2026-10-04

Repository Aider-AI/aider (plain GET of the repository and latest-release endpoints):

- stars 49369; forks 5026; open issues and pull requests 1910 (the API's combined count)
- created 2023-05-09T18:57:49Z; last push 2026-05-22T14:02:20Z
- latest release v0.86.0, published 2025-08-09T17:42:19Z
- licence Apache-2.0; default branch main; not archived
- description field: "aider is AI pair programming in your terminal"
