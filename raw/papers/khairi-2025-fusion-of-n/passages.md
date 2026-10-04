# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> we propose Fusion-of-N (FusioN): a method that uses a general LLM judge to synthesize the most informative elements of each sample into a single final answer.

Abstract; not checked (one fetch)

> the final generation y∗ is conditionally dependent on the other candidates, and, can—in contrast to BoN—exceed the original pool in quality

Section 2 (method); not checked (one fetch)

> If we sample only from a single teacher (here DeepSeek-V3, #8+#9) win-rates drop substantially, highlighting the importance of diversity in the teacher pool.

Section 5, Table 4 discussion; not checked (one fetch; an earlier fetch gave the same finding in a paraphrase)

> FusioN outperforms the Oracle selection in the German, Russian and Chinese translation with gains of +0.8 in the latter

Section 4 (test-time scaling, WMT24++); not checked (one verbatim fetch; an earlier fetch gave the same languages and the +0.8 in a paraphrase)

> we found more mixed results when testing on MGSM...might indicate that close-ended tasks are either just not well suited to be addressed by generative ensembling

Section 5, limitations (the ellipsis is in the fetched text); not checked

> BoN might be the safer choice for cross-lingual transfer to lower-resource languages

Section 5; not checked (the two fetches differ by one word, "the")

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 4 (synthetic-data setting, 1k UFB prompts, win rate averaged over 10 languages, judged by gpt-4o-2024-05-13 against a reference model): all five teachers (Gemma3-27B-It, Kimi-K2-Instruct, Qwen3-235B, DeepSeek-V3, Command A) with FusioN 65.4, with BoN 61.0; DeepSeek-V3 alone, five samples, FusioN 59.0, BoN 58.9; a weaker pool with Gemma3-4B in place of Gemma3-27B, FusioN 65.0.

Table 4; checked for FusioN 65.4 and 59.0 (two fetches agree); the BoN values and the 65.0 cell come from one fetch

Test-time scaling, N=5, Command A as the fusor: WMT24++ XComet-XL averages FusioN 83.8, BoN 83.0, oracle best-candidate 83.4; mArenaHard v2 (11 languages) FusioN beats BoN in 9 of 11 languages; no run count is stated.

Section 4; not checked (one fetch gave the averages, the other the language-level gains)
