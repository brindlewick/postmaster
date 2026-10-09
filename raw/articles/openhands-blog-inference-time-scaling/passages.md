# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> We observe log-linear performance improvement from 60.6% on a single trajectory rollout to 66.4% with five attempts

Body text (fragment; the sentence continues); checked (two reads give the same wording)

> Rather than using this prompt-based reranking strategy, we trained a dedicated critic model.

Body text (one read); not checked

Note: neither read returned the name of the base model that produced the attempts, or the sampling temperature; the second read searched the page for "Claude", "Sonnet" and "temperature" and found none. A search listing said the attempts used Claude 3.7 Sonnet at temperature 1.0; that is a snippet only and is not relied on. The first read said the page gives no discussion of cost and does not discuss mixing base models.

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Read once by this package through a fetch tool (a third read of the page; it returned the front matter and body, and no sentence naming the base model).

> veRL to finetune Qwen 2.5 Coder Instruct 32B

Critic training (fragment; the same read says the objective is temporal-difference learning); not checked (one read)

> 60.6% on a single trajectory rollout to 66.4% with five attempts

Results (fragment of the sentence captured above); checked (this read and the capture above agree word for word)

Front matter as read (one read, not checked): dated 2025-04-17, one author named. The read found no prompt-based reranker, random-choice or best-of-five comparison, no cost statement and no limitations section.

## Numbers from the GitHub API, 2026-10-04 (repository OpenHands/OpenHands; the old path All-Hands-AI/OpenHands redirects to it)

- stars 89953; forks 11882; created 2024-03-13; last push 2026-10-03; licence MIT
- latest release v1.24.0, published 2026-09-25; default branch main; not archived
