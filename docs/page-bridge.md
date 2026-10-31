# Page bridge v1

Part two of the host contract, written for the author of an artifact host's viewer: the window that shows a page to a reader. A viewer that follows it lets a page keep ticks and line comments without giving the page any access to the host. Part one, [Pages contract v1](pages-contract.md), is for the host's settings and commands.

How a page in a sandboxed frame keeps state and leaves line comments through the host's viewer, with no access to the host itself. The commands a tool runs are in [pages-contract.md](pages-contract.md). MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

## Roles and transport

The **page** runs in a frame sandboxed without same-origin access, so its origin is opaque; the **viewer** is the host's window around it. The page posts to `window.parent`, the viewer to the frame's `contentWindow`, both with target origin `"*"`.

The viewer adds the slug it shows itself; no message carries one, so a page reaches only its own state and comments.

Every message is one object, `{"bridge": "page-bridge", "v": 1, "type": ..., ...}`. A request carries an `id` of 1 to 64 characters of `A-Za-z0-9_-`, unique for the visit, and its answer carries the same `id`.

## Messages

| type | from | fields | answer |
|---|---|---|---|
| `bridge-hello` | page | `versions`, `want` | `bridge-ready` |
| `bridge-ready` | viewer | `version`, `caps`, `limits` | |
| `state-get` | page | `id` | `state` |
| `state-set` | page | `id`, `baseRev`, `set` (object), `del` (keys) | `state` |
| `state` | viewer | `id`, `doc`, `rev` | |
| `comment-create` | page | `id`, `body`, `anchor` | `comment` |
| `comments-get` | page | `id` | `comments` |
| `comment` | viewer | `id`, `comment` | |
| `comments` | viewer | `id`, `list` | |
| `comment-focus` | viewer | `anchor` | none |
| `bridge-error` | viewer | `id` if answering, `code`, `message`? | |

Any request MAY be answered with `bridge-error` instead.

**Handshake.** Once loaded, the page sends `bridge-hello` with the versions it speaks and the capabilities it wants (`"state"`, `"comments"`). The viewer answers with the highest version it shares, the capabilities it grants, and `limits`: `{"messageBytes": 65536, "stateBytes": 262144, "bodyChars": 4000, "writesPerSecond": 10}` or smaller values. No shared version gets `bridge-error` `unsupported`. Each load of the frame starts a new visit, answered only after its own `bridge-hello`.

**State.** One JSON object per slug, shared by all its versions. Keys are 1 to 256 characters; values are any JSON; the serialized document is at most `stateBytes` UTF-8 bytes. `rev` is `0` for a page with no state and rises by one on each applied write.

- `state-set` changes only the keys it names: each key in `set` takes its value, each in `del` is removed, so two readers marking different files never collide.
- If a named key changed in a write later than `baseRev`, nothing applies and the answer is `bridge-error` `conflict` with the current `doc` and `rev`. Otherwise the whole write applies at once and the answer is `state`.
- A write that would exceed `stateBytes` is refused `too_large`.

**Comments.** `comment-create` takes a line anchor as defined in [pages-contract.md](pages-contract.md#comments) and a plain-text `body` of 1 to `bodyChars` characters. The viewer stores it as an ordinary comment on the version shown, so the `comments` command returns it, and answers `comment` with it in the contract's shape. `comments-get` answers with the slug's comments that have line anchors.

**Focus.** When the reader taps a line comment in the viewer's list, the viewer sends `comment-focus`; the page SHOULD show those lines.

**Errors.** `code` is `bad_message`, `too_large`, `conflict`, `rate_limited`, `unsupported` or `unavailable` (the host could not read or store). `message` is plain text.

## What the viewer MUST do

1. Accept a message only when `event.source` is the frame's `contentWindow` and `event.origin` is `"null"`; drop anything else unanswered.
2. Check every field's presence, type, length and range before acting, answering `bad_message` on failure, and on an unknown `type`. Unknown fields MAY be ignored; a `slug` field MUST be.
3. Refuse a page message over `messageBytes` serialized with `too_large`. Viewer replies MAY reach `stateBytes` plus the envelope.
4. Allow each page at most `writesPerSecond` `state-set` and `comment-create` messages a second, answering the rest `rate_limited`, and SHOULD limit all its messages to a small multiple of that.

## What the viewer MUST NOT do

- Give the page anything beyond these messages: no token, cookie, API address, same-origin access, popup or navigation permission.
- Render a comment body, quote or file path as HTML.
- Send a page another slug's state or comments.
- Answer a document other than the one that sent `bridge-hello`.

## The page's side

- Wait 1.5 seconds for `bridge-ready`. Without it, or on `bridge-error`, keep state in memory for the visit and show "Not saved" where marks and comments appear.
- Treat a request unanswered for 5 seconds as `unavailable`.
- On `conflict`, reapply its change to the returned `doc` and resend.
- Key file marks by path and content hash (`tick:<path>:<sha256 hex>`), so a mark carries over to a new version only where the file is unchanged.

## Versioning

Within v1 a viewer MAY add capabilities, limits and reply fields, which a page MUST ignore if unknown. A new required message, a changed meaning or a tighter rule is a new version.

## Conformance

A viewer conforms when it checks source and origin, validates every field, enforces the four limits, merges by key under the `baseRev` rule, stores line comments where `comments` returns them, answers with the request's `id`, and grants nothing more.

```json
{"bridge":"page-bridge","v":1,"type":"bridge-hello","versions":[1],"want":["state","comments"]}
{"bridge":"page-bridge","v":1,"type":"bridge-ready","version":1,"caps":["state","comments"],
 "limits":{"messageBytes":65536,"stateBytes":262144,"bodyChars":4000,"writesPerSecond":10}}
{"bridge":"page-bridge","v":1,"type":"state-set","id":"r8","baseRev":12,
 "set":{"tick:src/retry.ts:9f2c41":true},"del":[]}
{"bridge":"page-bridge","v":1,"type":"bridge-error","id":"r8","code":"conflict","doc":{},"rev":13}
{"bridge":"page-bridge","v":1,"type":"comment-create","id":"r9","body":"Why is this retried?",
 "anchor":{"kind":"line","file":"src/retry.ts","side":"new","from":18,"to":22}}
```
