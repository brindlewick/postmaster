# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> The pattern earns its keep on a specific shape of bug: the diff that does exactly what the task asked, passes every test the author wrote, and is still wrong.

Section "What it actually catches" (the first read gave the first clause only); checked

> You don't need a smarter model to catch it. You need a second one with no loyalty to the patch.

Same article; checked (two reads give the same two sentences)

> I run this on every substantial change. A one-line typo fix slides through. Anything that touches logic, auth, money, or a migration gets handed to a Codex reviewer with an adversarial brief before it lands in front of me.

Same article; checked for the first sentence (both reads), the rest from one read

Note: both reads said the post gives no counts of bugs, runs, pull requests or percentages. The first read described a `Stop` hook that sends diffs over 25 changed lines or touching hot paths to Codex with a 60-second timeout and receives a verdict of approve, comment or block; that description is a paraphrase from one read and is not checked.
