#!/usr/bin/env bash
# Blind acceptance tests for #81: each workhorse's spec passes the user's review
# before any code. Written before any lane's diff was read, committed first on the
# ticket branch, and run against each lane's branch at harvest. Retired once the
# synthesis passes it: the lanes' own self-tests are the lasting cover.
#
#   planning-acceptance.sh [repo-root]   default .
#
# Only the ticket's named interfaces are asserted: the planning stage in
# scripts/stage.sh, the stage timings, the wiki pages and lint, and the link
# template in config.example.toml. The review interaction itself lives in the
# runbooks' prose and is judged by reading, not here.
#
#   exit 0  every control behaved
#   exit 1  one or more controls misbehaved
set -uo pipefail
ROOT=${1:-.}
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; fails=$((fails+1)); }

echo "AC6: the planning stage"
"$ROOT/scripts/stage.sh" --self-test >/dev/null 2>&1 \
  && ok "stage.sh --self-test passes" || fail "stage.sh --self-test passes"
order=$("$ROOT/scripts/stage.sh" --list 2>/dev/null | tr '\n' ' ')
case " $order " in
  *" bootstrapped planning workhorses-running "*) ok "planning sits between bootstrapped and workhorses-running" ;;
  *) fail "planning sits between bootstrapped and workhorses-running (got: $order)" ;;
esac
grep -q planning "$ROOT/scripts/stage.sh" \
  && ok "stage.sh covers the planning stage in its self-test" || fail "stage.sh covers the planning stage in its self-test"
tmp=$(mktemp -d) || exit 1
trap 'rm -rf -- "$tmp" </dev/null 2>/dev/null' EXIT
d="$tmp/RUN-1"; mkdir -p "$d"
printf '{"stage": "dispatched", "leg": 1, "base": "abc123", "lanes": {}, "coachman": {"legs": {}}}\n' > "$d/manifest.json"
: > "$d/actions.jsonl"; : > "$d/run-log.md"
"$ROOT/scripts/log-action.sh" "$d" postmaster dispatch RUN-1 "test" >/dev/null 2>&1
"$ROOT/scripts/stage.sh" "$d" bootstrapped coachman >/dev/null 2>&1
"$ROOT/scripts/stage.sh" "$d" planning coachman >/dev/null 2>&1; rc_plan=$?
"$ROOT/scripts/stage.sh" "$d" workhorses-running coachman >/dev/null 2>&1; rc_wh=$?
times=$("$ROOT/scripts/run-times.sh" "$d" 2>/dev/null)
[ $rc_plan -eq 0 ] && [ $rc_wh -eq 0 ] && printf '%s' "$times" | grep -q '^planning ' \
  && ok "the timings show how long the planning stage took" \
  || fail "the timings show how long the planning stage took (planning exit $rc_plan, workhorses-running exit $rc_wh)"

echo "AC7: the wiki"
"$ROOT/scripts/wiki-lint.sh" >/dev/null 2>&1 \
  && ok "the wiki lints clean" || fail "the wiki lints clean"
if grep -qi 'nobody reviews' "$ROOT/wiki/concepts/workhorse-spec.md" 2>/dev/null; then
  fail "the workhorse-spec page no longer says nobody reviews it"
else
  ok "the workhorse-spec page no longer says nobody reviews it"
fi
if grep -rl 'ai-native-sdlc-playbook' "$ROOT/raw/articles/" 2>/dev/null | grep -q .; then
  ok "raw/articles/ captures the playbook"
else
  fail "raw/articles/ captures the playbook"
fi
page_found=""
for p in "$ROOT"/wiki/concepts/*.md; do
  [ -f "$p" ] || continue
  [ "$p" = "$ROOT/wiki/concepts/workhorse-spec.md" ] && continue
  if grep -qi 'planning stage' "$p" && grep -q 'standing: claimed' "$p" && grep -q '\[@articles/' "$p"; then
    page_found=$p; break
  fi
done
if [ -n "$page_found" ] && grep -qi 'planning' "$ROOT/wiki/index.md"; then
  ok "a decision page at standing claimed explains the planning stage ($(basename "$page_found"))"
else
  fail "a decision page at standing claimed explains the planning stage"
fi

echo "AC8: the spec link template"
if python3 - "$ROOT/config.example.toml" <<'PY' 2>/dev/null; then
import sys
lines = open(sys.argv[1]).read().splitlines()
hits = [n for n, l in enumerate(lines) if "{path}" in l]
ok = any(any("spec" in lines[m].lower() for m in range(max(0, n-6), min(len(lines), n+7))) for n in hits)
sys.exit(0 if ok and len(hits) >= 2 else 1)
PY
  ok "the machine config documents a spec link template with {path}"
else
  fail "the machine config documents a spec link template with {path}"
fi

echo "AC1-5: the review mechanism lives in the runbooks"
if grep -qil 'spec' "$ROOT/skills/postmaster/coachman.md" && grep -qil 'spec.*review\|review.*spec' "$ROOT/skills/postmaster/postmaster.md"; then
  ok "both runbooks name the spec review"
else
  fail "both runbooks name the spec review"
fi

echo
[ "$fails" -eq 0 ] && { echo "oracle: all controls behaved"; exit 0; }
echo "oracle: $fails control(s) misbehaved"; exit 1
