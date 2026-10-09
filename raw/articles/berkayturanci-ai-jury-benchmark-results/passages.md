# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

Table "The run" (as printed; panel = claude (Anthropic), codex (OpenAI), agy (Google) and a local qwen2.5-coder:7b; 5 labelled diffs); checked (raw file text):

> | single: `claude` | 4/5 | 0.67 | 1.00 |
> | single: `codex` | 3/5 | 0.33 | 1.00 |
> | single: `agy` | 3/5 | 0.33 | 1.00 |

> | single: `qwen` (local) | 4/5 | 0.67 | 1.00 |
> | **panel** — 4 vendors, 1 round | 4/5 | **1.00** | 0.75 |
> | jury — 4 vendors, 2 rounds + verify | 4/5 | **1.00** | 0.60 |

Columns: configuration, fixtures passed, recall (bugs found), precision (no false alarms).

> the run did **not pin** model versions, so each cloud reviewer used its CLI's **default model on 2026-06-05**

"The run"; checked (raw file text, two source lines joined)

> **N = 5**, one run per config, and LLM output is **nondeterministic**

"Honest caveats"; checked (raw file text)

> This is a smoke signal and a regression guard, not a universal quality claim.

"Honest caveats" (two source lines joined); checked (raw file text)
