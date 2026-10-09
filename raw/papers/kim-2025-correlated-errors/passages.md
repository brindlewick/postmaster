# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> On Helm, pairs of models agree on average about 60% of the time when both models are incorrect (choosing between incorrect answers uniformly at random would lead to an agreement rate of 1/3).

Section 1; not checked (one verbatim fetch; the other fetch gave "on one leaderboard dataset, models agree 60% of the time when both models err")

> each judge systematically inflates the accuracy of models that are less accurate than itself

Section 4; checked (the second fetch appends ", due to correlated errors")

> judges significantly inflate the accuracy of models from the same provider

Section 4, Figure 2; checked

> Importantly, even after conditioning on these factors, pairs of models that are more accurate individually also have more correlated errors.

Section 3.2; not checked (one fetch; the other fetch gave "More accurate models (and especially if both models are accurate) are more correlated.")

> One limitation of current metrics (including ours) is that they treat incorrect answers identically; in practice, some incorrect answers may be 'closer' to correct.

Conclusion; not checked (one fetch)

Data sizes: 349 models on 12,032 questions (Hugging Face Open LLM Leaderboard), 71 models on 14,042 questions (Helm), 20 models on 1,800 resume-job pairs; the first fetch added "15+ companies" for the providers.

Sections 2 and 3; checked for the model and question counts (two fetches agree)

## Added by package P4-independence, retrieved 2026-10-04

Read through the arXiv abstract page (once) and the HTML full text (two fetches with different prompts).

> We find substantial correlation in model errors -- on one leaderboard dataset, models agree 60% of the time when both models err.

Abstract; checked (abstract page and HTML agree; the dash character differs)

> Crucially, however, larger and more accurate models have highly correlated errors, even with distinct architectures and providers.

Abstract; checked (abstract page and HTML agree)

> The mean agreement rate across pairs is 0.423 on HuggingFace and 0.6 on Helm, about double or higher than the baselines.

Section 3; not checked as a sentence (one fetch; another fetch gave 0.423 against a baseline of 0.127 and 0.6 against 1/3)

> On both datasets, almost all pairs (100% of pairs on HuggingFace; 97.5% on Helm) of models have a higher agreement rate than the respective baselines.

Section 3; checked (two fetches)

> Models by the same developer, using the same base architecture, and having similar sizes are all associated with higher agreement rates.

Section 3 (regression discussion); not checked (one fetch)

> Richer evaluation of open-ended generation and complex reasoning tasks remains an important direction for future work.

Conclusion (limits of the task set); not checked (one fetch)

The arXiv comment field reads "Accepted to ICML 2025". A fetch asked for any mention of coding tasks and found none on the page.
