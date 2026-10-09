<!-- The brief the second reader was given, with the machine's paths replaced by names in angle brackets. -->

# Brief R2: second reader for a classification of review findings (research #300)

You are the SECOND READER. Another reader has already classified a larger set of findings; you have
not seen that work and must not. You apply a written rubric to 26 findings, one at a time, and write
your answers to a file. You read code and tickets; you do not run anything, and you change nothing.

## What you may read

- `<working folder>/rubric.md`: the rubric. Read all of it first.
- `<working folder>/items.tsv`: the 26 findings: item number, run (which is also the ticket number), round, severity, location, snapshot commit, one-line description.
- The code, read only, with git: `git -C <checkout> show <snapshot>:<file>` for the cited file, and `git -C ... grep` or `show` for neighbouring code at the same snapshot. The cited line numbers are at that snapshot. Use ranges (`| sed -n 'A,Bp'`); do not print whole files of thousands of lines.
- The ticket for the run: `gh issue view <run> --json body --jq .body` (the run number is the ticket number). It is long; read the criteria, decisions and technical notes that bear on the finding.

You must NOT read: anything under `<checkout>/raw/` or `<checkout>/wiki/`, any other file in the scratchpad folder above, any run record under a `.postmaster` folder, any later commit than the snapshot for the code under review (the fix is the answer; do not look at it), any other finding's discussion. If a command would list those, do not run it. If you cannot tell what the defect was without reading the fix, answer `unclear` and say why.

## What to do

For each item, in order, apply the rubric: Q-PROP, Q-CORE, then the fields it asks for. Write the
answer for each item to this file as you finish it (append one line per item, tab-separated, with a header line first):

`<working folder>/answers-R2.tsv`

Columns, in this order: `item`, `label` (prop | core | both | neither | unclear), `cost` (cheap | heavy | -), `confidence` (clear | arguable), `by_construction` (yes | no), `property_or_extract` (the one sentence, or the function to extract, or empty), `reason` (one line). No tabs or newlines inside a field.

After every five items copy the file to `<drafts folder>/answers-R2.tsv`.

## Rules for yourself

- Judge each finding on its own. Do not try to balance the labels across items, and do not try to guess what another reader would say.
- You know the defect, so everything looks checkable. The rubric's discipline is the one-sentence property written without mentioning the defect, and the function you would extract. If you cannot write them, answer no.
- Be as strict as the rubric says. `arguable` is for cases where a reasonable reader could answer the other way; use it when that is true.
- Keep your reading economical: about ten minutes and a few thousand tokens of code per item is plenty. Read the function the finding sits in, not the module.
- Your final message must be short: how many items you answered, any item you marked `unclear` and why, and where the file is.
