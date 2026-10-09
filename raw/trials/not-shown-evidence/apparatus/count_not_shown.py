#!/usr/bin/env python3
"""Count the `## Evidence` entries in lane summaries, read from each lane branch (read-only).

  count_not_shown.py <repo>... [--reasons]

For every branch wb/* that holds a WORKHORSE-SUMMARY.md at its tip: parse the Evidence section
into numbered entries and count each as shown (cites a path) or not shown (starts `not shown`).

Controls, through the same parser: a made-up summary with two shown entries and one not shown
must count 2 and 1; a summary with no Evidence section must count as having none.
"""
import collections
import re
import subprocess
import sys


def git(repo: str, *args: str) -> tuple[int, str]:
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    return r.returncode, r.stdout


def entries(text: str):
    """The numbered entries of the Evidence section, or None when there is no such section."""
    m = re.search(r"(?m)^## Evidence[^\n]*\n", text)
    if not m:
        return None
    rest = text[m.end():]
    n = re.search(r"(?m)^## ", rest)
    section = rest[: n.start()] if n else rest
    found, cur = [], None
    for line in section.split("\n"):
        mm = re.match(r"^(\d+)\.\s+(.*)$", line)
        if mm:
            cur = {"n": int(mm.group(1)), "text": mm.group(2)}
            found.append(cur)
        elif cur is not None and line.startswith((" ", "\t")) and line.strip():
            cur["text"] += " " + line.strip()
    return found


def classify(text: str) -> str:
    plain = re.sub(r"[`*_]", "", text).strip().lower()
    if plain.startswith("not shown"):
        return "not shown"
    if ".postmaster/verify/" in text:
        return "shown"
    return "other"


def reason(text: str) -> str:
    plain = re.sub(r"[`*]", "", text).strip()
    return re.sub(r"(?i)^not shown:?\s*", "", plain)


# controls
sample = "x\n## Evidence\n1. `.postmaster/verify/a.txt`\n2. not shown: no browser\n3. `.postmaster/verify/b.txt`\n   - `.postmaster/verify/c.txt`\n## Next\n"
got = collections.Counter(classify(e["text"]) for e in entries(sample))
assert got == {"shown": 2, "not shown": 1}, got
assert entries("no evidence heading here\n") is None


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    show_reasons = "--reasons" in sys.argv
    rows = []
    for repo in args:
        rc, out = git(repo, "for-each-ref", "--format=%(refname:short)|%(committerdate:short)", "refs/heads/wb/*")
        if rc != 0:
            continue
        for line in out.strip().split("\n"):
            if not line:
                continue
            branch, date = line.split("|")
            rc, text = git(repo, "show", f"{branch}:WORKHORSE-SUMMARY.md")
            lane = branch.split("-", 1)[1] if "-" in branch else branch
            ticket = branch.split("/", 1)[1].rsplit("-", 1)[0]
            row = {"repo": repo.rstrip("/").split("/")[-1], "branch": branch, "date": date, "lane": branch.rsplit("-", 1)[-1], "ticket": ticket, "summary": rc == 0}
            if rc == 0:
                es = entries(text)
                row["evidence"] = es is not None
                row["counts"] = collections.Counter(classify(e["text"]) for e in (es or []))
                row["reasons"] = [reason(e["text"]) for e in (es or []) if classify(e["text"]) == "not shown"]
            rows.append(row)

    total = len(rows)
    with_summary = [r for r in rows if r["summary"]]
    with_evidence = [r for r in with_summary if r["evidence"]]
    c = collections.Counter()
    for r in with_evidence:
        c.update(r["counts"])
    print(f"lane branches {total}; with a summary {len(with_summary)}; with an Evidence section {len(with_evidence)}")
    if with_evidence:
        dates = sorted(r["date"] for r in with_evidence)
        print(f"Evidence sections dated {dates[0]} to {dates[-1]}")
    n = sum(c.values())
    print(f"entries {n}: shown {c['shown']}, not shown {c['not shown']}, other {c['other']}")
    lanes = collections.defaultdict(collections.Counter)
    for r in with_evidence:
        lanes[r["lane"]].update(r["counts"])
        lanes[r["lane"]]["summaries"] += 1
    for lane, cc in sorted(lanes.items()):
        tot = cc["shown"] + cc["not shown"] + cc["other"]
        print(f"  {lane:<8} summaries {cc['summaries']:>3}  entries {tot:>4}  not shown {cc['not shown']:>3}  other {cc['other']:>3}")
    ns_summaries = [r for r in with_evidence if r["counts"]["not shown"]]
    print(f"summaries with at least one not shown: {len(ns_summaries)} of {len(with_evidence)}")
    if show_reasons:
        for r in ns_summaries:
            for why in r["reasons"]:
                print(f"- [{r['repo']} {r['branch']}] {why[:260]}")


if __name__ == "__main__":
    main()
