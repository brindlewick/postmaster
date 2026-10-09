# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

An independent reproduction of a study of 729 GitHub projects found it only partly repeatable and, after correcting the data and the statistics, found 4 of the 11 originally significant languages still associated with defects, with effect sizes that the authors call exceedingly small.

## measured

Original (Sec. 2): 729 GitHub projects in 17 languages, 63 million SLOC, 1.5 million commits by 29 thousand authors, of which 566,000 were bug-fix commits found by searching commit messages for error-related keywords. Four research questions: RQ1, per-language associations (11 of 17 significant: TypeScript, Clojure, Haskell, Ruby and Scala with fewer bug-fix commits; C, C++, Objective-C, JavaScript, PHP and Python with more); RQ2, language classes, whose finding is that functional languages have a smaller relationship to defects than procedural or scripting ones; RQ3, domain; RQ4, defect types. Experimental repetition (Sec. 3, from the authors' artifact): RQ1 qualitatively repeated (ten of eleven languages significant; PHP differed); RQ2 repeated, but reclassifying languages changed the significance of 2 of 5 categories (Table 4); RQ3 and RQ4 could not be repeated (code missing; bug-category data inconsistent and summing to 104%). Reanalysis, of RQ1 only (Sec. 4): of 729 projects 618 could be downloaded; about 106 thousand commits (19.95%) were missing from the original data (Perl 80%); 27,450 commits (1.86%) were duplicated; of 41 projects labelled TypeScript only 16 contained any, so TypeScript was dropped; the data held no commits to C and C++ header files and the authors could not repair that, so they only deleted the V8 project (mostly C++, but its commits in the data were mostly JavaScript regression tests); 10 industry developers checked 400 sampled commits and found 36% false positives and 11% false negatives in the bug labels (4.1.4); the statistics were redone with zero-sum contrasts, family-wise error control and a bootstrap over labelling error. Result (Table 6, Fig. 2, Sec. 4.4): the significance of 7 of the 11 languages is invalidated; still significant after the bootstrap are C++ (positive, coefficient 0.16) and Clojure (-0.15), Haskell (-0.12) and Ruby (-0.08) (negative); the prediction intervals for the two extremes, C++ and Clojure, substantially overlap (Fig. 6).

## quotes

"even for those the effect size is exceedingly small" (checked: the abstract as rendered on ar5iv and the PDF gave the same words) | "Not only is it not possible to establish a causal link between programming language and code quality based on the data at hand, but even their correlation proves questionable." (checked: the ar5iv read and the PDF, Sec. 1) | "It is eminently possible that the majority of bugs are in fact not affected by language features." (single read; Sec. 5.7)

## does not cover

It is about whole programming languages and the GitHub commit history, not about writing a pure core inside one language, so it says nothing direct about purity or functional-core style. It shows that the main measurement behind the claim that functional languages have fewer defects is unreliable, not that they have more. The reanalysis covers RQ1 only: RQ2, the class-level functional claim, was repeated but not reanalysed on the cleaned data, and in the repetition and reclassification (data not cleaned, Table 4) the two functional classes still had negative coefficients (-0.27 and -0.18, p below 0.001). The authors also write that bugs about application logic or the problem domain are less likely to be affected by the language, and that the majority of bugs may not be affected by language features at all (Sec. 5.7). The original authors dispute the reproduction: the reproduction authors' later response (read) says the original authors claim the reanalysis confirms their conclusions and that they emphatically disagree, and that they do not believe the question can be meaningfully answered by scraping GitHub; I did not read the original authors' rebuttal.

## strength

one report or one team's experience (a statistical reanalysis of observational data, disputed)

## how chosen

SERIOUS (the independent reproduction of the main study of language and defect rate; named in the brief)

## period

older (before 2022)

## group

none (older; C1, language and defect rate)     claims: C1     direction: contradicts (the claim that functional languages have fewer defects)

## Provenance

The reading helper's notes for this group say that an entry is verified only if its url line says VERIFIED against the page images, and this entry's does not. Its figures and quotes are the helper's reading of an abstract, a web page or a data interface, or were checked again by the research session only where a section below says so. Nothing here that a section below does not confirm should be taken as read from the source.

## Read again by the research session on 2026-10-04

Route: arXiv abstract page, read by the research session on 2026-10-04.

- "only four languages are found to have a statistically significant association with defects, and even for those the effect size is exceedingly small" (single read (this read only))

## Read again by the research session on 2026-10-05

Route: ar5iv HTML rendering, read by the research session on 2026-10-05.

- "Our second objective is to carry out a reanalysis of RQ1 of the FSE paper." (single read (this read only))
- "The reanalysis failed to validate most of the claims of (Ray et al. 2014)." (single read (this read only))

