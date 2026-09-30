#!/usr/bin/env bash
# Oracle for #98: blind acceptance tests at the ticket's own interface.
#
# Written by the leg-1 coachman before reading any lane's spec or diff,
# committed as the first commit on the ticket branch. It drives the routes the
# ticket names (`fixture.sh new`, the trust form through `scripts/launch.sh`,
# the wiki page) and never a function shape, which the lanes chose.
#
#   oracle-98.sh   run from the repo root; exit 0 when the worktree meets the
#                  ticket, 1 otherwise, one line per probe.
#
# Assumptions, stated so a red probe can be blamed correctly:
# A1. `fixture.sh new` resolves "the harness that will run its postmaster"
#     from team.postmaster.harness in POSTMASTER_CONFIG, the machine config.
#     If both lanes fail P1 on this alone, the oracle is wrong, not the lanes.
# A2. Claude Code's global config is ~/.claude.json (JSON), saved under the
#     lock ~/.claude.json.lock, as the ticket's Notes describe.
#
# AC1's second half ("a postmaster started there does not stop at a trust
# prompt") has no headless probe: headless claude never asks, and an
# interactive postmaster needs a model. The ticket itself states the trust
# entry is what answering the prompt writes, so entry-present implies no
# prompt; synthesis records that implication on the checkpoint card.
# AC2's negative ("a harness that never asks has no form, and fixture.sh
# records nothing for it") has no generic probe: which harness never asks is a
# lane finding. It is verified at synthesis by reading plus targeted
# execution. P6 probes the positive half (a trust form exists and runs through
# launch.sh) at the level the ticket names.
set -uo pipefail

HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
[ -f "$HERE/scripts/host.sh" ] || { echo "oracle: run from the repo root: scripts/host.sh not found" >&2; exit 1; }
need() { for t in "$@"; do command -v "$t" >/dev/null 2>&1 || { echo "oracle: $t is not on PATH" >&2; exit 1; }; done; }
need git python3 flock
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
export HOME_REAL=$HOME
home=$tmp/home; runs=$tmp/runs; mkdir -p "$home" "$runs"
claude_json=$home/.claude.json

# The machine config the run reads: postmaster on claude (A1).
cat > "$tmp/config.toml" <<'EOF'
[team]
postmaster = { harness = "claude", model = "oracle-model" }
EOF

# A lived-in Claude config: another trusted project, another key, and a
# control folder the fixture never makes.
other_project=$tmp/control-dir; mkdir -p "$other_project"
parent_probe=$runs
python3 - "$claude_json" "$other_project" <<'PY'
import json, sys
path, other = sys.argv[1], sys.argv[2]
json.dump({"projects": {other: {"hasTrustDialogAccepted": True}},
           "theme": "dark", "tipsHistory": {"x": 1}}, open(path, "w"), indent=2)
PY
before_projects=$(python3 -c 'import json,sys; print("\n".join(sorted(json.load(open(sys.argv[1]))["projects"])))' "$claude_json")
before_rest=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); del d["projects"]; print(json.dumps(d,sort_keys=True))' "$claude_json")

# The real config, to prove the run never touched it (AC5: never the real one).
real_before=absent; [ -f "$HOME_REAL/.claude.json" ] && real_before=$(sha1sum < "$HOME_REAL/.claude.json")
real_lock_before=absent; [ -e "$HOME_REAL/.claude.json.lock" ] && real_lock_before=present

new() {  # new <dest-args...>: fixture.sh new under the scratch home and config
  HOME=$home POSTMASTER_CONFIG=$tmp/config.toml POSTMASTER_FIXTURES=$tmp/fixtures \
    bash "$HERE/scripts/fixture.sh" new "$@" >"$tmp/new.out" 2>"$tmp/new.err"; echo $? >"$tmp/new.rc"
}

# P1 (AC1): `fixture.sh new` records the new copy as trusted by claude.
dest=$runs/copy1
new "$dest" "$ticket"; rc=$(cat "$tmp/new.rc")
if [ "$rc" -ne 0 ]; then
  nope P1-recorded-trusted "fixture.sh new exited $rc: $(tail -2 "$tmp/new.err" | tr '\n' ' ')"
else
  trusted=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["projects"].get(sys.argv[2],{}).get("hasTrustDialogAccepted",False))' "$claude_json" "$dest" 2>/dev/null || echo ERROR)
  [ "$trusted" = True ] \
    && pass P1-recorded-trusted "$dest recorded with hasTrustDialogAccepted" \
    || nope P1-recorded-trusted "$dest not recorded as trusted (hasTrustDialogAccepted=$trusted)"
