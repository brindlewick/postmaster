#!/usr/bin/env python3
"""Tally a classification of serious review findings, and the agreement of a second reader.

usage: tally.py <findings.tsv> <first-reading.tsv> [<second-reader.tsv> <anchors.tsv>]

first-reading.tsv: key, label, cost, confidence, by_construction, family, property_or_extract, reason
second-reader.tsv: item, key, is_anchor, in_sample, label, cost, confidence, by_construction, property_or_extract, reason
anchors.tsv:       key, expected_label, why_obvious

Prints markdown. Every count has a control through the same function: the agreement statistics are
also computed on a classification against itself (must read 100% and kappa 1) and against a seeded
shuffle of itself (must read near chance and kappa near 0).
"""
import csv, collections, random, sys


def read_tsv(path):
    with open(path, encoding="utf8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def kappa(a, b):
    """Cohen's kappa for two equal-length label lists."""
    n = len(a)
    if n == 0:
        return float("nan")
    po = sum(x == y for x, y in zip(a, b)) / n
    ca, cb = collections.Counter(a), collections.Counter(b)
    pe = sum((ca[k] / n) * (cb[k] / n) for k in set(a) | set(b))
    return 1.0 if pe == 1 else (po - pe) / (1 - pe)


def agree(a, b):
    return sum(x == y for x, y in zip(a, b)), len(a)


def qprop(label):
    return "yes" if label in ("prop", "both") else "no"


def qcore(label):
    return "yes" if label in ("core", "both") else "no"


def three(label):
    return {"prop": "prop", "both": "core", "core": "core", "neither": "neither"}.get(label, label)


def wilson(k, n, z=1.96):
    """Wilson score interval for k of n."""
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    h = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5)
    return ((c - h) / d, (c + h) / d)


def table(rows, header):
    out = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(x) for x in r) + " |")
    return "\n".join(out)


def counts(first, findings):
    runs = sorted({r["key"].split("/")[0] for r in first})
    cols = ["prop, cheap", "prop, heavy", "both", "core", "neither"]

    def col(r):
        if r["label"] == "prop":
            return "prop, " + r["cost"]
        return r["label"]

    rows = []
    for run in runs + ["all"]:
        sub = [r for r in first if run == "all" or r["key"].startswith(run + "/")]
        c = collections.Counter(col(r) for r in sub)
        rows.append([("#" + run) if run != "all" else "all", len(sub)] + [c.get(k, 0) for k in cols])
    return table(rows, ["run", "serious findings"] + cols)


