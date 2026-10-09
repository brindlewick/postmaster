# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> large-scale model sampling to explore the search space, followed by filtering based on program behavior to a small set of submissions

Abstract (third of three key components); not checked (one read gave the sentence word for word, another paraphrased it)

> In simulated evaluations on recent programming competitions on the Codeforces platform, AlphaCode achieved on average a ranking of top 54.3% in competitions with more than 5,000 participants.

Abstract; not checked (one verbatim read)

> Filtering removes approximately 99% of model samples, although the exact amount depends on the problem and model.

Section 4.5; checked (two reads agree word for word)

> an ensemble of 41B and 9B models with clustering, which performed best on our validation set but turned out to be slightly worse than using the 41B model alone with clustering

Section 5.1 and Appendix C.1 (the fetch tool named both); checked (two reads agree word for word)

> 41B + clustering | validation 10@1k 21.0% | 10@10k 26.2% | 10@100k 31.8% | 10@1M 34.2% | test 10@1k 16.4% | 10@10k 25.4% | 10@100k 29.6%

Table 5, row as printed (reformatted as text by the fetch tool); checked (two reads give the same numbers)

> 41B without clustering | validation 10@1k 16.9% | 10@10k 23.9% | 10@100k 28.2% | 10@1M 31.8% | test 15.6% | 23.2% | 27.7%

Table 5, row for the 41B model without clustering; not checked (the first read of this row was garbled, the second was clean)
