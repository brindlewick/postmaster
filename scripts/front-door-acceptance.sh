#!/usr/bin/env bash
# Acceptance oracle for the entry flow: nothing in AGENTS.md, SKILL.md, postmaster.md or
# README.md still says the front door never runs the stream. The session the user opened
# carries on as the postmaster when it can; a separate postmaster is spawned only when
# the harness or model differs, the target is another repo, or nobody is at the terminal.
# Seven checks name one stale sentence each from before that change, matched verbatim after
# newlines are folded, so a reflow alone does not pass; four more match the claim itself,
# `never runs the stream`, in every file, so a new sentence saying it trips the same guard.
# Any conditional rewrite breaks every match.
#
#   front-door-acceptance.sh [repo-root]   default: the repo this script lives in
#   front-door-acceptance.sh --self-test   prove each check fails on its own fault alone,
#                                          a clean tree passes, and the live tree passes
#
#   exit 0  no stale claim remains
#   exit 1  stale claims, one per line on stdout: <file>: <what is still claimed>
#   exit 2  usage, or a file that cannot be read
#
# The self-test fails on a tree that still carries the old claims, at its live-tree step;
# that failure is the control proving the checks bite on the real files, not only fixtures.
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
ROOT=$(dirname "$HERE")

flat() { tr '\n\t' '  ' < "$1" | sed 's/  */ /g'; }   # fold newlines so a reflow alone never passes

# stale <flat-text> <file> <label> <sentence...>: fault when the sentence is still claimed
fails=0
stale() {
  local text=$1 file=$2 label=$3; shift 3
  if printf '%s' "$text" | grep -q -F -- "$*"; then
    printf '%s: still says %s\n' "$file" "$label"
    fails=$((fails + 1))
  fi
}

accept() {  # accept <root>: the checks; stdout the faults, exit 0/1/2
  local root=$1 f
  for f in AGENTS.md skills/postmaster/SKILL.md skills/postmaster/postmaster.md README.md; do
    [ -r "$root/$f" ] || { echo "front-door-acceptance: cannot read $root/$f" >&2; return 2; }
  done
  fails=0
  local skill post agents readme
  skill=$(flat "$root/skills/postmaster/SKILL.md") || return 2
  post=$(flat "$root/skills/postmaster/postmaster.md") || return 2
  agents=$(flat "$root/AGENTS.md") || return 2
  readme=$(flat "$root/README.md") || return 2
  stale "$skill" skills/postmaster/SKILL.md 'the front door never runs the stream itself' \
    'You do not run the stream yourself'
  stale "$skill" skills/postmaster/SKILL.md 'the spawned session does that instead' \
    'the session you spawn does that'
  stale "$skill" skills/postmaster/SKILL.md 'spawn, hand over and stop is the only flow' \
    'confirm a launch card, spawn a postmaster session, hand over, report where to watch it, and stop'
  stale "$skill" skills/postmaster/SKILL.md 'bootstrap never runs the stream' \
    'Bootstrap never runs the stream. Spawn and stop.'
  stale "$post" skills/postmaster/postmaster.md 'the bootstrap always spawned it' \
    'The bootstrap (`SKILL.md`) spawned you with a brief: the stream in one paragraph, the project profile, the absolute path of the postmaster tool (`<tool>`), and the config.'
  stale "$agents" AGENTS.md 'the postmaster is spawned by SKILL.md' \
    '(spawned by `SKILL.md`)'
  stale "$agents" AGENTS.md 'the front door only spawns a postmaster' \
    'spawns a postmaster; `postmaster.md` is what that postmaster then does'
  # The claim itself, in every file: a new sentence saying it trips the same guard.
  stale "$skill" skills/postmaster/SKILL.md 'the front door never runs the stream' \
    'never runs the stream'
  stale "$post" skills/postmaster/postmaster.md 'the front door never runs the stream' \
    'never runs the stream'
  stale "$agents" AGENTS.md 'the front door never runs the stream' \
    'never runs the stream'
  stale "$readme" README.md 'the front door never runs the stream' \
    'never runs the stream'
  [ "$fails" -eq 0 ]
}

case ${1:-} in
  --self-test) ;;
  -*) echo "usage: front-door-acceptance.sh [repo-root] | --self-test" >&2; exit 2 ;;
  "") accept "$ROOT"; exit $? ;;
  *) accept "$1"; exit $? ;;
esac

# --- self-test ----------------------------------------------------------------------------
tmp=$(mktemp -d) || exit 2
trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
fails=0
has() {  # has <name> <output> <line>
  printf '%s\n' "$2" | grep -qxF -- "$3" && printf '  ok   %s\n' "$1" \
    || { printf '  FAIL %s: no line "%s" in:\n%s\n' "$1" "$3" "$2"; fails=$((fails + 1)); }
}

