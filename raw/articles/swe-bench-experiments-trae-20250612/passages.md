# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> name: TRAE + Claude Sonnet 4 + Opus 4 + Sonnet 3.7 + Gemini 2.5 Pro

metadata.yaml, `info`; checked (raw file text)

> - claude-4-sonnet-20250522
> - claude-4-opus-20250522
> - claude-3-7-sonnet-20250219
> - gemini-2.5-pro-preview-06-05

metadata.yaml, `tags.model`; checked (raw file text)

> checked: false

metadata.yaml, `tags` (the flag as written; the fetched file does not say what the benchmark maintainers mean by it); checked (raw file text)

> - [X] Is a pass@1 submission (does not attempt the same task instance more than
>   once)

README.md, "Submission Checklist" (as written, over two lines); checked (raw file text)

Counted from results/results.json (run locally on the downloaded file): the `resolved` list has 376 entries and `no_generation` has 1; 376 of 500 issues is 75.2%. This matches the paper's headline figure; the file does not say how the four models were combined.
