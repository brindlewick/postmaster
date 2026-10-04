# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> If a language model can recognize code it wrote, it may favor that code as a judge, and instances of one model monitoring each other could collude.

Abstract; checked (abstract page and HTML agree word for word)

> In the single-solution task, balanced accuracy is 49-58% for all 15 model-benchmark combinations, while raw accuracy (38-67%) mostly reflects how readily a model claims authorship.

Abstract; checked (the two pages differ only in the dash character)

> In the pairwise task, accuracy across 14 evaluator-opponent combinations correlates at r=0.93 with how often the evaluator's solution is longer.

Abstract; checked

> A rule-based normalization that strips docstrings, comments, type hints, and local names preserves Pass@1 and leaves ten of twelve re-tested results at chance

Abstract (fragment); checked

> Claude Haiku's self-preference also disappears.

Abstract; checked

> Claude chooses its own solution 75.2% of the time, while Gemini and DeepSeek, judging the same items, choose Claude's 63.4% and 64.2%

Results, blind-preference task (Table 4); not checked (one fetch)

> The study is zero-shot and black-box, and says nothing about what could be recovered by fine-tuning or probing.

Limitations; not checked (one fetch)

> The core models' MBPP solutions average 7–20 lines, far shorter than the code a monitor reviews in practice.

Limitations; not checked (one fetch)

Models and data as relayed by the fetch tool (not a sentence quote): five core models acting as generators and judges (GPT-5, Claude Haiku 4.5, Gemini 2.5 Flash, Grok 4 Fast, DeepSeek-V3-0324) and seven more generators on MBPP; MBPP 257 problems, HumanEval 164, DS-1000 Pandas subset 150; run through a model router between March and September 2026.

Set-up; not checked (one fetch)
