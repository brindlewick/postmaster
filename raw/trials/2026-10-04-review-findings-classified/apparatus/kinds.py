#!/usr/bin/env python3
"""Group the serious findings into six kinds of check, by the family tag of the first reading.

usage: python3 apparatus/kinds.py first-reading.tsv

The family tags are the first reader's own (column `family` of first-reading.tsv). The grouping
below is a second step, made after the labels, and every family belongs to exactly one kind; the
script stops if a family has none, so a new tag cannot be dropped from the count.
"""
import csv
import collections
import sys

KINDS = [
    ("A", "A reader of text must obey a law (it splits, quotes, renders, parses or validates text)",
     ["classifier-syntax", "scanner-lexing", "card-escaping", "card-content", "integrity", "limit",
      "hidden-state", "validation", "policy", "pure-already", "scanner-soundness"]),
    ("B", "A reader must agree with a real tool, a format or git",
     ["classifier-semantics", "scanner-vs-tool", "encoding-edge", "interface-fact", "output",
      "location", "filesystem-edge"]),
    ("C", "A procedure over states and steps has a case missing (restore, attribution, process ids, exit status, reruns)",
     ["restore", "attribution", "pid-reuse", "state-catalogue", "idempotence", "exit-status"]),
    ("D", "Two paths that must agree do not (dry run and real run, promote and check, range and files)",
     ["dry-run-parity", "adapter-contract", "agreement", "scanner-agreement"]),
    ("E", "The environment or an effect leaks into a decision (ambient variables, a failed read read as a value, a forgotten log)",
     ["environment", "read-error", "forgotten-effect"]),
    ("F", "Runbook prose, or a decision inferred from free text: nothing to run",
     ["protocol-prose", "classifier-inference"]),
]


def main(path):
    rows = list(csv.DictReader(open(path, encoding="utf8"), delimiter="\t"))
    family_to_kind = {f: k for k, _, fs in KINDS for f in fs}
    missing = sorted({r["family"] for r in rows if r["family"] not in family_to_kind})
    if missing:
        sys.exit("families with no kind: " + ", ".join(missing))
    count = collections.defaultdict(collections.Counter)
    for r in rows:
        k = family_to_kind[r["family"]]
        lab = "prop, " + r["cost"] if r["label"] == "prop" else r["label"]
        count[k][lab] += 1
        count[k]["n"] += 1
    print("| kind | findings | prop, cheap | prop, heavy | both | neither |")
    print("|---|---|---|---|---|---|")
    total = collections.Counter()
    for k, name, _ in KINDS:
        c = count[k]
        total.update(c)
        print(f"| {k}. {name} | {c['n']} | {c['prop, cheap']} | {c['prop, heavy']} | {c['both']} | {c['neither']} |")
    print(f"| all | {total['n']} | {total['prop, cheap']} | {total['prop, heavy']} | {total['both']} | {total['neither']} |")


if __name__ == "__main__":
    main(sys.argv[1])