fi

# P2 (AC3): only the folder just made is trusted: never a path from anywhere
# else, and never a parent folder.
after_projects=$(python3 -c 'import json,sys; print("\n".join(sorted(json.load(open(sys.argv[1]))["projects"])))' "$claude_json" 2>/dev/null || echo ERROR)
added=$(comm -13 <(printf '%s\n' "$before_projects") <(printf '%s\n' "$after_projects") | paste -sd' ' -)
removed=$(comm -23 <(printf '%s\n' "$before_projects") <(printf '%s\n' "$after_projects") | paste -sd' ' -)
if [ "$added" = "$dest" ] && [ -z "$removed" ]; then
  pass P2-only-just-made "exactly one project added: the new copy"
else
  nope P2-only-just-made "added=[${added:-none}] removed=[${removed:-none}], want added=$dest removed=none"
fi
for p in "$parent_probe" "$other_project"; do
  if [ "$p" = "$dest" ]; then continue; fi
  if grep -qxF "$p" <(printf '%s\n' "$after_projects"); then
    [ "$p" = "$other_project" ] \
      && pass P2-control-kept "control folder entry kept as it was" \
      || nope P2-parent "parent folder $p was trusted"
  fi
done
grep -qxF "$parent_probe" <(printf '%s\n' "$after_projects") \
  && nope P2-parent "parent folder $parent_probe was trusted" \
  || pass P2-parent "parent folder left untouched"

# A bare name goes under POSTMASTER_FIXTURES; its parent is trusted no more.
new bare-copy "$ticket"; rc=$(cat "$tmp/new.rc")
bare=$tmp/fixtures/bare-copy
if [ "$rc" -ne 0 ]; then
  nope P2b-bare-parent "bare-name new exited $rc"
else
  bare_ok=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1]))["projects"]; print(d.get(sys.argv[2],{}).get("hasTrustDialogAccepted",False) and sys.argv[3] not in d)' "$claude_json" "$bare" "$tmp/fixtures" 2>/dev/null || echo ERROR)
  [ "$bare_ok" = True ] \
    && pass P2b-bare-parent "bare copy trusted, POSTMASTER_FIXTURES untouched" \
    || nope P2b-bare-parent "bare copy trust=$bare_ok"
fi

# P3 (AC4): every other key kept as it was, and the file still valid.
rest_now=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); del d["projects"]; print(json.dumps(d,sort_keys=True))' "$claude_json" 2>/dev/null || echo ERROR)
control_now=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["projects"].get(sys.argv[2],{}))' "$claude_json" "$other_project" 2>/dev/null || echo ERROR)
if [ "$rest_now" = "$before_rest" ] && [ "$control_now" = "{'hasTrustDialogAccepted': True}" ]; then
  pass P3-other-keys-kept "every other key and entry byte-equal, file parses"
else
  nope P3-other-keys-kept "non-project keys or the control entry changed"
fi

# P4 (AC4): the writer holds the lock Claude Code holds. While it is held
# elsewhere, a concurrent `new` neither finishes nor touches the config; once
# released, it completes and records the copy.
lock=$home/.claude.json.lock
: > "$lock"
flock "$lock" sleep 25 & holder=$!
sleep 1
if flock -n "$lock" true 2>/dev/null; then
  kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null
  nope P4-lock "probe engine failed: the held lock was acquirable"
else
  snap=$(sha1sum < "$claude_json")
  dest2=$runs/copy2
  ( new "$dest2" "$ticket" ) & worker=$!
  sleep 8
  if ! kill -0 "$worker" 2>/dev/null; then
    wait "$worker"; rc=$(cat "$tmp/new.rc")
    kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null
    nope P4-lock "new finished (exit $rc) while the lock was held: it does not wait on it"
  elif [ "$(sha1sum < "$claude_json")" != "$snap" ]; then
    kill "$holder" "$worker" 2>/dev/null; wait 2>/dev/null
    nope P4-lock "config changed while the lock was held: the writer skips it"
  else
    kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null
    deadline=$((SECONDS + 60))
    while kill -0 "$worker" 2>/dev/null && [ $SECONDS -lt $deadline ]; do sleep 1; done
    if kill -0 "$worker" 2>/dev/null; then
      kill "$worker" 2>/dev/null; wait 2>/dev/null
      nope P4-lock "new did not finish within 60s of the lock's release"
    else
      wait "$worker"; rc=$(cat "$tmp/new.rc")
      t2=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["projects"].get(sys.argv[2],{}).get("hasTrustDialogAccepted",False))' "$claude_json" "$dest2" 2>/dev/null || echo ERROR)
      if [ "$rc" -eq 0 ] && [ "$t2" = True ]; then
        pass P4-lock "waited on the lock, then recorded the copy"
      else
        nope P4-lock "after release: exit $rc, trusted=$t2"
      fi
    fi
  fi
