# Controls

One positive control, a query for something known to exist, and one negative control, a nonsense
query, for each group where they could be run. A "not found" in the page is a statement about the search.
The record for each group has the queries in full.

| Group | Positive control | Negative control |
| --- | --- | --- |
| 1. Parallel and best-of-N agents | GitHub search `claude squad` returned smtg-ai/claude-squad first of 10 rows. The Codex query returned the documented `--attempts` option | GitHub search `qzxv blorptangle frobnicate` returned 0 repositories. No web-search negative control could be run |
| 2. Code evidence | Search 1 returned the arXiv page of "More Agents Is All You Need" first, and search 4 returned the CodeMonkeys paper | Search 5, an invented string, returned only pages about nonsense-word generators |
| 3. General evidence | An arXiv title search for "Rethinking Mixture of Agents" returned exactly that paper, and web searches returned the known 2026 paper's listing and the original Mixture-of-Agents PDF | The arXiv API query `all:zzqxvkw9plmq` returned no entries. No web-search negative control could be run |
| 4. Independence | A search for Knight and Leveson's 1986 paper returned its bibliographic records. An arXiv search for "N-version programming large language models" returned two known papers and missed two others, so its recall was about half on that query | A nonsense arXiv query returned 0 results |
| 5. Review | A query naming qodo-ai/pr-agent returned the maintained fork and the old address, and `gh api repos/openai/codex-plugin-cc` returned the repository | A query of four nonsense tokens and two real words returned nine pages about adversarial review and none containing a nonsense token. `gh api repos/zxqvbl-frobnitz/quorbal-88412` returned 404. A search for `alecnielsen/adversarial-review` returned no repository of that owner although the API returned it, 43 stars |
| 6. Spec-first | The GitHub topic page returned OpenSpec and BMAD-METHOD at ranks 1 and 3, and the arXiv search returned SpecMine | The topic page `zzqxv-nonexistent-topic-4471` returned 0 repositories. The arXiv query `zzqxv nonexistent qqjk specdriven 4471` returned 0 results. No web-search negative control could be run |
| 7. Audit trails | Web searches for the Entire CLI and for the OpenTelemetry agent-span conventions returned the projects' own pages, and `gh api repos/entireio/cli` returned the repository. Searches inside downloaded files each had a positive control through the same command | `gh api repos/entireio/zzqx-no-such-repo-731` returned Not Found. No web-search negative control could be run |
| 8. Orchestration tests | A query for the SWE-bench paper's title returned arXiv 2310.06770 first of nine results | A nonsense string returned nine results and none was relevant |
| 9. Closest tools | A search for karpathy/llm-council returned the repository first of 1,225 GitHub results, and a lookup of BeehiveInnovations/zen-mcp-server returned the repository now named pal-mcp-server | A string of invented words returned nine unrelated pages. Four narrow GitHub phrase searches returned zero results |

Counts that are arithmetic on a capture, such as an overlap computed from two tables, say so where they
appear, and the inputs are in the capture.
