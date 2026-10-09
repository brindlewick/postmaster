# Group 4: spec-first workflows with a person's sign-off: how the entries were found and chosen, what was not read, what was not found

Recorded on 2026-10-04 as the reading of this group was done. First-person wording was made impersonal, the reader standing for the one who read; nothing else was changed.

## How the entries were found and chosen

**Queries.** All WebSearch, mode `standard` (extended was never needed). Result counts are the number of links returned.

| # | Exact query | Results |
|---|---|---|
| 1 | spec-driven development AI coding agents specification approval before code | 9 |
| 2 | GitHub Spec Kit spec-driven development constitution specify plan tasks | 9 |
| 3 | Kiro spec-driven development requirements design tasks approval | 9 |
| 4 | BMAD-METHOD agentic agile PRD architecture story human review | 9 |
| 5 | OpenSpec Fission-AI proposal specs tasks archive spec-driven | 10 |
| 6 | Tessl spec-driven development agent enablement specs registry | 9 |
| 7 | arXiv spec-driven development coding agents empirical study specification quality | 9 |
| 8 | arXiv human review of agent plan before code generation improves task success coding agents | 9 |
| 9 | Claude Code plan mode approve plan before edits documentation | 9 |
| 10 | Cursor plan mode agent creates plan markdown review before build | 10 |
| 11 | Devin interactive planning review plan before Devin starts approve | 9 (3 relevant) |
| 12 | Traycer AI planning layer spec plan review coding agents | 10 |
| 13 | Kilo Code Roo Code architect mode plan before code orchestrator mode | 10 |
| 14 | GitHub Copilot plan mode VS Code plan agent approve implementation plan | 9 |
| 15 | obra superpowers brainstorming design approval implementation plan subagent-driven development | 9 |
| 16 | Gemini CLI Conductor extension context-driven development spec plan review before implementation | 9 |
| 17 | Kiro AWS announcement developers using Kiro number of users generally available spec-driven IDE 2026 | 9 |
| 18 | Kiro v3 engine parallel agents spec tasks changelog | 10 |
| 19 | Kiro Quick Spec "approval gates" feature specs requirements design tasks Kiro docs | 9 |
| 20 | "Kiro" AWS "generally available" developers spec-driven "since launch" users numbers announcement | 10 |
| 21 | Claude Code Ultraplan cloud planning multiple agents browser review plan docs | 9 |
| 22 | controlled experiment spec-driven development versus vibe coding AI agents measured defects rework pass rate 2026 paper | 9 |
| 23 | arXiv user study developers review and edit agent-generated plan before implementation coding agent plan mode human-in-the-loop | 10 |
| 24 | arXiv clarifying questions ambiguous issue SWE-bench agents ask user before coding improves resolve rate | 9 |
| 25 | Cursor docs parallel agents run same prompt multiple models best-of-n worktrees compare results | 9 |

Two more WebSearch calls were refused: "SpecOps 2026 workshop Specification-Driven Development Life Cycle SPLASH papers arXiv" and a nonsense query meant as the negative control. The refusal said the session's WebSearch budget (200 calls; the reader had made 25 of them) was used up. So the WebSearch queries had no negative control.

**Other ways of finding things (WebFetch, no search budget).**
- GitHub topic page, sorted by stars: `github.com/topics/spec-driven-development?o=desc&s=stars`. The page reported 2,277 public repositories; the tool returned the top 20 rows. Capture: `github-topics-spec-driven-development`.
- arXiv search page, phrase `"spec-driven development"`, all fields, newest first: 12 results (11 about software, 1 about mathematics). A second arXiv query (author name and key terms of a study quoted by an article) returned 0 results.
- `gh api repos/<owner>/<repo>` (plain GET) for stars, forks, dates, licence and latest release of 17 repositories; raw README and doc files at a pinned commit through `raw.githubusercontent.com` for the GitHub-hosted tools.