mkdir -p "$tmp/stale/skills/postmaster" "$tmp/clean/skills/postmaster"
cat > "$tmp/stale/skills/postmaster/SKILL.md" <<'EOF'
You get the machine ready if it is not, choose a target, confirm a launch card, spawn a
postmaster session, hand over, report where to watch it, and stop. **You do not run the
stream yourself**; the session you spawn does that, from `postmaster.md` beside this file.
EOF
printf '%s\n' '- Bootstrap never runs the stream. Spawn and stop. The postmaster runs the tickets.' \
  >> "$tmp/stale/skills/postmaster/SKILL.md"
cat > "$tmp/stale/skills/postmaster/postmaster.md" <<'EOF'
**You are the POSTMASTER for one project.** The bootstrap (`SKILL.md`) spawned you with a
brief: the stream in one paragraph, the project profile, the absolute path of the postmaster
tool (`<tool>`), and the config. You turn the stream into tickets.
EOF
cat > "$tmp/stale/AGENTS.md" <<'EOF'
| **postmaster** | decomposes a stream into tickets | `skills/postmaster/postmaster.md` (spawned by `SKILL.md`) |
`SKILL.md` is the front door: it gets the machine ready if it is not and
spawns a postmaster; `postmaster.md` is what that postmaster then does.
EOF
printf '%s\n' 'The front door never runs the stream; it spawns.' > "$tmp/stale/README.md"
printf '%s\n' 'The front door never runs the stream.' >> "$tmp/stale/skills/postmaster/postmaster.md"
printf '%s\n' 'The front door never runs the stream.' >> "$tmp/stale/AGENTS.md"

cat > "$tmp/clean/skills/postmaster/SKILL.md" <<'EOF'
You get the machine ready if it is not, choose a target, and confirm a launch card. The
card says whether this session carries on as the postmaster or a new session is started,
and why. When this session is the postmaster it reads `postmaster.md` beside this file
and runs the stream; otherwise it starts that session, hands over, and stops.
EOF
printf '%s\n' '- Bootstrap runs the stream itself when it can. Spawn and stop only when it must.' \
  >> "$tmp/clean/skills/postmaster/SKILL.md"
cat > "$tmp/clean/skills/postmaster/postmaster.md" <<'EOF'
**You are the POSTMASTER for one project.** Either the bootstrap (`SKILL.md`) started you
with a brief, or you are the front-door session carrying on with what you settled: the
stream in one paragraph, the project profile, the tool path, and the config.
EOF
cat > "$tmp/clean/AGENTS.md" <<'EOF'
| **postmaster** | decomposes a stream into tickets | `skills/postmaster/postmaster.md` (the front door, or started by it) |
`SKILL.md` is the front door: it gets the machine ready if it is not, then either runs
the stream itself or starts a postmaster; `postmaster.md` is what the postmaster then does.
EOF
printf '%s\n' 'The front door runs the stream when it can; else it starts a postmaster.' \
  > "$tmp/clean/README.md"

alone() {  # alone <name> <file> <want-line> <fault...>: the check fires on its fault alone
  local name=$1 file=$2 want=$3 out rc; shift 3
  rm -rf "$tmp/one" && cp -r "$tmp/clean" "$tmp/one"
  printf '%s\n' "$*" >> "$tmp/one/$file"
  out=$(accept "$tmp/one"); rc=$?
  [ "$rc" -eq 1 ] && [ "$out" = "$want" ] && printf '  ok   %s\n' "$name" \
    || { printf '  FAIL %s: exit %s with:\n%s\n' "$name" "$rc" "$out"; fails=$((fails + 1)); }
}

echo "each check fires on its own fault alone"
alone 'SKILL itself' skills/postmaster/SKILL.md \
  'skills/postmaster/SKILL.md: still says the front door never runs the stream itself' \
  'You do not run the stream yourself.'
alone 'SKILL spawn-does-it' skills/postmaster/SKILL.md \
  'skills/postmaster/SKILL.md: still says the spawned session does that instead' \
  ' carry on; the session you spawn does that.'
alone 'SKILL only-flow' skills/postmaster/SKILL.md \
  'skills/postmaster/SKILL.md: still says spawn, hand over and stop is the only flow' \
  'you confirm a launch card, spawn a postmaster session, hand over, report where to watch it, and stop.'
alone 'postmaster spawned' skills/postmaster/postmaster.md \
  'skills/postmaster/postmaster.md: still says the bootstrap always spawned it' \
  'The bootstrap (`SKILL.md`) spawned you with a brief: the stream in one paragraph, the project profile, the absolute path of the postmaster tool (`<tool>`), and the config.'
alone 'AGENTS table' AGENTS.md \
  'AGENTS.md: still says the postmaster is spawned by SKILL.md' \
  'See `skills/postmaster/postmaster.md` (spawned by `SKILL.md`).'