def main():
    findings_path, first_path = sys.argv[1], sys.argv[2]
    findings = read_tsv(findings_path)
    first = read_tsv(first_path)
    assert len(findings) == len(first), (len(findings), len(first))
    assert {r["key"] for r in findings} == {r["key"] for r in first}

    print("## Counts of the first reading\n")
    print(counts(first, findings))
    print()
    conf = collections.Counter((r["label"] if r["label"] != "prop" else "prop, " + r["cost"], r["confidence"]) for r in first)
    clear = [r for r in first if r["confidence"] == "clear"]
    print(f"Marked clear: {len(clear)} of {len(first)}; arguable: {len(first) - len(clear)}.\n")
    rows = []
    for lab in ("prop, cheap", "prop, heavy", "both", "core", "neither"):
        rows.append([lab, conf.get((lab, "clear"), 0), conf.get((lab, "arguable"), 0)])
    print(table(rows, ["label", "clear", "arguable"]))
    print()
    byc = [r["key"] for r in first if r["by_construction"] == "yes"]
    print(f"Findings in a class a different structure would have removed (by construction): {len(byc)}: {', '.join(byc)}\n")

    # per-round view
    rnd = {r["key"]: int(r["round"]) for r in findings}
    run_of = {r["key"]: r["run"] for r in findings}
    print("## Serious findings by round\n")
    runs = sorted(set(run_of.values()))
    maxr = max(rnd.values())
    rows = []
    for run in runs:
        rows.append(["#" + run] + [sum(1 for k in rnd if run_of[k] == run and rnd[k] == i) for i in range(1, maxr + 1)])
    print(table(rows, ["run"] + [f"r{i}" for i in range(1, maxr + 1)]))
    print()

    # families
    fam = collections.defaultdict(list)
    for r in first:
        fam[r["family"]].append(r)
    rows = []
    for name, rs in sorted(fam.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        runs_in = sorted({x["key"].split("/")[0] for x in rs})
        rounds = sorted({rnd[x["key"]] for x in rs})
        labs = collections.Counter(x["label"] if x["label"] != "prop" else "prop-" + x["cost"] for x in rs)
        rows.append([name, len(rs), ", ".join("#" + x for x in runs_in), ", ".join("r" + str(x) for x in rounds), ", ".join(f"{k} {v}" for k, v in sorted(labs.items()))])
    print("## Families\n")
    print(table(rows, ["family", "n", "runs", "rounds", "labels"]))
    print()

    if len(sys.argv) >= 5:
        second_rows = read_tsv(sys.argv[3])
        anchors = {r["key"]: r["expected_label"] for r in read_tsv(sys.argv[4])}
        fb = {r["key"]: r for r in first}
        pairs = []
        for r in second_rows:
            pairs.append((r["key"], r["is_anchor"] == "True", r["in_sample"] == "True", fb[r["key"]], r))
        keys = second_rows
        print("## Second reader\n")
        print(f"Items answered: {len(pairs)} of {len(keys)}.\n")
        for name, sel in (("random sample", [p for p in pairs if p[2]]), ("anchors", [p for p in pairs if p[1]]), ("all items", pairs)):
            a = [p[3]["label"] for p in sel]
            b = [p[4]["label"] for p in sel]
            ag, n = agree(a, b)
            ap, _ = agree([qprop(x) for x in a], [qprop(x) for x in b])
            ac, _ = agree([qcore(x) for x in a], [qcore(x) for x in b])
            a3, _ = agree([three(x) for x in a], [three(x) for x in b])
            print(f"- {name}: n={n}; same four-way label {ag} ({100*ag/max(n,1):.0f}%), kappa {kappa(a,b):.2f}; same Q-PROP answer {ap}; same Q-CORE answer {ac}; same three-way group {a3} (kappa {kappa([three(x) for x in a],[three(x) for x in b]):.2f})")
            if name != "anchors":
                both_prop = [(p[3], p[4]) for p in sel if p[3]["label"] == "prop" and p[4]["label"] == "prop"]
                if both_prop:
                    ac2 = sum(x["cost"] == y["cost"] for x, y in both_prop)
                    print(f"  - where both said prop alone: same cost {ac2} of {len(both_prop)}")
                qa = [qprop(p[3]["label"]) for p in sel]
                qb = [qprop(p[4]["label"]) for p in sel]
                print(f"  - Q-PROP yes: first reader {qa.count('yes')} of {n}, second reader {qb.count('yes')} of {n}; Q-CORE yes: first {sum(qcore(p[3]['label'])=='yes' for p in sel)}, second {sum(qcore(p[4]['label'])=='yes' for p in sel)}")
                print(f"  - second reader's labels: {dict(collections.Counter(p[4]['label'] for p in sel))}; first reader's on the same items: {dict(collections.Counter(p[3]['label'] for p in sel))}")
        sel = [p for p in pairs if p[2]]
        k_ = sum(qprop(p[3]["label"]) == qprop(p[4]["label"]) for p in sel)
        lo, hi = wilson(k_, len(sel))
        print(f"- Same Q-PROP answer on the random sample: {k_} of {len(sel)} (Wilson 95% interval {100*lo:.0f}% to {100*hi:.0f}%).")
        k2 = sum(p[3]["label"] == p[4]["label"] for p in sel)
        lo, hi = wilson(k2, len(sel))
        print(f"- Same four-way label on the random sample: {k2} of {len(sel)} (Wilson 95% interval {100*lo:.0f}% to {100*hi:.0f}%).")
        bc = sum(p[3]["by_construction"] == p[4]["by_construction"] for p in pairs)
        print(f"- Same by-construction answer over all {len(pairs)} items: {bc}. First reader yes on {sum(p[3]['by_construction']=='yes' for p in pairs)}, second reader yes on {sum(p[4]['by_construction']=='yes' for p in pairs)}; a reader who counts a move from prose to script as a different structure says yes to more.")
        print(f"- Same confidence mark over all items: {sum(p[3]['confidence'] == p[4]['confidence'] for p in pairs)} of {len(pairs)}.")
        print()
        print("### The six anchors\n")
        rows = []
        for k, is_a, _, f, s in pairs:
            if is_a:
                rows.append([k, anchors[k], f["label"], s["label"], "yes" if s["label"] == anchors[k] else "no"])
        print(table(rows, ["anchor", "expected", "first reading", "second reader", "second matches expected"]))
        print()
        print("### Where the readers differ (random sample)\n")
        rows = []
        for k, is_a, ins, f, s in pairs:
            if ins and f["label"] != s["label"]:
                rows.append([k, f["label"] + (", " + f["cost"] if f["label"] == "prop" else ""), s["label"] + (", " + s["cost"] if s["label"] == "prop" else ""), f["confidence"] + "/" + s["confidence"]])
        print(table(rows, ["finding", "first", "second", "confidence (first/second)"]))
        print()

    # controls for the agreement statistic itself
    labs = [r["label"] for r in first]
    ag, n = agree(labs, labs)
    shuf = labs[:]
    random.Random(300).shuffle(shuf)
    ag2, _ = agree(labs, shuf)
    print("## Controls for the statistic\n")
    print(f"- A classification against itself: {ag} of {n} the same, kappa {kappa(labs, labs):.2f} (must be 100% and 1.00).")
    print(f"- The same classification against a seeded shuffle of itself: {ag2} of {n} the same, kappa {kappa(labs, shuf):.2f} (must be near chance and near 0).")


if __name__ == "__main__":
    main()