**Selection rule.**
- Tools named in the ticket's leads: read each unless unreachable (Spec Kit, Kiro, BMAD, OpenSpec, Tessl, Claude Code plan mode, Cursor plan mode, Devin, Traycer, Kilo and Roo, Copilot, Windsurf). Devin and Windsurf could not be read in the part that matters (see "Not read"). Roo Code: numbers only.
- Open-source tools not in the leads: stars as a proxy for use, taken from the topic page (cut-off about 3,000 stars; the topic page falls from 3.7k to 2.1k between its 9th and 10th rows) plus one repository that search found (Superpowers, 295k stars, not on the topic's first 20 rows). A star is a click, not a use; the notes say where this matters.
- Closed products: only vendors' own pages. Added Google Antigravity, because the Conductor README and a search result tie it to plan review.
- Papers and analyses (2025 to 2026): those that publish a method or numbers about a spec-first step, plan review, or what an underspecified instruction costs. Found by the arXiv phrase search (12 results) and by searches 7, 8, 22, 23, 24. Ten papers read in full text (one of them, Macedo, from a single full-text fetch), two papers read as abstract only (Diaz; Piskala), plus two practitioner articles (one on InfoQ with its own pilot, one on martinfowler.com).
- Left out, and why: three arXiv hits that are not about coding agents' sign-off (an undergraduate course report, a data-platform governance study, a mathematics paper), and one self-evolving-codebase paper (not read); one preprint whose abstract page the fetch tool returned only as a summary (Panda, `2606.30689`: three spec frameworks compared on two models, 240 and 600 implementations; not captured, claims not used); third-party blog posts that quote percentages (for example "defect density drops 25-40%") with no method, seen only as search snippets.

**Controls.**
- Positive, topic page: OpenSpec and BMAD-METHOD, which the reader knew existed, came back at ranks 1 and 3.
- Positive, arXiv search: SpecMine, which search 7 had found, came back in the 12 results.
- Positive, WebSearch: query 2 named Spec Kit; it returned pages about Spec Kit and a fork, but not the repository page `github.com/github/spec-kit` among its 9 links. Partial.
- Negative, topic page: `github.com/topics/zzqxv-nonexistent-topic-4471` returned 0 repositories and the page's message that the topic "hasn't been used on any public repositories, yet".
- Negative, arXiv search: the query `zzqxv nonexistent qqjk specdriven 4471` returned 0 results.
- Negative, WebSearch: could not be run (budget).
"Not found" below is a statement about this search only.

**How hard the reader looked.** 25 WebSearch queries (standard); about 105 page fetches (vendor docs, blogs, arXiv abstract and full-text pages); about 55 raw-file fetches (mostly quote checks against the raw files); about 45 GitHub API reads. That is well over the ticket's budget of about 60 fetches. The reader went over because the paper side kept adding numbers that changed the answer, and because every quote that carries a claim was fetched twice. Where the reader could not look: vendor adoption numbers for Claude Code, Cursor, Devin and Antigravity; Windsurf's docs; Claude Code's longer permission-modes page (about 85 KB, too large for the fetch tool to return); npm download counts (host not allowed for shell fetches); the Kiro vendor's own user count; any run of any tool (read only). One late fetch hit the fetch tool's session limit; see "Not read".

## Not read
- Devin "Interactive Planning": the page named by search query 11's snippet ("Reviewing Devin's plan is always helpful... code references and code snippets that you can review before approving") could not be fetched; the docs index of 2026-10-04 no longer lists it (the Ask Devin page is its nearest replacement). Unverified, snippet only.
- Windsurf planning mode: `docs.windsurf.com/windsurf/cascade/planning-mode` redirected to a `docs.devin.ai` address that returned 404. Not read.
- Claude Code permission-modes page (approval dialog options, `Ctrl+G` plan editing): too large for the fetch tool to return (about 85 KB). A search snippet lists the approval options; unverified, snippet only. The three other Claude Code pages were read.
- Kiro: user count ("more than a quarter of a million developers" in preview) and general availability dates came from trade-press snippets; unverified, snippet only. The v3 engine's `permissions.yaml` description: snippet only.
- Tessl: "3,000+ skills" and named customers came from a search summary; unverified, snippet only. The framework itself (closed beta per the same summary) was not read.
- Cursor "Best-of-N" docs; Cursor, Claude Code, Antigravity and Devin adoption numbers: not read / not stated.
- Roo Code docs (Architect mode): not read; API numbers only.
- Panda, `arXiv 2606.30689` ("Citation Discipline in Spec-Driven Development"): the abstract page came back as a summary of three frameworks compared on two models (traceSDD, Spec Kit, OpenSpec; 240 and 600 implementations; 86 to 88% hallucination detection); not read as text, no claim used.
- Ambig-SWE (`arXiv 2502.13069`, "up to 74%" from interaction), RealSWE (`2608.27831`), CURRANTE study design (`2601.03878`): search snippets only.
- Other arXiv hits not read: `2603.25697`, `2608.30572`, `2608.19838`.
- The SpecOps 2026 workshop proceedings (search refused). The GAISS 2026 paper behind the InfoQ article: not found on arXiv.
- Macedo (`2606.04967`): a second round of fetches was refused (session limit until 12:40 UTC), so its abstract wording and several full-text sentences are single-fetch.
- Not searched at all: OpenAI Codex plan mode, JetBrains, Amp, Factory, Replit and Lovable plan modes; Thoughtworks Radar's assessment of spec-driven development.

