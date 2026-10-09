# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> For example, our MoA using only open-source LLMs is the leader of AlpacaEval 2.0 by a substantial gap, achieving a score of 65.1% compared to 57.5% by GPT-4 Omni.

Abstract; checked

> Both results suggest that having a larger number of diverse LLM agents in each MoA layer can improve performance.

Section 3.3; checked

> When many LLMs in a layer are identical, this configuration leads to a special structure that corresponds to a model generating multiple possibly different outputs (due to the stochasticity of temperature sampling).

Section 2.2; checked

> Our proposed method requires iterative aggregation of model responses, which means the model cannot decide the first token until the last MoA layer is reached.

Section 5, limitations; checked

> We denote n as either the number of agents in an MoA layer or the number of proposed outputs in the single-proposer setting.

Table 3 caption, second sentence; not checked

> We use Qwen1.5-110B-Chat as the aggregator and use 2 MoA layers for all settings in this table.

Table 3 caption, third sentence; not checked

> Impact of different models serving as proposers vs aggregators. When evaluating different aggregators, all six models serve as proposers; when evaluating proposers, Qwen1.5-110B-Chat serves as the aggregator.

Table 4 caption (first two sentences); not checked

> In contrast, WizardLM demonstrated excellent performance as an proposer model but struggled to maintain its effectiveness in aggregating responses from other models.

Section 3.3; not checked (a second fetch returned the same sentence without "In contrast," and with "a proposer"; the "an" may be a typo in the paper or a fix by the fetch tool)

> We ran our experiments three times and reported the average scores along with the standard deviation.

Section 3 (setup), as returned by one fetch; not checked

> MoA approach significantly outperforms an LLM-ranker baseline.

Section 3.3, LLM-ranker comparison; not checked (another fetch returned "Mixture-of-Agents significantly outperforms LLM rankers" for the Figure 4 text, so the wording is not settled; the same fetch read the Figure 4 values as about 61 against about 57 on AlpacaEval 2.0, approximate, not checked)

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 2(a), AlpacaEval 2.0 length-controlled win rate: MoA w/ GPT-4o 65.7±0.7; MoA 65.1±0.6; MoA-Lite 59.3±0.2; GPT-4 Omni (05/13) 57.5; GPT-4 Turbo (04/09) 55.0; WizardLM 8x22B 51.3; Qwen1.5 110B Chat 43.9; Qwen1.5 72B Chat 36.6; Llama 3 70B Instruct 34.4; Mixtral 8x22B v0.1 30.9.

Table 2(a); checked (two fetches agree)

Table 3, same aggregator (Qwen1.5-110B-Chat), 2 layers, AlpacaEval 2.0, "multiple-proposer / single-proposer": n=6 61.3 / 56.7; n=3 58.0 / 56.1; n=2 58.8 / 54.5; n=1 47.8 / 47.8.

Table 3; checked (two fetches agree)

Table 4, "as aggregator / as proposer": Qwen1.5-110B-Chat 61.3 / 56.7; Qwen1.5-72B-Chat 59.3 / 53.3; LLaMA-3-70b-Instruct 45.0 / 60.6; WizardLM 8x22B 52.9 / 63.8; Mixtral-8x22B-Instruct 48.4 / 54.8; dbrx-instruct 41.5 / 55.1.

Table 4; checked (two fetches agree on the cells they share; the other cells come from one fetch)

Configurations (Section 3.1): MoA has 3 layers of the same 6 proposers (Qwen1.5-110B, Qwen1.5-72B, WizardLM-8x22B, LLaMA-3-70B, Mixtral-8x22B, dbrx-instruct) and Qwen1.5-110B-Chat as final aggregator; MoA-Lite has 2 layers and Qwen1.5-72B-Chat as aggregator; MoA w/ GPT-4o has 3 layers and GPT-4o as aggregator. AlpacaEval 2.0 has 805 instructions and is judged by gpt-4-1106-preview.

Section 3.1; checked (two fetches agree)
