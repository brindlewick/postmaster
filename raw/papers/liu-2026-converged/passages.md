# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> The top ten share 285 successes and 51 failures, leaving 164 instances that distinguish their outcomes.

Abstract; not checked as a sentence (one verbatim read); the numbers 285, 51 and 164 agree across the abstract page and a full-text read. One full-text read returned "36 instances solve by all ten" in a garbled quotation, which contradicts the abstract; the abstract is used.

> The union of instances solved by the top two is 414 against 396 for the best single system, and by the top ten 449

Results (as returned by one read; the first read gave the same numbers in a paraphrase); checked for the numbers

> median nesting of 0.935 at the frontier: when two leading systems differ, the weaker one's successes are almost entirely a subset

Section 3.2 (fragment; the sentence continues "of the stronger one's"); checked (two reads agree word for word)

> Frontier solution sets have median nesting 0.935 against a score-implied baseline of 0.774, indicating strongly shared successes.

Abstract; not checked (one verbatim read)

> Verified also overlaps pretraining data: given only the issue text, models identify the buggy file at 76% accuracy on Verified but 53% on unseen repositories

Limitations, citing work by Liang, Garg and Zilouchian Moghaddam; not checked for the wording (one verbatim read, another a close paraphrase); the numbers agree

> One run per submission

Limitations (fragment; the sentence goes on "Between-system differences cannot be separated from run-to-run variance."); checked (two reads agree)

Data as read (checked, two reads agree): 254 submissions across four splits, per-instance verdicts retrieved on 30 July 2026, of which 134 are on Verified (500 instances); the authors ran no models. Nesting is defined as cov(A,B) = |A∩B| / |B| with a score-implied baseline of |A| / n (one read, not checked).

