# Pages contract v1

Part one of the host contract, written for the author of an artifact host: the program that stores pages and shows them to a reader. A host that follows it can have the review pages postmaster makes published to it, and can give back the comments readers leave on them. Part two, [Page bridge v1](page-bridge.md), is for the host's viewer.

What a tool publishing review pages needs from an artifact host: three commands in its `[pages]` settings, and an optional state capability. The messages a page exchanges with the host's viewer are in [page-bridge.md](page-bridge.md), Page bridge v1. MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

The **host** stores pages and shows them to a reader; the **tool** reads the settings and runs the commands. A **page** is named by a **slug**, and publishing to a slug adds a version. A **comment** is a reader's note on a page, anchored to quoted text or to lines of a file the page shows.

## Settings

```toml
[pages]
publish  = "host-cli publish {file} --slug {slug}"
comments = "host-cli comments {slug} --all --json"
close    = "host-cli close {id}"
bridge   = "page-bridge-v1"
state    = true
```

| key | required | value |
|---|---|---|
| `publish` | yes | command template with `{file}` and `{slug}` |
| `comments` | yes | command template with `{slug}` |
| `close` | yes | command template with `{id}` |
| `bridge` | no | the bridge version the viewer speaks; only `"page-bridge-v1"` is defined |
| `state` | no | `true` when the bridge offers page state; default `false` |

The tool MUST split a template into arguments on whitespace before substituting, and MUST pass each substituted value as one argument, never through a shell.

## Commands

Output is UTF-8 on stdout; success exits 0. On failure a command MUST exit non-zero and SHOULD write one line on stderr saying what failed. The tool MUST treat any non-zero exit as failure, whatever stdout holds, and show that line to the person.

### publish

Publishes `{file}` as a new version of `{slug}`, creating the slug if needed. On success stdout MUST contain a line `Title: <exact title>` and, on the next line, an absolute `http` or `https` link to the latest version. The tool MUST name the page by that exact title and link.

### comments

Prints every comment on `{slug}`, open or closed, as one JSON array; an empty array is success. Each element:

| field | type | meaning |
|---|---|---|
| `id` | string or integer | unique on the host; what `close` takes |
| `status` | `"open"` or `"closed"` | |
| `author` | string | display name; MAY be empty |
| `body` | string | plain text, never HTML |
| `createdAt` | string | ISO 8601 UTC |
| `anchor` | object | below |
| `version` | integer | the version the comment was made on |

The tool MUST ignore fields it does not know.

**Anchors.**

- Text: `{"kind": "text", "quote", "prefix", "suffix"}`, all strings: the selected text and up to 64 characters either side, so the host can find the passage on a newer version.
- Line: `{"kind": "line", "file", "side", "from", "to", "quote"?}`. `file` is the path as the page shows it, 1 to 1,024 characters; `side` is `"old"` or `"new"`; `from` ≤ `to` are 1-based, inclusive line numbers; `quote`, when present, is the text of those lines, at most 2,000 characters.

A tool that meets another `kind` MUST keep the comment and treat it as unanchored.

### close

Marks comment `{id}` closed and exits 0, including when it already was closed. An unknown id is a failure.

## The state capability

`bridge = "page-bridge-v1"` says the viewer answers the bridge messages; `state = true` adds that it keeps a page's state between visits. A host MUST NOT set `state = true` unless its viewer grants the `state` capability in `bridge-ready`.

State belongs to the slug, not a version: every version of a page reads and writes one document. A page that marks files as reviewed keys each mark by path and content hash (`tick:<path>:<sha256 hex>`), so an unchanged file keeps its mark on a new version and a changed one starts unmarked. Without `state`, the tool MUST NOT tell the person that marks will be kept.

## A missing or broken key

- No `publish`: the tool MUST NOT publish, and stops with an error naming the key.
- No `comments`: the tool says it cannot read comments for this host and goes on.
- No `close`: the tool leaves comments open and says so.
- An unknown placeholder, or a `bridge` naming an unknown version: the tool stops with an error naming the key.

The tool MUST NOT fall back to any other host or service.

## Conformance

A host conforms when `publish` prints `Title:` and the link on the next line; every command exits non-zero with a stderr line on failure; `comments` prints one array whose elements all carry the seven fields, `body` as plain text, and line anchors exactly as the page sent them; `close` is idempotent and fails on an unknown id; and `state = true` appears only with a viewer that grants `state`. A tool conforms when it substitutes without a shell, honours exit codes, ignores unknown fields and anchor kinds, and never falls back to another host.

```json
[
  {"id": 41, "status": "open", "author": "reviewer", "body": "Why is this retried?",
   "createdAt": "2026-10-31T09:12:00Z", "version": 3,
   "anchor": {"kind": "line", "file": "src/retry.ts", "side": "new", "from": 18, "to": 22}},
  {"id": 42, "status": "closed", "author": "", "body": "Typo.",
   "createdAt": "2026-10-31T09:15:40Z", "version": 3,
   "anchor": {"kind": "text", "quote": "recieve", "prefix": "will ", "suffix": " the reply"}}
]
```
