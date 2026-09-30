#!/usr/bin/env bash
# Oracle for #98 (v2): blind acceptance tests at the ticket's own interface.
#
# v2, written after the user rewrote the ticket on 2026-09-30. The ticket is
# now "a fixture run's postmaster runs headless, so it never stops at a trust
# prompt": v1's trust-write and config-lock probes are superseded and gone.
# Written from the ticket text and the repo's existing interfaces, before any
# lane code exists and before the approved spec was read, committed on the
# ticket branch after the merge of origin/main.
#
#   oracle-98.sh   run from the repo root; exit 0 when the worktree meets the
#                  ticket, 1 otherwise, one line per probe.
#
# What has no generic probe here is verified at synthesis by reading plus
# targeted execution, and recorded on the checkpoint card:
# - AC2/AC5, the mark-removed half: removing the mark needs the spec's mark
#   mechanism, which this oracle was written without. The oracle proves the
#   marked copy decides headless and other targets decide as before, through
#   the same command; synthesis runs the mark-removed case per lane.
# - AC3, "on every host" and the brief's exact prose: the oracle proves the
#   `headless` decision is wired into SKILL.md and the reused hosts.md form
#   exists; the wiring and prose are read, not grepped.
# - AC7, a fixture run reaching its score: needs models and hours, so no
#   per-lane probe. Who dispatches it from this branch is an open question
#   for the postmaster/next leg, noted in handoff-1.
set -uo pipefail

HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
[ -f "$HERE/scripts/fixture.sh" ] && [ -f "$HERE/scripts/front-door.sh" ] \
  || { echo "oracle: run from the repo root: scripts/fixture.sh or scripts/front-door.sh not found" >&2; exit 1; }
need() { for t in "$@"; do command -v "$t" >/dev/null 2>&1 || { echo "oracle: $t is not on PATH" >&2; exit 1; }; done; }
need git python3
fail=0
pass() { echo "PASS $1: $2"; }
nope() { echo "FAIL $1: $2"; fail=$((fail+1)); }

[ -z "$(git -C "$HERE" status --porcelain -- fixtures)" ] \
  || { echo "oracle: fixtures/ has uncommitted changes; fixture.sh new would refuse" >&2; exit 1; }
ticket=$(ls "$HERE/fixtures/tickets" | head -1)
[ -n "$ticket" ] || { echo "oracle: no fixture ticket found" >&2; exit 1; }

tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
export GIT_AUTHOR_NAME=oracle GIT_AUTHOR_EMAIL=oracle@example.invalid
export GIT_COMMITTER_NAME=oracle GIT_COMMITTER_EMAIL=oracle@example.invalid
home=$tmp/home; runs=$tmp/runs; mkdir -p "$home" "$runs"

cat > "$tmp/config.toml" <<'EOF'
[team]
postmaster = { harness = "claude", model = "pm-model" }
EOF

# A plain git repo that is NOT a fixture copy: the as-it-was control.
plain=$tmp/plain
git init -q -b main "$plain" && git -C "$plain" commit -q --allow-empty -m base

new() {  # new <dest-args...>: fixture.sh new under the scratch home and config
  HOME=$home POSTMASTER_CONFIG=$tmp/config.toml POSTMASTER_FIXTURES=$tmp/fixtures \
    bash "$HERE/scripts/fixture.sh" new "$@" >"$tmp/new.out" 2>"$tmp/new.err"; echo $? >"$tmp/new.rc"
}
decide() {  # decide <harness> <model> <cwd> <at-terminal> <target>: first word of the decision
  bash "$HERE/scripts/front-door.sh" "$1" "$2" "$3" "$4" "$5" --config "$tmp/config.toml" 2>"$tmp/decide.err" \
    | head -1 | awk '{print $1}'
}

# P1 (AC1): `new` makes the copy, one commit on main, nothing untracked.
copy1=$runs/copy1
new "$copy1" "$ticket"; rc=$(cat "$tmp/new.rc")
commits=$(git -C "$copy1" rev-list --count main 2>/dev/null || echo ERROR)
dirty=$(git -C "$copy1" status --porcelain 2>/dev/null | head -3)
if [ "$rc" -eq 0 ] && [ "$commits" = 1 ] && [ -z "$dirty" ]; then
  pass P1-clean-tree "one commit on main, nothing untracked"
else
  nope P1-clean-tree "exit $rc, commits=$commits, untracked-or-dirty=[$dirty]"
fi

# P2 (AC1 mark + AC2): the marked copy's decision says `headless`, through the
# same command that decides any target — in a case that would be `self` and in
# one that would be `spawn`. (The mark itself is proven by the flip: only a
# marked copy decides headless.)
self_case=$(decide claude pm-model "$copy1" yes "$copy1")
spawn_case=$(decide other-harness other-model "$plain" no "$copy1")
if [ "$self_case" = headless ] && [ "$spawn_case" = headless ]; then
  pass P2-headless "would-be self and would-be spawn both say headless"
else
  nope P2-headless "would-be self says '$self_case', would-be spawn says '$spawn_case'"
fi

