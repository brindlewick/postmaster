# Passages

Quoted from the document at the url in `source.md`, retrieved 2026-09-26. Only the passages
the wiki relies on are kept. Line breaks are joined, and a word the PDF hyphenated only to break a
line is rejoined; nothing else is changed. Each passage names the section it comes from.

> In this report, we explore the iterative blind use of LLMs as bug-fixers. Across multiple models and repair environments, we find that LLMs consistently claim to detect bugs in entirely bug-free programs while the rate of repair of buggy programs is less than that of the damage to correct programs. We also explore the long-term dynamics of this iterative process, and find that this frequently reaches a pseudo-bug-fixing cycle where the same changes are added and removed again ad infinitum.

Abstract.

> We consider the case where the prompt does not include history, that is, the agent sees the current state of the code, but not the sequence of states the code has been in through past bug fixes [Xia et al., 2025].

1 Introduction.

> Throughout the report we always use the same 20 problems, which are chosen at random; and from each problem, the same 40 C++ user submissions, also chosen at random.

4 Experimental Evaluation.

> Overall, we see that the damage done by pseudo-bug fixing in correct files (damage rate) is at least as large as the improvements. For SRBs, the damage rate is substantially higher than the repair rate; for whole-file edits, the two are similar.

4.1 Repair Rate and Damage Rate.

> This report focuses on the dynamics of Gemini 2.5 Flash-Lite and Qwen 2.5-7B-Instruct in a blind environment without goals.

Limitations and future work.

## Table 2, transcribed

Repair rate α and damage rate β, with the standard error of the mean, from section 4.1. The row
group is the state a trajectory started in, and τ is the sampling temperature. SRB is an atomic
search/replace edit; whole-file is a rewrite of the file.

| start | τ | rate | Gemini 2.5 Flash-Lite, SRB | Gemini 2.5 Flash-Lite, whole-file | Qwen2.5-7B-Instruct, SRB | Qwen2.5-7B-Instruct, whole-file |
|---|---|---|---|---|---|---|
| correct | 0 | α | 0.062 ± 0.005 | 0.040 ± 0.009 | 0.041 ± 0.004 | 0.016 ± 0.009 |
| correct | 0 | β | 0.293 ± 0.011 | 0.165 ± 0.009 | 0.424 ± 0.015 | 0.099 ± 0.010 |
| correct | 0.7 | α | 0.020 ± 0.001 | 0.003 ± 0.000 | 0.005 ± 0.000 | 0.008 ± 0.001 |
| correct | 0.7 | β | 0.216 ± 0.004 | 0.015 ± 0.001 | 0.190 ± 0.005 | 0.016 ± 0.001 |
| incorrect | 0 | α | 0.023 ± 0.002 | 0.101 ± 0.007 | 0.004 ± 0.001 | 0.019 ± 0.004 |
| incorrect | 0 | β | 0.261 ± 0.032 | 0.073 ± 0.015 | 0.440 ± 0.099 | 0.063 ± 0.043 |
| incorrect | 0.7 | α | 0.007 ± 0.000 | 0.004 ± 0.000 | 0.000 ± 0.000 | 0.001 ± 0.000 |
| incorrect | 0.7 | β | 0.187 ± 0.007 | 0.005 ± 0.001 | 0.391 ± 0.051 | 0.003 ± 0.001 |

α is the probability that a step turns incorrect code correct, and β that it turns correct code
incorrect (equations 3 and 4 of the paper).
