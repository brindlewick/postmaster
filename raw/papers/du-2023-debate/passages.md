# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Multi-agent results in the table are run with 3 agents and two rounds of debate.

Table 1 caption; checked

> In this set, we find that multi-agent debate improves the performance of both agents, with Bard solving 11 problems, chatGPT solving 14 problems, and joint multi-agent debate solving 17 problems.

Section 3.3, "Utilizing Different Language Models"; not checked (the other fetch gave the same three counts and said the set had 20 GSM8K problems)

> our multiagent debate procedure is more computationally expensive, as it requires both multiple language generations, and an underlying debate procedure.

Section 5, limitations; checked for this clause (both fetches)

> Despite answers being incorrect, language models would confidently affirm that their answer is correct and consistent with all other agent responses.

Section 5, limitations; not checked (the other fetch gave a shorter version of the sentence)

> We evaluated models on one hundred grade school math problems.

Section 3 (GSM8K setup); not checked

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 1, gpt-3.5-turbo-0301, accuracy ± standard error, arithmetic / GSM8K: Single Agent 67.0±4.7 / 77.0±4.2; Single Agent (Reflection) 72.1±4.5 / 75.0±4.3; Multi-Agent (Majority) 69.0±4.6 / 81.0±3.9; Multi-Agent (Debate) 81.8±2.3 / 85.0±3.5. Chess (a move-quality score): 91.4±10.6, 102.1±11.9, 102.2±6.2, 122.9±7.6. Other tasks: biographies (524 people) single 66.0, debate 73.8; MMLU (100 questions) single 63.9, debate 71.1.

Tables 1 and 2; checked for the arithmetic, GSM8K and chess rows (two fetches agree); the other rows come from one fetch
