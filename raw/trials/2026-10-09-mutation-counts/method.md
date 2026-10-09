---
kind: trial
subject: what two counts of mutation flag in the project's scripts, and whether the first reaches the serious review findings of four runs
date: 2026-10-09
---

# Method

**Question.** [Issue #372](https://github.com/brindlewick/postmaster/issues/372), the second half of
trial 4 on the research page ([functional core and verification](../../../wiki/concepts/functional-core-and-verification.md)).
Count mutation twice in the project's scripts: once for changes to something the function did not
create (the first count), once for every change including giving a local name a new value (the second
count, a contrast and not a pass mark). Then: how many of the 84 serious review findings of four runs
sit in a function the first count flags, in the code that round reviewed; and how many of the first
count's flags on the main branch a reader would call a hazard.

The page's two failure tests for the first count:

- **Test 1:** it fails if it flags more than about twenty places on the main branch that are not
  hazards.
- **Test 2:** it fails if it flags none of the 84 findings' functions.

## Order of work, so the controls mean something

1. The apparatus (`apparatus/`), the control inputs and what each is expected to read (`controls/`),
   the reading rule ([rubric.md](rubric.md)) and the two seeds of the draws below were committed
   before the first place was drawn or marked. The commit that holds them is the first commit of this
   folder.
2. Counts on the controls, on the main branch and at the 19 snapshots; the findings joined to their
   functions.
3. The draw of 30 places, the first reader's marks, the draw of 10 of the 30, the second reader's
   marks, the tally.

**What the first reader had seen before the draw.** While building the rule and checking its
categories the first reader looked at about eighty flagged places on the main branch, in the lists of
the categories and in the totals per module. None was marked then. The draw was made afterwards, from
the whole list, so some drawn places may have been glimpsed. The second reader had seen none.

## Decisions that fix the counts

From the ticket (D1): both counts cover every non-test module under `scripts/`, and the first exempts
no module as being at the edge. The record tags each flagged place by whether its own function reads
the environment or the clock, touches files or starts processes, so the page's exemption for edge
code can be read off afterwards.

**Settled with the user during the session, before any join or draw:** the first count holds every
kind of change to something the function did not create, whether or not the ticket's list names it.
The ticket's list is arguments, module-level variables and imports. The general line on the page,
"something the function did not create", also takes in process-wide objects such as `process.env`,
the object a method was called on, and a variable of an enclosing function changed from a nested
function. The user put all of them in the one count. Each place carries its kind (`root` below), so
a narrower reading is a filter on the same rows, and every table here shows the kinds beside the
total.

## The two counts

A **place** is one change. The rule finds, in each function and at each module's top level:

- a name given a new value: `=`, compound assignment (`+=`, `??=`, ...), `++` and `--`, and each name
  in a destructuring assignment or a `for (x of ...)` head;
- a property or an element given a value, with the same operators: `a.b = ...`, `a[i] += 1`, `a.n++`;
- the `delete` operator on a property;
- a call of a method on the ticket's list of those that change their object in place: `push`, `pop`,
  `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`, `set`, `add`, `delete`,
  `clear`, by name, since no type is known;
- `Object.assign` with the thing as its first argument.

Anything else that changes an object (`Object.defineProperty`, `Reflect.set`, a method of a class that
the rule cannot know) is not found, and is a limit.

**What a change lands on (`root`).** Decided from the scope analysis of the file, following the
change's object through properties and elements to a name:

| root | what it is | in the first count |
|---|---|---|
| `param` | an argument of the function, or of an enclosing one; including giving the argument's own name a new value | yes |
| `import` | an imported binding or a property of it | yes |
| `module` | a module-level variable, changed from inside a function | yes |
| `global` | a global such as `process` or `Bun`, or a local that is another name for one | yes |
| `this` | the object a method was called on; inside a constructor it is being built, so it is `local` | yes |
| `captured` | a variable of an enclosing function, changed from a nested function | yes |
| `local` | a variable the function itself declared, or a module-level variable changed by the module's own top-level code | no |
| `temp` | a value no name holds: a call's result, a new object, a literal | no |

A **local that is another name for something** takes the root of the thing (`alias` is 1): a local
whose declared value, or any value ever assigned to it, is an argument, a module-level value, an
import, a global, or `this`, or a property, element or `get`/`find`/`at`/`pop`/`shift` result of one,
or a conditional or `??`/`||` of one. A local that is the loop variable of a `for ... of` takes the
root of what it loops over, and a loop over `.slice()`, `.filter()`, `.concat()`, `.values()`,
`Object.values()`, `Object.entries()`, `Array.from()`, `new Set(...)` or a spread of one still hands
out the original's elements. A local that holds what a call returned, or a literal, a `new` or a copy,
is the function's own. The tracking is by syntax, not by flow: a name that is an alias on one path is
an alias everywhere.

The **second count** is every place, whatever it lands on. It is the first count plus the places on
`local` and `temp`.

**A function** is the innermost function declaration, function expression, arrow function or method
that holds the place; a place outside every function is at the module's top level. A function's
**tags** come from what lies inside its text, nested functions included: `env` (`process.env`,
`import.meta.env`, `Bun.env`), `clock` (`Date.now()`, `new Date()` with no argument,
`performance.now()`), `files` (a name imported from `fs`, `node:fs`, `fs/promises`; `Bun.file`,
`Bun.write`), `proc` (a name imported from `child_process`; `Bun.spawn`, `Bun.spawnSync`, `Bun.$`),
`os` (a name imported from `os`). The module's tags are the same over the whole file, with any
non-type import of those modules.

## Scope and versions

The modules counted are every `.ts` file under `scripts/` that is not a test (`*.test.ts`), not a type
declaration and not under `scripts/fixtures/`. The same selection runs at every commit.

- The **main branch** is pinned: commit `67d4ae255b4961140de3452139c2908d13520298`, the tip of
  `origin/main` when the counts were run on 2026-10-09. The branch moves; the record is of this commit.
- The **19 snapshots** are the commits the 19 review rounds looked at, named in
  [the findings table of the earlier trial](../2026-10-04-review-findings-classified/data/findings.tsv)
  (`snapshot` column). The 12 of runs #202 and #252 are on the main branch. The 4 of run #216 and the 3 of
  run #268 were, when this was run, only on local branches of those two runs, whose tickets are still
  open, so the record names every commit and keeps what the join needs of them (`results/`).
- Oxlint 1.86.0, the version the gate pins, runs the rule through its JavaScript plugin interface
  (`apparatus/mutation-rule.ts`). It was installed from the registry into a scratch folder; nothing
  was added to the project. Bun 1.4.2 runs every script of the apparatus, as
  `bun --no-env-file --config=/dev/null <script>`. The scripts use only Bun and Node built-ins and run
  on Linux and macOS.

## What is run

Each commit is exported with `git archive` (scripts only, no repository around it) into a scratch
folder. `<oxlint>` is the Oxlint 1.86.0 binary, `<work>` and `<out>` scratch folders.

    bun --no-env-file --config=/dev/null apparatus/count.ts --oxlint <oxlint> --work <work> \
        --repo <repo> --commit <sha> --label <name> --out <out>        # one commit
    bun --no-env-file --config=/dev/null apparatus/count.ts --oxlint <oxlint> --work <work> \
        --tree controls --label controls --out <out>                   # the controls
    bun --no-env-file --config=/dev/null apparatus/snapshots.ts --oxlint <oxlint> --work <work> \
        --out <out> --findings <findings.tsv> --repo <repo> --main <sha>   # the 19 snapshots and main
    bun --no-env-file --config=/dev/null apparatus/snapshots.ts --oxlint <oxlint> --work <work> \
        --out <out> --findings controls/findings.tsv --tree controls       # the same, on the controls
    bun --no-env-file --config=/dev/null apparatus/check-controls.ts controls <count out> <snapshots out>

`count.ts` prints one row per module and a total (functions, lines, first count, second count) and
with `--out` writes every place and every module's row. `snapshots.ts` writes one row per commit with
both counts side by side, and one row per finding.

## The controls

The same commands run on `controls/`: 29 small modules, each with the counts it is expected to read in
[controls/expected.tsv](controls/expected.tsv). They include the page's four, in files named for what
they do:

- `push-onto-argument.ts` pushes onto its argument: expected 1 in the first count and 1 in the second;
- `local-array.ts` builds a local array and returns it: expected 0 in the first (the second reads 2,
  the two pushes on the local);
- `local-let.ts` gives a local `let` a new value: expected 1 in the second (0 in the first);
- `const-map-filter.ts` uses only `const`, `map` and `filter`: expected 0 in the second (so 0 in both).

The rest control each kind of change and each kind of root, positive and negative: the thirteen
in-place methods, `delete`, `Object.assign` into an argument and into a new object, `++` and `+=`,
module-level variables and the module's own top-level code, an imported object, a local that is
another name for an argument, a part of one, an element of one, or a module-level array, a loop over
a filtered copy, `process.env`, a method and its constructor, a callback and the loop that does the
same, a call's result, a rest parameter, a loop counter, a shadowed name, destructuring, an optional
call. [controls/expected-tags.tsv](controls/expected-tags.tsv) holds the tags each of nine functions
must get, and [controls/findings.tsv](controls/findings.tsv) holds nine findings joined to the
control modules, with what each must read in [controls/expected-findings.tsv](controls/expected-findings.tsv):
a finding in a flagged function, in one that is not, in one flagged only by the second count, at the
module's top level, inside a callback, in the function around a callback, in a file the tree does not
hold, on a runbook line and on no line. `apparatus/check-controls.ts` compares every reading with
its expectation and exits 1 if any differ.

The first run of the controls found a fault in the rule: the clock reads (`Date.now()`,
`new Date()`) were not tagged, because Oxlint's scope analysis holds an entry for a builtin such as
`Date` that has no declaration in the file, and the rule took the entry for a declared name. The rule
was fixed and the controls passed 38 of 38 (the rest, 9 findings, were added after). Two further
faults were found by reading flagged places on the main branch, and fixed: a sort of
`Object.entries(env)` was read as a change to `env` (the call's result is a new array, and only a loop
over it hands out the original's elements), and `Object.values(x)` was read through its receiver
`Object`. Both are now controls (`iteration-aliases.ts`).

## The findings join (check C1)

[data/findings.tsv](../2026-10-04-review-findings-classified/data/findings.tsv) of the earlier
trial has 84 rows, one per serious finding, with `location` (module and line) and `snapshot`. At
each finding's own snapshot, the finding's line is joined to the function that holds it: the
innermost function whose lines contain it (the smallest span; two sibling functions on one line tie,
and the tie is reported), or the module's top level. A finding is **in a flagged function** when a
place of the first count has that very function as its innermost function. The looser readings
(**within**: a place in the function or in one nested inside it) are in the table beside it. Of the 84
rows, 78 cite a TypeScript module and a line, 3 cite a runbook line and 3 cite `scripts/reach.ts` with
no line; the last six are reported apart and are not in any share.

**Chance.** To read the number against what it would be if findings fell on lines at random, each
file's share of non-blank lines that lie in a flagged function is computed at the same snapshot
(`file_share_first`), and the expected number of findings in a flagged function is the sum of those
shares over the 78 findings. This treats every non-blank line as equally likely to hold a finding. It
is a baseline, not a test: findings concentrate in the larger functions, which also hold more changes.

## The draw and the readers (check C2)

The first count's places on the main branch, sorted by module, line and column, are the population.
The draw takes the first 30 after a seeded partial shuffle: step i swaps item i with an item chosen
from i to the end, using mulberry32, a 32-bit generator with a published definition, and the first
30 are the sample. The generator was checked against a second implementation (see the unit tests,
`apparatus/mutation-core.test.ts`). **The first seed is 372**, the ticket's number. The second draw
takes 10 of the 30, sorted as they were drawn, with **the second seed, 373**. If the population is
30 or fewer, all of it is taken.

The first reader reads all 30 against [rubric.md](rubric.md) and writes a mark (hazard, harmless or
unclear) and a one-line reason for each. The second reader gets the rubric and the 10 places, in a
different order and with new item numbers, and read access to the main branch's `scripts/` folder and
nothing else: not the first reader's marks, not the findings, not this record. A reader that has seen
the review findings is not blind to what a reviewer would have found; neither reader has the findings
for these places. Two hand-made places, one that should be a hazard and one that should not, are
added to the second reader's list as controls on the reader; they are reported apart and are not in
the agreement.

The estimate of the places on the main branch that are not hazards is the population times the
share of the 30 not marked hazard, with the Wilson 95% interval for that share. It is given for
harmless alone and for harmless and unclear together, and the verdict of Test 1 under each.
Agreement of the two readers is the share of identical marks on the 10 and Cohen's kappa; the
statistics are also computed on a mark list against itself (must read 100% and kappa 1) and against
a shuffle of itself.

## Results

*(filled in after the counts, below)*
