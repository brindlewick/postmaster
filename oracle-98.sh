#!/usr/bin/env bash
# Oracle for #98 (v2): blind acceptance tests at the ticket's own interface.
#
# v2, written after the user rewrote the ticket on 2026-09-30. The ticket is
# now "a fixture run's postmaster runs headless, so it never stops at a trust
# prompt": v1's trust-write and config-lock probes are superseded and gone.
# First written from the ticket text alone, before any lane code existed and
# before the approved spec was read; then corrected to the user-approved
# spec's output shape (a `headless` line beside `spawn`, `self` stays `self`)
# and mark mechanism (`postmaster.fixture` git config), still before any lane
# code exists. Both lanes implement that same spec, so the ranking stays fair.
#
#   oracle-98.sh   run from the repo root; exit 0 when the worktree meets the
#                  ticket, 1 otherwise, one line per probe.
#
# What has no generic probe here is verified at synthesis by reading plus
# targeted execution, and recorded on the checkpoint card:
# - AC2/AC5, byte-exactness ("exactly the output it gave before"): the oracle
#   proves the mark flips the decision both ways through the same command;
#   byte-equality with the pre-change output is the lanes' own self-test
#   control, read at synthesis.
# - AC2/AC3, "whatever/on every host": the oracle runs on this machine's host;
#   the decision script takes no host input by construction (read), and the
#   spec puts Herdr/tmux/none coverage in the lanes' own tests.
# - AC3, the brief's exact prose: the oracle proves the `headless` decision is
#   wired into SKILL.md and the reused hosts.md form exists; the prose is
#   read, not grepped.
# - AC7, a fixture run dispatched from this branch: needs models and hours, so no
#   per-lane probe. The spec says the postmaster runs it after the card.
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
decide_full() {  # decide_full <same args>: the whole decision output
  bash "$HERE/scripts/front-door.sh" "$1" "$2" "$3" "$4" "$5" --config "$tmp/config.toml" 2>"$tmp/decide.err"
}
headless_lines() {  # headless_lines: count of output lines whose first word is `headless`
  awk '$1=="headless"{n++} END{print n+0}'
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

# P1b (AC1): the mark reads back as the fixture ticket's name, and a
# repository `new` did not make carries no mark.
mark1=$(git -C "$copy1" config postmaster.fixture 2>/dev/null || echo ABSENT)
mark_plain=$(git -C "$plain" config postmaster.fixture 2>/dev/null || echo ABSENT)
if [ "$mark1" = "$ticket" ] && [ "$mark_plain" = ABSENT ]; then
  pass P1b-mark "mark reads back as '$ticket'; plain repo unmarked"
else
  nope P1b-mark "copy mark='$mark1' (want '$ticket'), plain mark='$mark_plain' (want ABSENT)"
fi

# P2 (AC2): when the decision is `spawn` and the target carries the mark, the
# front door also prints a `headless` line; `self` stays `self` with no
# `headless` line. Same command both ways; exits as before.
out_self=$(decide_full claude pm-model "$copy1" yes "$copy1"); rc_self=$?
out_spawn=$(decide_full other-harness other-model "$plain" no "$copy1"); rc_spawn=$?
self_word=$(head -1 <<<"$out_self" | awk '{print $1}'); self_word=${self_word:-EMPTY}
spawn_word=$(head -1 <<<"$out_spawn" | awk '{print $1}'); spawn_word=${spawn_word:-EMPTY}
self_hl=$(headless_lines <<<"$out_self"); spawn_hl=$(headless_lines <<<"$out_spawn")
if [ "$self_word" = self ] && [ "$self_hl" = 0 ] && [ "$rc_self" = 0 ] \
   && [ "$spawn_word" = spawn ] && [ "$spawn_hl" -ge 1 ] && [ "$rc_spawn" = 0 ]; then
  pass P2-headless "self stays self without headless; spawn gains a headless line"
else
  nope P2-headless "self-case: '$self_word' exit $rc_self headless-lines $self_hl; spawn-case: '$spawn_word' exit $rc_spawn headless-lines $spawn_hl"
fi

# P2b (AC2/AC5): the same copy with its mark removed decides as a copy without
# one: `spawn`, no `headless` line. The negative half of the P2 pair: it passes
# pre-change too, and means something only beside P2's flip.
git -C "$copy1" config --unset postmaster.fixture 2>/dev/null || true
out_unmarked=$(decide_full other-harness other-model "$plain" no "$copy1"); rc_unmarked=$?
unmarked_word=$(head -1 <<<"$out_unmarked" | awk '{print $1}'); unmarked_word=${unmarked_word:-EMPTY}
unmarked_hl=$(headless_lines <<<"$out_unmarked")
if [ "$unmarked_word" = spawn ] && [ "$unmarked_hl" = 0 ] && [ "$rc_unmarked" = 0 ]; then
  pass P2b-unmarked "mark removed: spawn, no headless line"
else
  nope P2b-unmarked "mark removed: '$unmarked_word' exit $rc_unmarked headless-lines $unmarked_hl"
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
