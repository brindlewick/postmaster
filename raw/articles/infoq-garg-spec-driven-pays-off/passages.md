# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Reviewers caught statistically indistinguishable numbers of drifts with and without the baseline (0.525 vs. 0.518, p=0.69).

Findings; checked

> Baseline reviewers attributed eighty-one percent of findings to a named clause.

Findings (the sentence after it says reviewers working from code only attributed zero percent, p=0.043); checked

> took roughly forty-eight minutes versus twenty-seven minutes for code-only

Findings on review time (one fetch gave the subject as "The spec-anchored review", another as "baseline review"); checked for these words

> On the complex banking task, the weaker model, with room to improve, gained about twenty-one points from spec discipline.

Findings on generation (the strong model gained roughly two points, in one fetch); checked for "gained about twenty-one points from spec discipline"

> Add a specification review gate (completeness, interfaces, constraints, testable behavior) before generation

Recommendations; checked

> This is a deliberately small pilot with five reviewers, two services, and one domain.

Limitations; checked

> The findings below come from a study of mine accepted at GAISS 2026.

Introduction; checked

> At n=5, the paired signed-rank test bottoms out at p=0.043

Limitations; not checked (one fetch)

> The staged-generation win carries a second-pass confound (the winning arm runs the model twice)

Limitations; not checked (one fetch)

What "baseline" means in the study (a three-layer specification: business requirements, high-level design, low-level design with testable invariants; "drift" is divergence of the generated code from the approved specification's invariants) comes from one fetch and is not checked.