fi

# P5 (AC1/AC4): with no config at all, `new` writes a valid one holding the copy.
mv "$claude_json" "$tmp/claude.json.saved"
dest3=$runs/copy3
new "$dest3" "$ticket"; rc=$(cat "$tmp/new.rc")
t3=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["projects"].get(sys.argv[2],{}).get("hasTrustDialogAccepted",False))' "$claude_json" "$dest3" 2>/dev/null || echo ERROR)
if [ "$rc" -eq 0 ] && [ "$t3" = True ]; then
  pass P5-creates-config "missing config created, valid, copy trusted"
else
  nope P5-creates-config "exit $rc, trusted=$t3"
fi

# P6 (AC2): the trust form is in harnesses.md and runs through launch.sh.
harness_hits=$(grep -ci "trust" "$HERE/skills/postmaster/harnesses.md")
launch_usage=$(bash "$HERE/scripts/launch.sh" 2>&1 || true)
if [ "$harness_hits" -ge 2 ] && grep -qi "trust" <<<"$launch_usage"; then
  pass P6-trust-form "harnesses.md documents trust ($harness_hits mentions), launch.sh exposes it"
else
  nope P6-trust-form "harnesses.md trust mentions=$harness_hits, launch.sh usage mentions trust: $(grep -qi trust <<<"$launch_usage" && echo yes || echo no)"
fi

# P7 (AC5): the self-test carries a trust control on a scratch config.
# (The gate runs the whole self-test per lane; this probes its presence.)
main_hits=$(sed -n '1,/--- self-test/p' "$HERE/scripts/fixture.sh" | grep -ci "trust")
self_hits=$(sed -n '/--- self-test/,$p' "$HERE/scripts/fixture.sh" | grep -ci "trust")
if [ "$main_hits" -ge 1 ] && [ "$self_hits" -ge 2 ]; then
  pass P7-selftest-control "fixture.sh trusts in main logic ($main_hits) and self-test ($self_hits)"
else
  nope P7-selftest-control "trust mentions: main=$main_hits self-test=$self_hits"
fi

# P8 (AC6): the wiki's fixture-runs page says copies are trusted when made,
# and why trusting the parent never covered them.
wiki=$HERE/wiki/concepts/fixture-runs.md
made_ok=no; grep -qi "trust" "$wiki" && grep -qiE "when (they|it) (are|is) made|trusted (when|as|at)|made .*trusted|trust.*(new|fresh|each) cop" "$wiki" && made_ok=yes
parent_ok=no; grep -qi "parent" "$wiki" && grep -qiE "git root|never covered|stops at|plain folder" "$wiki" && parent_ok=yes
if [ "$made_ok" = yes ] && [ "$parent_ok" = yes ]; then
  pass P8-wiki "page says copies are trusted when made, and why the parent never covered them"
else
  nope P8-wiki "trusted-when-made=$made_ok parent-why=$parent_ok"
fi

# P9 (AC5/AC3): the real config was never touched, and no lock escaped to it.
real_after=absent; [ -f "$HOME_REAL/.claude.json" ] && real_after=$(sha1sum < "$HOME_REAL/.claude.json")
real_lock_after=absent; [ -e "$HOME_REAL/.claude.json.lock" ] && real_lock_after=present
[ ! -e "$HOME_REAL/Code/fixtures" ] || fixture_dir_note=" (note: $HOME_REAL/Code/fixtures exists from other work, untouched by this probe)"
if [ "$real_after" = "$real_before" ] && [ "$real_lock_after" = "$real_lock_before" ]; then
  pass P9-real-untouched "real ~/.claude.json and lock byte-identical${fixture_dir_note:-}"
else
  nope P9-real-untouched "real config or lock changed"
fi

echo
[ "$fail" -eq 0 ] && { echo "oracle-98: all probes passed"; exit 0; }
echo "oracle-98: $fail probe(s) failed"; exit 1