# P3 (AC2): for any other target the decision is as it was.
plain_self=$(decide claude pm-model "$plain" yes "$plain")
plain_spawn=$(decide other-harness other-model "$plain" no "$plain")
if [ "$plain_self" = self ] && [ "$plain_spawn" = spawn ]; then
  pass P3-as-was "non-fixture target: self stays self, spawn stays spawn"
else
  nope P3-as-was "non-fixture target: self-case says '$plain_self', spawn-case says '$plain_spawn'"
fi

# P4 (AC4): nothing writes any harness's trust setting. A scratch home holding
# lived-in trust stores must be byte-identical after `new`, with no new files.
mkdir -p "$home/.codex"
printf '{"projects":{"/tmp/elsewhere":{"hasTrustDialogAccepted":true}},"theme":"dark"}\n' > "$home/.claude.json"
printf '\n[projects."/tmp/elsewhere"]\ntrust_level = "trusted"\n' > "$home/.codex/config.toml"
before=$(cd "$home" && find . -type f | sort | while IFS= read -r f; do sha1sum <"$home/$f" | sed "s| .*|  $f|"; done)
new "$runs/copy2" "$ticket"; rc=$(cat "$tmp/new.rc")
after=$(cd "$home" && find . -type f | sort | while IFS= read -r f; do sha1sum <"$home/$f" | sed "s| .*|  $f|"; done)
real_before=absent; [ -f "$HOME/.claude.json" ] && real_before=$(sha1sum < "$HOME/.claude.json")
if [ "$rc" -eq 0 ] && [ "$before" = "$after" ]; then
  pass P4-no-trust-write "scratch trust stores byte-identical, no new home files"
else
  nope P4-no-trust-write "exit $rc, home changed: [$(diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") | head -4 | tr '\n' ';')]"
fi
real_after=absent; [ -f "$HOME/.claude.json" ] && real_after=$(sha1sum < "$HOME/.claude.json")
[ "$real_before" = "$real_after" ] \
  && pass P4b-real-untouched "real ~/.claude.json unchanged" \
  || nope P4b-real-untouched "real ~/.claude.json changed"

# P5a (AC3): SKILL.md wires the `headless` decision into the front door: the
# decision value, not prose about headless launches. (Wording-sensitive by
# necessity: a lane that behaves right but words it otherwise is judged by
# reading at synthesis.)
if grep -q '`headless`' "$HERE/skills/postmaster/SKILL.md"; then
  pass P5a-skill "SKILL.md names the \`headless\` decision"
else
  nope P5a-skill "SKILL.md never names the \`headless\` decision"
fi

# P5b (AC3): the reused form exists: hosts.md's headless postmaster launch.
if grep -q 'launch postmaster' "$HERE/skills/postmaster/hosts.md" \
   && grep -q 'ESCALATION.md' "$HERE/skills/postmaster/hosts.md"; then
  pass P5b-form "hosts.md keeps the headless postmaster form"
else
  nope P5b-form "hosts.md headless postmaster form missing"
fi

# P6a (AC5): the self-test carries the headless-decision control: the copy's
# decision and the mark-removed decision through the same command. The control
# lives in front-door.sh's self-test region, or beside a TypeScript port in
# front-door.test.ts; implementation mentions do not count.
self_hits=0
if grep -q -- '--- self-test' "$HERE/scripts/front-door.sh" 2>/dev/null; then
  self_hits=$(sed -n '/--- self-test/,$p' "$HERE/scripts/front-door.sh" | grep -ci 'headless')
fi
if [ -f "$HERE/scripts/front-door.test.ts" ]; then
  self_hits=$((self_hits + $(grep -ci 'headless' "$HERE/scripts/front-door.test.ts")))
fi
if [ "$self_hits" -ge 2 ] 2>/dev/null; then
  pass P6a-selftest-control "front-door self-test exercises headless ($self_hits mentions)"
else
  nope P6a-selftest-control "front-door self-test headless mentions: $self_hits (want >= 2)"
fi

# P6b: the decision script's self-test is green.
if bash "$HERE/scripts/front-door.sh" --self-test >"$tmp/fd-st.out" 2>&1; then
  pass P6b-selftest-green "front-door.sh --self-test exits 0"
else
  nope P6b-selftest-green "front-door.sh --self-test exits $(echo $?): $(tail -2 "$tmp/fd-st.out" | tr '\n' ';')"
fi

# P7 (AC6): the wiki's fixture-runs page says a fixture run's postmaster runs
# headless, and why trusting the fixtures folder never spared a copy.
wiki=$HERE/wiki/concepts/fixture-runs.md
headless_ok=no; grep -qi 'headless' "$wiki" && grep -qi 'postmaster' "$wiki" && headless_ok=yes
parent_ok=no; grep -qiE 'never spared|never covered|not spare|does not spare|stops at|git root' "$wiki" && parent_ok=yes
if [ "$headless_ok" = yes ] && [ "$parent_ok" = yes ]; then
  pass P7-wiki "page says the postmaster runs headless, and why the folder never spared a copy"
else
  nope P7-wiki "headless-postmaster=$headless_ok parent-why=$parent_ok"
fi

echo
[ "$fail" -eq 0 ] && { echo "oracle-98: all probes passed"; exit 0; }
echo "oracle-98: $fail probe(s) failed"; exit 1
