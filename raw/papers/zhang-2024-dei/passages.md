# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> a DEI-guided committee of agents is able to surpass the best individual agent's performance by a large margin

Abstract; checked (two reads agree)

> can achieve a 34.3% resolve rate with DEI, making a 25% improvement

Abstract (fragment; the sentence begins "a group of open-source SWE agents, with a maximum individual resolve rate of 27.3% on SWE-Bench Lite" and ends "and beating most closed-source solutions"); checked for the fragment (two reads agree)

Table data as rendered by the fetch tool (not a sentence quote): DeiBase-1 55.0 (gpt4o) || Cosine Genie 50.6 (fine-tuned OpenAI) || CodeStory Aide 43.0 (gpt4o, Claude 3.5 Sonnet) || DeiBase-Open 34.3 (gpt4o) || Agentless 27.3 (gpt4o) || Moatless Tools 26.6 (Claude 3.5 Sonnet) || Aider 26.3 (gpt4o, Claude 3 Opus) || OpenDevin + CodeAct 26.0 (gpt4o)

Table 1, % resolved on SWE-bench Lite with the backend LLM of each row, rows as listed by the fetch tool; checked (two reads give the same numbers)

> 10 different agents: Union@10 54.3% | Average@10 26.6% | Intersect@10 4.7% || 10 runs of Agentless: Union@10 34.7% | Average@10 20.4% | Intersect@10 9.0%

Table 2 (union, average and intersection of the resolved sets), as listed by the fetch tool; checked (two reads give the same numbers)

> Different SWE agents resolve very different sets of issues (the colored girds in Fig 1a), despite having similar resolve rates (Fig 1b).

Introduction; not checked (one read gave this sentence, another a close paraphrase)

> in most DeiBase experiments, we allow 10 votes for each candidate patch

Section 4.3 (fragment); not checked (one read)


## Added by package P4-independence, retrieved 2026-10-04

Read through the arXiv abstract page (once) and the HTML full text (three fetches with different prompts). The arXiv page shows no comment field and no journal reference.

> SWE agents resolve very different sets of issues across agents and agent runs. Their full potential is far from fully released.

Section 4.2.1; checked (two fetches)

> Different agents resolve more distinct issues than different runs of a single agent.

Section 4.2.1; checked (two fetches). The next sentence, "In other words, diversity does empower intelligence.", came from one fetch only.

> a Large Language Model (LLM) as a code review committee

Section 3 or 4 (the committee in DeiBase; fragment); checked (two fetches). The model behind the committee was not named in the text retrieved.

Table 2 addition as rendered by the fetch tool (not a sentence quote): the committee's pick (1@k) was 35.7% for the 10 different agents and 26.0% for the 10 runs of Agentless, against unions of 54.3% and 34.7%. The 1@k column is from one fetch and is not checked; the union columns agree across reads.
