# Rubric: what would have caught a serious review finding before the reviewer did

You are given one serious review finding at a time. A serious finding is one the coachman
verified and did not dismiss, rated P1 or P2, under a gating lens (bug, security, or a style
finding that is really a defect). You answer a counterfactual: before this code was reviewed,
could a check of a certain kind have found this defect?

**Read, in this order:** the finding's row (what, where, which round, which snapshot); the code
at the snapshot the round reviewed (`git show <snapshot>:<file>`, around the cited line and the
whole function it sits in); the ticket, for what the code was supposed to do. Do not read the fix,
later rounds, or the classification of any other finding. If you cannot tell what the defect was
without reading the fix, answer `unclear` and say why.

Two questions. Answer each yes or no, with the reason in one line.

## Q-PROP: would a stated property or a small model have caught it?

Yes only if all three hold:

1. You can write, in one sentence, something that must hold, **without mentioning this defect**, and
   drawing only on the ticket's words, the function's contract, or a general law such as: a round
   trip returns its input; running twice gives the same answer; two ways of computing one thing
   agree; the answer for two inputs joined is the union of the answers for each; an operation
   touches nothing it was not asked to touch; a check never reports clean when it is not clean; a
   result does not depend on the ambient environment.
2. Inputs that exercise the defect can be generated or enumerated from a closed, describable set of
   shapes (a grammar, a list of values, small states), so a tool could produce them without knowing
   this defect.
3. There is an oracle that is not the code under test: the sentence itself, a trivial slow version,
   or a real tool the project already runs (the compiler, the formatter, git).

A small model (a few states and steps, checked exhaustively) counts only when the defect is in the
**design**: a state, a step or a precondition that a faithful implementation of the design would
share. A model does not catch a step that the code or the prose forgot from a design that has it.

Answer no when: the defect is a wrong or missing requirement (nothing the ticket said was
violated); the only oracle is knowing another program's behaviour in advance, or running it
unobserved; it is wording, format or taste; or it is in runbook prose with nothing to run.

## Q-CORE: would a pure core have made this case checkable?

A pure core is a function from data to data. Reading files, git, the environment, the clock and
processes is done by its caller. Yes only if all three hold:

1. In the code under review, the decision that went wrong was made in code that also reads or acts
   on the world, so that reaching the case in a test means building that world (a git repository,
   a file tree, a process table, an environment, a read that fails).
2. The same decision, as a function of the data it read, would be reached by a test that supplies
   that data directly.
3. A test of it would fail on the defect, because the expected result comes from the ticket, the
   contract or a law, not from knowing how the defect behaves.

Answer no when: the decision was already a function of data (purity was not what was missing); the
defect is in the act itself (an operating-system call, an ordering of effects, atomicity, a race, the
handling of an effect's failure that no data can express); the code under review is runbook prose;
or the expected result is known only from the defect.

## What to write for each finding

- `label`: `prop` (Q-PROP yes, Q-CORE no), `core` (Q-CORE yes, Q-PROP no), `both`, `neither`, or
  `unclear`.
- `cost`: for a label of `prop` only. `cheap` when the check runs in process on data, with no
  subprocess (a few temporary files are allowed); `heavy` when its oracle or its inputs need git, a
  shell or a real tool (the compiler, the formatter, a linter) to run. `-` for every other label.
  A `both` finding is cheap after the separation and heavy before it, so it carries no cost.
- `property`: the one sentence, if Q-PROP is yes.
- `extract`: the function you would extract, and its arguments, if Q-CORE is yes.
- `confidence`: `clear`, or `arguable` when a reasonable reader could answer the other way.
- `by_construction`: `yes` when a different structure would have made the defect impossible, not
  merely checkable (for example one function that both the dry run and the real run consume);
  otherwise `no`.
- `reason`: one line.

## Hindsight

You know the defect, so everything looks checkable. The one-sentence property, written without
mentioning the defect, and the function you would extract are the evidence that it was. If you
cannot write them, the answer is no.
