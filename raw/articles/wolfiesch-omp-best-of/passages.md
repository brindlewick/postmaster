# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Run several OMP-powered candidate agents on the same task in isolated copy-on-write workspaces

README, opening sentence; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Sampling several solutions raises the chance that at least one is correct, but selecting among them remains a separate problem.

README, Why this exists; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Candidates inherit the calling session's model and thinking level, so `/best-of` runs what you are already running

README, Requirements; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Verification is separate and defaults to the `logprob` backend with `deepseek/deepseek-v4-flash`.

README, Requirements; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> For reference, the upstream project reports the following on Terminal-Bench 2.1 with DeepSeek V4 Flash for both generation and verification:

README, Cost and latency model; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> | Configuration | Random pass@1 | Verifier-selected | Oracle |

README, Cost and latency model, table header; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> | Best-of-3 | 79.4% | 86.5% | 92.1% |
> | Best-of-5 | 78.7% | 88.0% | 96.6% |

README, Cost and latency model, the two data rows; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Those results belong to the upstream authors and have not been reproduced here. Nothing in this repository should be read as an independent benchmark.

README, Cost and latency model; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> | Backend and setting | Verifier-selected | Random pass@1 | Oracle | Scope | RESULTS section |

README, Measured on this repository, table header; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> | Logprob, 1 evaluation | 5/10 (50.0%) | 62.5% | pass@4 100% | 10 selections over two reused discriminating tasks |

README, Measured on this repository, first row; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> | Sampled Luna, 1 round, source `06eefab` | 13/15 (86.7%) | 32.0% | pass@5 100% | 15 selections over five reused, deliberately discriminating pools |

README, Measured on this repository, second row; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Losing candidates are kept, so a rejected patch can still be inspected, replayed, or applied by hand.

README, Artifacts; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> `bench/` pays for candidate pools once, labels every candidate with a hidden oracle, then compares selection methods over the same stored pools.

README, Measured on this repository; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Earlier six-pool sampled headlines of 83.3% and 72.2% are withdrawn.

README, Measured on this repository; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> These are harness measurements, not general coding-agent accuracy estimates.

README, Measured on this repository; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

## Numbers from the GitHub API, 2026-10-04

- full_name: wolfiesch/omp-best-of
- stars: 71
- forks: 6
- created: 2026-08-18T00:41:05Z
- last push: 2026-10-01T01:28:33Z
- licence (API spdx_id): MIT
- archived: false
- description: Best-of-N coding agents with LLM-as-a-Verifier selection for Oh My Pi: isolated git worktrees, verifier-ranked trajectories, winner-only patch application
- latest release: v0.1.1 (2026-08-18T03:56:55Z)
