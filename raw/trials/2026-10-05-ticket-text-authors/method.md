# Who writes on this repository's tickets, and what the comment log shows of it

Two questions about candidate 2 of [pstack](../../../wiki/sources/pstack.md): who has written the
text that reaches the flow's readers, and does the reader that prints a ticket's comments always say
who wrote each. The conclusions are in that page, not here.

## Part 1: the count

On 2026-10-05, at about 05:00 UTC, two reads of this repository's tracker with the GitHub command line:

- `gh issue list --state all --limit 500 --json number,author,comments`
- `gh pr list --state all --limit 300 --json number,author,comments,reviews,state,mergedAt`

`apparatus/count-authors.ts` counts the authors of the issues, the pull requests, their comments and
the reviews. Bodies are not read. The owner's account is printed as `owner`, and any other login as
`other-<n>`, so this record names no third party. The output is `results/authors.out`.

**Controls.** Issues and pull requests share one numbering, so 197 issues and 112 pull requests must
reach the highest number, 309, and they do. A login that is not in the data (`zzqxv309nonsense`)
matches no item. The most comments on one issue is 12, so the 100-comment page the adapter asks
for was not reached on any issue.

**What it does not show.** The lists hold the text as it stands, not its edits. A login is an
account, not a person: the flow's own comments and the tickets an agent files are posted through the
owner's account, so "written by the owner" includes text an agent wrote after reading anything. The
interaction-limits endpoint of the repository (`gh api repos/<owner>/<repo>/interaction-limits`)
returned `{}` on 2026-10-05, and the repository is public (`gh repo view --json visibility`), which
is how it is known that anyone may open an issue or comment.

## Part 2: the comment log

`scripts/github.ts` at commit `a265197` asks GraphQL for each comment's body, date and author login
(line 306), and prints them under `## Log` as `- <date> <login>: <text>` (lines 577 to 586), except
that a comment whose text already starts with a date and a space is printed as its own text
(`DATE_PREFIX_RE`, line 403, used at line 583). The flow's own comments are written
`<stamp> <actor>: <text>` (lines 622 and 623), which the exception keeps from being prefixed twice.

`apparatus/render-check.ts` copies the four lines that decide this, and runs them with the file's own
regular expression and word splitter on four made-up comments. The output is `results/render-check.out`.
The first is the positive control: a plain comment from another account shows that account's login.
The fourth is the negative control: the same words with the date later in the text keep the login.
The third is the case: a comment from another account that starts with a date prints with no login.

`apparatus/real-read.ts` runs the real command, `run github <repo> read 7`, against a stand-in for `gh` that
answers from canned files, the one in `scripts/github.test.ts` reduced to the query this command makes, so
nothing reaches GitHub. The made-up ticket holds a plain comment from another account, a line the flow wrote
(`<date> <time> coachman: ready`, posted by the owner's account) and a comment from the other account that begins
`2026-10-05 12:00 owner:`. The output is `results/real-read.out`. The ticket's header there has no line for the
account that opened it, and the third comment prints with no account.

**What it does not show.** That a real GitHub ticket prints the same, which depends on the stand-in answering as
GitHub does. Nothing was posted for this trial. The made-up ticket is a canned file, so what an actual outside
comment would look like on the tracker was not seen.
