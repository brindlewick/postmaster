#!/usr/bin/env bash
# Health-check the wiki against skills/wiki/SKILL.md, so its rules are run rather than
# remembered. Deterministic checks belong in a script; a check written as prose is
# re-derived, and mis-derived, on every pass.
#
#   wiki-lint.sh [<repo>]      default: the repo this script lives in
#   wiki-lint.sh --self-test   run the checks against fixtures that must fail, then pass
#
# Reports every fault and fixes none: a standing contradicting its own records means either
# the standing or the reading is wrong, and which is a judgement for a person.
#
#   exit 0  clean
#   exit 1  faults found, one per line on stdout
#   exit 2  usage, or no wiki to check
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
SELFTEST=0
case ${1:-} in
  --self-test) SELFTEST=1; REPO=$(dirname "$HERE") ;;
  "") REPO=$(dirname "$HERE") ;;
  -*) echo "usage: wiki-lint.sh [<repo>] | --self-test" >&2; exit 2 ;;
  *) REPO=$1 ;;
esac

lint() {  # lint <repo>; prints faults, returns 1 if any
  python3 - "$1" <<'PY'
import pathlib, re, sys

repo = pathlib.Path(sys.argv[1])
wiki, raw = repo / "wiki", repo / "raw"
if not wiki.is_dir():
    print("no wiki/ in %s" % repo); sys.exit(2)

faults = []
def fault(p, msg):
    faults.append("%s: %s" % (p.relative_to(repo) if p != repo else p, msg))

pages = sorted(p for p in wiki.rglob("*.md"))
by_stem = {p.stem: p for p in pages}

def front_matter(text):
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    return dict(re.findall(r"^([a-z_]+):\s*(.*)$", text[3:end], re.M))

STANDINGS = {"claimed", "supported", "mixed", "refuted", "settled"}

def prose(text):
    # Notation is documented in backticks: `[@papers/<slug>]` is an example of a citation,
    # not one. Fenced blocks and inline code spans are examples, so they are not scanned.
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    return re.sub(r"`[^`]*`", "", text)

for p in pages:
    raw_text = p.read_text()
    text = prose(raw_text)
    fm = front_matter(raw_text)
    if fm is None:
        fault(p, "no front matter"); continue
    for key in ("title", "type", "updated"):
        if key not in fm:
            fault(p, "front matter has no %s" % key)
    if fm.get("type") == "concept":
        st = fm.get("standing")
        if st is None:
            fault(p, "concept with no standing")
        elif st not in STANDINGS:
            fault(p, "standing %r is not one of %s" % (st, ", ".join(sorted(STANDINGS))))

    # citations resolve to something under raw/
    for m in re.finditer(r"\[@([a-z]+)/([^\]\s]+)", text):
        kind, ident = m.group(1), m.group(2).rstrip("/.,;)")
        target = raw / kind / ident
        if not target.exists():
            fault(p, "citation [@%s/%s] does not resolve under raw/" % (kind, ident))

    # wikilinks resolve to a page
    for m in re.finditer(r"\[\[([^\]]+)\]\]", text):
        if m.group(1) not in by_stem:
            fault(p, "wikilink [[%s]] has no page" % m.group(1))

    # relative markdown links resolve
    for m in re.finditer(r"\]\(([^)#]+)\)", text):
        t = m.group(1)
        if t.startswith(("http://", "https://", "mailto:")):
            continue
        if not (p.parent / t).exists():
            fault(p, "link to %s does not resolve" % t)

# orphans: every page reachable from the index
index = wiki / "index.md"
if not index.exists():
    fault(wiki, "no index.md")
else:
    seen, queue = set(), [index]
    while queue:
        cur = queue.pop()
        if cur in seen:
            continue
        seen.add(cur)
        for m in re.finditer(r"\]\(([^)#]+)\)", prose(cur.read_text())):
            t = m.group(1)
            if t.startswith(("http://", "https://", "mailto:")):
                continue
            nxt = (cur.parent / t).resolve()
            if nxt.suffix == ".md" and nxt.exists():
                queue.append(nxt)
    for p in pages:
        if p.resolve() not in {s.resolve() for s in seen}:
            fault(p, "orphan: not reachable from index.md")

# a trial must be repeatable, a capture must say where it came from
if raw.is_dir():
    for d in sorted((raw / "trials").glob("*")) if (raw / "trials").is_dir() else []:
        if d.is_dir() and not (d / "method.md").exists():
            fault(d, "trial has no method.md, so it cannot be repeated")
    for kind in ("papers", "articles"):
        for d in sorted((raw / kind).glob("*")) if (raw / kind).is_dir() else []:
            if d.is_dir() and not (d / "source.md").exists():
                fault(d, "capture has no source.md")

# supported needs three records behind it
for p in pages:
    fm = front_matter(p.read_text()) or {}
    if fm.get("type") == "concept" and fm.get("standing") == "supported":
        srcs = [s for s in re.findall(r"[a-z]+/[^,\]\s]+", fm.get("sources", "")) if s]
        if len(srcs) < 3:
            fault(p, "standing supported with %d source(s); three are needed" % len(srcs))

for f in faults:
    print(f)
sys.exit(1 if faults else 0)
PY
}

if [ "$SELFTEST" -eq 0 ]; then
  lint "$REPO"; exit $?
fi

# --- self-test: the checks must fail on faults and pass on a clean tree -------------------
tmp=$(mktemp -d) || exit 2
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
cp -r "$REPO/wiki" "$tmp/wiki"; [ -d "$REPO/raw" ] && cp -r "$REPO/raw" "$tmp/raw"

fails=0
expect() {  # expect <want:pass|fail> <label>
  out=$(lint "$tmp"); rc=$?
  got=$( [ $rc -eq 0 ] && echo pass || echo fail )
  if [ "$got" = "$1" ]; then printf '  ok   %-44s (%s)\n' "$2" "$got"
  else printf '  FAIL %-44s wanted %s got %s\n' "$2" "$1" "$got"; printf '%s\n' "$out" | sed 's/^/       /'; fails=$((fails+1)); fi
}

echo "negative control: an unmodified copy"
expect pass "clean tree"

echo "positive controls: each fault is caught"
printf '\n[a dangling link](nowhere.md)\n' >> "$tmp/wiki/index.md"
expect fail "link that does not resolve"
git -C "$REPO" show HEAD:wiki/index.md > "$tmp/wiki/index.md" 2>/dev/null || cp "$REPO/wiki/index.md" "$tmp/wiki/index.md"

printf '\nCites [@runs/no-such-run] for this.\n' >> "$tmp/wiki/schema.md"
expect fail "citation with nothing under raw/"
cp "$REPO/wiki/schema.md" "$tmp/wiki/schema.md"

printf -- '---\ntitle: Orphan\ntype: concept\nstanding: claimed\nupdated: 2026-01-01\n---\n\nUnreachable.\n' > "$tmp/wiki/concepts/orphan.md"
expect fail "orphan page"
rm -- "$tmp/wiki/concepts/orphan.md"

printf -- '# No front matter here\n' > "$tmp/wiki/concepts/bare.md"
expect fail "page without front matter"
rm -- "$tmp/wiki/concepts/bare.md"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
