# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> When controlling for inference budget, generation ensembling and fusion across 8 different 70B LLMs is generally more effective than repeated sampling with only the top performing model.

Section 3.2 (Figure 4 discussion); checked (the first fetch returned the same sentence cut off after "repeated sampling")

> We have observed that ensembling, fusion, and ranking techniques have limited impact on CodeContests.

Section 4.3 (code task, reported separately); checked

> Archon architectures make multiple LLM API calls successively for different operations it can take 5x more time and money than a single LLM API call.

Section 4.4 (cost); checked (the first fetch returned the same text with an elision)

> When we build Archon architectures with 7B open-source models, we can boost task performance over the best individual 7B LM by 7.5%, on average.

Section 4.4; checked (the first fetch returned the same sentence with an elision)

> Archon can leverage additional inference compute budget to design systems that outperform frontier models such as OpenAI's o1, GPT-4o, and Claude 3.5 Sonnet by an average of 15.1%.

Abstract; not checked (one fetch)

The paper's discussion of a fuser or ranker being the same model as a generator: the two fetches contradicted each other (one said the same model families serve as generators and as fusers, rankers and critics, the other said the paper does not address it), so nothing is kept.

Section 4; not read reliably
