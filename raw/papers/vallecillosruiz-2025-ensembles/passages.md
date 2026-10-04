# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> theoretical upperbound for an ensemble's performance can be 83% above the best single model

Abstract (fragment of "We find that ..."); checked (the abstract listing and a full-text read agree)

> fall into a "popularity trap," amplifying common but incorrect outputs

Abstract (fragment; the sentence begins "consensus-based strategies for selecting solutions"); checked for the fragment (two reads agree)

> a diversity-based strategy realizes up to 95% of this theoretical potential, and proves effective even in small two-model ensembles

Abstract; checked (two reads agree)

> A key finding is the consistent failure of consensus-based selection. Across all benchmarks and ensembles, selecting the candidates with the highest CodeBLEU and CodeBERT scores results in poor performance, worse even than the Naive baseline approach.

Section 4.2.1; not checked (one verbatim read)

> we prompt each of the 10 models to generate n=10 outputs

Setup (fragment); checked (the full sentence appears in the capture added below)

> We use a beam-based search decoding strategy with no stochastic sampling to keep all outputs deterministic and reproducible.

Setup; checked (the second read gave the fragment from "beam-based", the third read the full sentence). The third read found no baseline that samples one model at non-zero temperature, and the page does not say whether the beam outputs are distinct from one another.

> We assess the effectiveness of the different ensembles and strategies by measuring the number of problems in each benchmark with at least one plausible candidate.

Setup (the measure used in Tables 3 to 6); checked (the second read gave the fragment from "the number of problems", the third the full sentence). The page does not say in so many words whether a single model's count uses one output or all ten; the fetch tool's gloss, "at least one of the n=10 outputs", is not a quote.

> From this set, we select a subset of k=10 outputs. This constraint is motivated by two practical considerations. First, developers are unlikely to review more than 10 patches.

Setup (selection of ten candidates from the pool of one hundred; the next sentence gives the cost of validation as the second reason); not checked (one read)

> the total number of unique problems solved by at least one model within a set of models, representing the best possible outcome under a perfect selection approach

Definition of the theoretical upper bound (fragment); not checked (one read)

Number of problems with at least one plausible candidate, as listed by the fetch tool. Columns: best single model in the pool | naive pool (equal share per model) | by CodeBERT F3 highest-score / lowest-score / diversity | by CodeBLEU highest / lowest / diversity. Rows: Ens_S (five models of 7 to 8B), Ens_L (five models of 12 to 16B), Ens_all (ten models).

Table data as rendered by the fetch tool (not a sentence quote): Defects4J (Table 5): Ens_S 89 | 88 | 26 / 114 / 134 | 22 / 118 / 135 || Ens_L 112 | 116 | 40 / 134 / 153 | 35 / 137 / 162 || Ens_all - | 97 | 22 / 125 / 157 | 25 / 129 / 164 || theoretical maximum 205
Table data as rendered by the fetch tool (not a sentence quote): HumanEval-Java (Table 4): Ens_S 110 | 112 | 64 / 108 / 129 | 64 / 110 / 128 || Ens_L 122 | 127 | 83 / 118 / 130 | 82 / 124 / 131 || Ens_all - | 123 | 69 / 111 / 130 | 69 / 109 / 127 || theoretical maximum 141
Table data as rendered by the fetch tool (not a sentence quote): LiveCodeBench (Table 6): Ens_S 130 | 142 | 102 / 103 / 143 | 102 / 101 / 141 || Ens_L 155 | 168 | 110 / 130 / 167 | 103 / 138 / 170 || Ens_all - | 169 | 104 / 110 / 162 | 103 / 107 / 160 || theoretical maximum 185

Tables 4 to 6 from the second read. Where the two reads overlap the cells agree (best single 112, 122 and 155; naive 97; highest-consensus 22 to 40 on Defects4J; maxima 205, 141 and 185); the other cells come from one read and are not checked. The column order highest / lowest / diversity is the reading of the list of strategies in the first read, not a legend seen.


## Added by package P4-independence, retrieved 2026-10-04

Read through the arXiv abstract page (once) and the HTML full text (three fetches with different prompts). The arXiv page lists v1 on 24 Oct 2025 and v2 on 30 Oct 2025, with the comment "Added Acknowledgments section and hyphenated last names"; no venue.

> A key finding is the consistent failure of consensus-based selection. Across all benchmarks and ensembles, selecting the candidates with the highest CodeBLEU and CodeBERT scores results in poor performance, worse even than the Naive baseline approach.

Section 4.2.1 (RQ2); checked (the read gives the same words as the "not checked" passage above, so two reads now agree)

> This phenomenon, which we term the popularity trap, suggests that models frequently produce syntactically similar but semantically incorrect solutions.

Section 4.2.1; not checked (one read)

> For every problem in our benchmarks, we prompt each of the 10 models to generate n=10 outputs.

Setup; checked (the read gives the full sentence; the fragment above agrees)

> Comparing against the ensemble of all the models, the results indicate a potential performance improvement of 83% over the best individual model

Section 4.1 (RQ1.2), on Defects4J with all ten models (fragment); not checked (one read)

> where it realizes over 95% of the ensemble's theoretical potential.

Section 4.2.1, on HumanEval-Java with the ensemble of small models (fragment); not checked (one read)

Table 3 as rendered by the fetch tool (best single model, theoretical maximum of the all-model ensemble, difference): HumanEval-Java 122, 141, 15.6%; Defects4J 112, 205, 83.0%; LiveCodeBench 155, 185, 19.4%.

Table 3; checked (two of the reads agree with each other and with the numbers above)

Not on the page as read (asked directly in one fetch): whether the best single model's count uses one output or the union of its n=10 outputs, so the page does not separate the effect of more models from the effect of more samples. One fetch also reported no comparison with repeated sampling from a single model. Not checked.
