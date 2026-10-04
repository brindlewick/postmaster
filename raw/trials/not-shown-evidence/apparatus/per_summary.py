#!/usr/bin/env python3
"""List, per lane summary with an Evidence section, how many entries it has and how many are `not shown`.

  per_summary.py <repo>

Reads each branch wb/* of the repository at the tip, as count_not_shown.py does, and uses its parser and
its classifier, so the two cannot disagree. Prints the summaries that hold at least one `not shown`
entry, then the count of the rest, then any summary whose every entry is `not shown`.
"""
import collections
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import count_not_shown as c


def rows_for(repo):
    rc, out = c.git(repo, "for-each-ref", "--format=%(refname:short)|%(committerdate:short)", "refs/heads/wb/*")
    res = []
    for line in out.strip().split("\n"):
        if not line:
            continue
        branch, date = line.split("|")
        rc, text = c.git(repo, "show", f"{branch}:WORKHORSE-SUMMARY.md")
        if rc != 0:
            continue
        es = c.entries(text)
        if es is None:
            continue
        cnt = collections.Counter(c.classify(e["text"]) for e in es)
        ticket = branch.split("/", 1)[1].rsplit("-", 1)[0]
        lane = branch.rsplit("-", 1)[-1]
        res.append((ticket, lane, date, len(es), cnt["not shown"]))
    return res


real = rows_for(sys.argv[1])
print("summaries with an Evidence section, by entries and not shown")
print(f"{'ticket':<8}{'lane':<6}{'date':<12}{'entries':>8}{'not shown':>10}")
for r in sorted(real, key=lambda r: (-r[4], r[0])):
    if r[4]:
        print(f"{r[0]:<8}{r[1]:<6}{r[2]:<12}{r[3]:>8}{r[4]:>10}")
none = [r for r in real if not r[4]]
print(f"... and {len(none)} summaries with none: entries {sum(r[3] for r in none)}")
print()
print("summaries whose every entry is not shown:", [(r[0], r[1], r[3]) for r in real if r[3] and r[3] == r[4]])
print("total entries", sum(r[3] for r in real), "not shown", sum(r[4] for r in real))