alone 'AGENTS door' AGENTS.md \
  'AGENTS.md: still says the front door only spawns a postmaster' \
  'It spawns a postmaster; `postmaster.md` is what that postmaster then does.'
alone 'SKILL general claim' skills/postmaster/SKILL.md \
  'skills/postmaster/SKILL.md: still says the front door never runs the stream' \
  'The front door never runs the stream.'
alone 'postmaster general claim' skills/postmaster/postmaster.md \
  'skills/postmaster/postmaster.md: still says the front door never runs the stream' \
  'The front door never runs the stream.'
alone 'AGENTS general claim' AGENTS.md \
  'AGENTS.md: still says the front door never runs the stream' \
  'The front door never runs the stream.'
alone 'README general claim' README.md \
  'README.md: still says the front door never runs the stream' \
  'The front door never runs the stream.'
# The bootstrap sentence carries the general claim inside it, so its fault fires two checks.
rm -rf "$tmp/one" && cp -r "$tmp/clean" "$tmp/one"
printf '%s\n' '- Bootstrap never runs the stream. Spawn and stop.' >> "$tmp/one/skills/postmaster/SKILL.md"
out=$(accept "$tmp/one"); rc=$?
[ "$rc" -eq 1 ] && [ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" -eq 2 ] \
  && printf '%s\n' "$out" | grep -qxF 'skills/postmaster/SKILL.md: still says bootstrap never runs the stream' \
  && printf '%s\n' "$out" | grep -qxF 'skills/postmaster/SKILL.md: still says the front door never runs the stream' \
  && printf '  ok   SKILL bootstrap fires its check and the general one\n' \
  || { printf '  FAIL SKILL bootstrap fires its check and the general one: exit %s with:\n%s\n' "$rc" "$out"; fails=$((fails + 1)); }

echo "all faults together"
out=$(accept "$tmp/stale"); rc=$?
[ "$rc" -eq 1 ] && printf '  ok   stale tree exits 1\n' \
  || { printf '  FAIL stale tree exits %s, want 1\n' "$rc"; fails=$((fails + 1)); }
[ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" -eq 11 ] && printf '  ok   stale tree lists 11 faults\n' \
  || { printf '  FAIL stale tree lists:\n%s\n' "$out"; fails=$((fails + 1)); }
has 'stale SKILL itself' "$out" 'skills/postmaster/SKILL.md: still says the front door never runs the stream itself'
has 'stale SKILL spawn-does-it' "$out" 'skills/postmaster/SKILL.md: still says the spawned session does that instead'
has 'stale SKILL only-flow' "$out" 'skills/postmaster/SKILL.md: still says spawn, hand over and stop is the only flow'
has 'stale SKILL bootstrap' "$out" 'skills/postmaster/SKILL.md: still says bootstrap never runs the stream'
has 'stale postmaster spawned' "$out" 'skills/postmaster/postmaster.md: still says the bootstrap always spawned it'
has 'stale AGENTS table' "$out" 'AGENTS.md: still says the postmaster is spawned by SKILL.md'
has 'stale AGENTS door' "$out" 'AGENTS.md: still says the front door only spawns a postmaster'
has 'stale SKILL general' "$out" 'skills/postmaster/SKILL.md: still says the front door never runs the stream'
has 'stale postmaster general' "$out" 'skills/postmaster/postmaster.md: still says the front door never runs the stream'
has 'stale AGENTS general' "$out" 'AGENTS.md: still says the front door never runs the stream'
has 'stale README' "$out" 'README.md: still says the front door never runs the stream'

out=$(accept "$tmp/clean"); rc=$?
[ "$rc" -eq 0 ] && [ -z "$out" ] && printf '  ok   clean tree passes\n' \
  || { printf '  FAIL clean tree exits %s with:\n%s\n' "$rc" "$out"; fails=$((fails + 1)); }

out=$(accept "$tmp/nowhere" 2>&1); rc=$?
[ "$rc" -eq 2 ] && printf '  ok   missing tree exits 2\n' \
  || { printf '  FAIL missing tree exits %s\n' "$rc"; fails=$((fails + 1)); }

rm -rf "$tmp/locked" && cp -r "$tmp/clean" "$tmp/locked" && chmod 000 "$tmp/locked/skills/postmaster/SKILL.md"
out=$(accept "$tmp/locked" 2>&1); rc=$?
chmod 644 "$tmp/locked/skills/postmaster/SKILL.md"
[ "$rc" -eq 2 ] && printf '  ok   an unreadable file exits 2, not a clean result\n' \
  || { printf '  FAIL an unreadable file exits %s with:\n%s\n' "$rc" "$out"; fails=$((fails + 1)); }

out=$(accept "$ROOT"); rc=$?
[ "$rc" -eq 0 ] && printf '  ok   live tree passes\n' \
  || { printf '  LIVE tree still carries stale claims (expected before the fix):\n%s\n' "$out"; fails=$((fails + 1)); }

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
