# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> prev_hash(N) = hex(SHA-256(JCS(record(N-1))))

Hash chain definition; checked (two fetches agree character for character)

> Tail truncation deserves separate emphasis: deleting the most recent records of a chain leaves a prefix that still verifies perfectly. Integrity of what remains is not evidence of completeness.

Security Considerations (Section 14); checked (two fetches agree; the first gave the second sentence verbatim and the first clause in other capitalisation)

> One of the registered action type values defined in Section 7. The initial registry contains: "tool_call", "tool_response", "decision", "delegation", "escalation", "error", "lifecycle".

Field table, row `action_type`; not checked as a sentence (one fetch gave this sentence; the other gave the same seven names as a list)

> This document specifies a standard logging format for autonomous AI agent systems. The Agent Audit Trail (AAT) defines a JSON-based record structure with mandatory fields for agent identity, action classification, outcome tracking, and trust level reporting.

Abstract (first two sentences, as the status page returned them; 38 words); not checked (one fetch)

> Records are linked via tamper-evident hash chaining using SHA-256 per RFC 8785, with optional ECDSA signatures for non-repudiation.

Abstract, third sentence, as the status page returned it; not checked (one fetch)

> The format addresses requirements from the EU AI Act (Regulation 2024/1689), which mandates automatic recording of events for high-risk AI systems...

Abstract, fourth sentence, cut off by the fetch tool at the ellipsis; not checked (one fetch)

## What the fetches reported about the record (not quotations)

Both fetches agreed on the seven action types above and on a Section 7.4 that defines delegation. The first fetch listed twelve mandatory fields (record_id, timestamp, agent_id, agent_version, session_id, action_type, action_detail, outcome, trust_level L0 to L4, parent_record_id, prev_hash, record_phase), five outcome values (success, failure, timeout, denied, escalated), signatures over the JCS-canonicalised record, and, for several agents, a `delegate_agent_id` field, a `prior_generation_tail` object and a `recording_component` field. Not checked by a second fetch beyond the action types and the delegation section. Both fetches found no sentence mentioning git, commits, source code, repositories or software development. The first fetch said the draft has no Implementation Status section.

## Status, from the status page (one fetch; not checked)

Revision -06, dated 29 September 2026; "Active Internet-Draft (individual submission)"; not endorsed by the IETF; expires 2 April 2027; no stream defined; no working-group adoption; versions -00 to -06 listed.

## Numbers

Not a repository. Adoption by implementers: not stated in the draft as read.
