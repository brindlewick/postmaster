# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A TypeScript library in which failure, required services, concurrency and scheduling are values described by the type `Effect<Success, Error, Requirements>`, which a runtime executes later.

## measured

no study. Use figures: stars 16,963; forks 819; created 2019-11-13; MIT; repository pushed 2026-10-04. Latest release: `effect@4.0.1`, published 2026-10-04 (the npm "latest" tag still read 4.0.0 when I looked). The README says "Effect 4.x is a long-term support (LTS) release" (single read), keeps v3 on a `v3` branch and points to a migration guide; it lists more than 30 packages (platform packages for Node, Bun, Deno and the browser, SQL clients, AI-provider packages, OpenTelemetry, Vitest helpers). Stated requirements: TypeScript 5.9 or newer, strict mode. The docs define the three type parameters as what an effect can succeed with, the expected errors, and the contextual data required to run it. The only testing aid the getting-started page names is `TestClock` (control of time in tests). The docs front page banner reads "Effect 4.0 is here. One ecosystem. Zero dependencies." (single read).

## quotes

"a description of a workflow or operation that is lazily executed" (single read; the docs' definition of the Effect type)

## does not cover

Effect proves nothing. The three parameters are tracked by the TypeScript compiler and so can be bypassed with `any` and casts. The two docs pages I read do not say what the types do not cover, and do not discuss unexpected throws (defects) that stay outside the Error parameter; I did not read the page that does. Tracking that an effect exists and what it needs is not the same as checking that it is correct. Adopting it changes how a whole program is written; I found no measurement of that cost for a small tool.

## strength

n/a (a tool page; use figures only)

## how chosen

USE (16,963 GitHub stars; 52,199,137 npm downloads of `effect` in the week 2026-09-27 to 2026-10-03. npm counts installs, including installs pulled in by other packages: the npm registry entry for `@prisma/config` 7.10.0 lists `effect` 3.20.0 as a pinned dependency, so part of the figure is transitive; I did not separate direct from transitive use)

## period

2022 or later, no language model

## group

G5     claims: C1     direction: background

## Provenance

The reading helper's notes for this group say that an entry is verified only if its url line says VERIFIED against the page images, and this entry's does not. Its figures and quotes are the helper's reading of an abstract, a web page or a data interface, or were checked again by the research session only where a section below says so. Nothing here that a section below does not confirm should be taken as read from the source.

