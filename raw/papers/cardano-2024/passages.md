# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A team of about six formal-methods engineers, one in each development team of about six, applies proofs and executable Agda specifications to the pure inner layers of a Haskell blockchain node and tests the impure outer layers, checking the production code against a reference implementation generated from the specification.

## measured

no measurement; the authors' account of one organisation's practice: "The Formal Methods team at IOG is therefore relatively small, about 6 people, and mostly works embedded within other teams" and "usually a single FM Engineer per development team of around 6" (page 1 and 2), with the rule of thumb "at least one formal methods engineer in each engineering team". Design rule, pages 1 and 2: "The layers proceed outwards from a pure internal core to an impure and outward-facing outer layer", and "we tune our approach to each component and apply heavier techniques with a greater emphasis on verification to the more tractable inner components and more lightweight approach (type-safety, at minimum) with a greater emphasis on testing to the impure outer components." The checking method, page 2: three artefacts (the verified Agda; the Haskell generated from it; the hand-written Haskell production code); the last "is verified by running conformance tests, which pass the same input to both the executable specification implementation and the production Haskell implementation, then check that the same output is produced"; inputs come from a random or exhaustive generator and handcrafted examples, and this "ensures that bugs in either the specifications and implementations are likely to be found at the time a commit is made". Testing lesson, page 3 (text layer): earlier test generators produced whole blockchains and "good coverage was hard to ensure, and obscure cases were difficult to explore"; newer ones generate single ledger states tailored to scenarios. Concurrency (networking layer, section 3.4): "subject to intensive property-based testing"; "testing proved challenging" until they built an abstraction that runs the same code either on the Haskell runtime or on a pure deterministic simulation. Limits the authors state (section 5.2): maintenance ("Formal specifications supporting research are usually written once and rarely touched again" while real software changes); "Skills shortage" ("a Coq specialist will need time to retrain as an Agda engineer"; "most available training courses do not focus on industry"); tool maturity; and that "Formal methods tools and processes can be quite computation- and human resources- intensive even for moderately complex systems". Result claims: "6 years of very little downtime" and "zero-downtime operation of the Cardano platform for over five years", offered as support, not as a measurement.

## quotes

- "apply heavier techniques with a greater emphasis on verification to the more tractable inner components and more lightweight approach (type-safety, at minimum) with a greater emphasis on testing to the impure outer components" (pages 1-2) (checked, page images and text layer agree)
  - "It is possible a specification may, at some point, diverge from its implementation. Also, the specification itself may contain errors." (page 2) (checked, page image and text layer agree)
  - "good coverage was hard to ensure, and obscure cases were difficult to explore" (page 3, about generating whole blockchains) (single read, text layer)

## does not cover

an account by the team itself, with no count of defects found by the specification, the proofs or the conformance tests, and no comparison with a project that did not do this; uptime is offered as evidence but nothing here separates the contribution of formal methods from the rest of the engineering. Haskell with a mature type system and QuickCheck, a pure ledger that is a state machine (the best case for a functional core), and a funded niche team; not a TypeScript project, and the production code is checked by testing, not by proof. It supports the design pattern (a pure core is where the heavy checking is applied) but offers no measure of how much that is worth.

## strength

one report or one team's experience

## how chosen

USE (a named production system, Cardano, with the project's formal-methods strategy written by the team that runs it) and it is the only industrial report found that states "pure core, verified; impure edge, tested" as a design rule

## period

older (not language-model work; 2024)

## group

G2/G3/G5-adjacent (Agda, Haskell, property-based conformance testing, a pure core with an impure outer layer)     claims: C1, C2, C3     direction: supports C1 (qualitatively), mixed on C2 and C3

## Read again by the research session on 2026-10-05

Route: text layer of the saved PDF, read with a text extractor, by the research session on 2026-10-05.

- "From the formal methods perspective we tune our approach to each component and apply heavier techniques with a greater emphasis on verification to the more tractable inner components and more lightweight approach (type-safety, at minimum) with a greater emphasis on testing to the impure outer components." (single read (this read only))
- "Three artifacts are involved in ensuring correctness of the software: (1) the Agda code, which is verified, (2) the Haskell code generated from Agda, and (3) the hand-written Haskell production code." (single read (this read only))
- "Equivalence between (1) and (2) is established by contruction, then (3) is verified by running conformance tests, which pass the same input to both the executable specification implementation and the production Haskell implementation, then check that the same output is produced." (single read (this read only))

