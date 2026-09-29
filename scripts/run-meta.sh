#!/usr/bin/env bash
# Write a run's fixed facts to <dispatch>/run.json, once, at dispatch, and pin the run to the
# postmaster commit it was dispatched from. Written once and never edited: the manifest is the
# run's current state, this is what the run started from and the checkout it runs on.
#
#   run-meta.sh <dispatch> <repo>   <repo> is the target project's checkout; also cuts the pin
#   run-meta.sh pin <repo> <commit> a shared checkout of <repo> at <commit> under $POSTMASTER_TOOL_PINS
#   run-meta.sh path <dispatch>     print the canonical path of the run's tool checkout
#   run-meta.sh check <dispatch>    the run's checkout still serves its dispatch commit
#   run-meta.sh release <dispatch>  drop this run's claim; remove the pin when no run is in flight
#   run-meta.sh --self-test
#
# Records when it was written; the run and project; the target repo's HEAD and branch; the
# postmaster commit that dispatched it, and whether that checkout had uncommitted changes,
# since a run keeps the runbooks it started with; the pinned checkout of that commit, which
# every leg launch, resume and takeover runs from (the waybill's `tool:`); the config in force,
# as it was; and the version each harness named in that config reports. Env files are named by
# the config, never read. A run.json that already exists is left alone.
#
# The pin is a detached worktree of the postmaster repo at the dispatch commit, under
# $POSTMASTER_TOOL_PINS (default ~/.postmaster/tool-pins), one directory per commit so every
# run dispatched at that commit shares it. It is the run's `<tool>`: its host.sh, its launch.sh
# and the runbooks its prompts name. The live checkout still serves the front door and the
# postmaster's own supervision. A bare `pin` holds no claim: only a run.json recording the
# checkout keeps release from removing it.
#
# check is the control that a run still runs on its own versions after main has moved on: it
# reads the pin's HEAD and tree against the commit run.json records. release removes the pin
# only when no run whose run.json names it is still in flight (manifest stage other than done
# or abandoned, a record that cannot be read counting as in flight). Dispatch holds one lock
# across its pin and run.json write and release across its scan and removal, so the two
# serialize; release force-removes an unreferenced pin that is not clean, and leaves a locked
# one alone. The scan covers the runs root the dispatch sits under, at
# <runs>/<project>/<ticket>, and runs it cannot list keep the pin. The postmaster releases
# after it closes or abandons a run, never
# before the last leg's process has exited. A run with no checkout recorded (an old unpinned
# waybill) resolves to the tool path its waybill already names; check asks only that it is a
# git checkout, and release leaves it alone.
#
#   exit 0  written, already there, a pin made or reused, path printed, the pin still serves
#           its commit, or the pin was released or kept as the in-flight runs require
#   exit 1  usage, no such dispatch directory or repo or commit, no config, the file could not
#           be written, the pin lock could not be taken, no pin or it does not serve its
#           commit, or git could not make or remove it
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
TOOL=$(dirname "$HERE")
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}
TOOLS=${POSTMASTER_TOOL_PINS:-$HOME/.postmaster/tool-pins}

pin_inner() {  # pin_inner <repo> <commit> <dest>: cut or reuse the pin; the caller holds $TOOLS/.pin.lock
  local repo=$1 commit=$2 dest=$3 at dirty
  if [ -e "$dest" ]; then
    at=$(git -C "$dest" rev-parse --verify -q HEAD 2>/dev/null) \
      || { echo "run-meta: $dest exists but is not a git checkout; left alone" >&2; return 1; }
    [ "$at" = "$commit" ] \
      || { echo "run-meta: $dest is at ${at:0:12}, not ${commit:0:12}; left alone" >&2; exit 1; }
    # The same commit is the same content, whatever repo cut it, so any checkout at the
    # commit is shared; but it must be clean, or it does not serve that commit's versions.
    dirty=$(git -C "$dest" status --porcelain 2>/dev/null) \
      || { echo "run-meta: could not read $dest" >&2; return 1; }
    [ -z "$dirty" ] \
      || { echo "run-meta: $dest is not clean at ${commit:0:12}; clean it or remove it with 'git worktree remove --force' and dispatch again" >&2; return 1; }
    printf '%s\n' "$dest"
    return 0
  fi
  git -C "$repo" worktree add --detach "$dest" "$commit" >/dev/null 2>&1 \
    || { echo "run-meta: git could not create $dest at $commit" >&2; return 1; }
  printf '%s\n' "$dest"
}

pin() {  # pin <repo> <commit>: a checkout of <repo> at <commit> under $TOOLS, shared per commit
  local repo=$1 want=$2 commit dest
  commit=$(git -C "$repo" rev-parse --verify -q "$want^{commit}") \
    || { echo "run-meta: no such commit in $repo: $want" >&2; return 1; }
  dest="$TOOLS/$commit"
  mkdir -p "$TOOLS" || { echo "run-meta: could not make $TOOLS" >&2; return 1; }
  # One lock around cutting, recording and removing pins: dispatch takes it across its pin
  # and run.json write and release across its scan and removal, so a pin is never removed
  # between the two. git worktree add locks the repo besides, so concurrent cuts take turns.
  (
    exec 9>"$TOOLS/.pin.lock" && flock 9 || { echo "run-meta: could not lock $TOOLS" >&2; exit 1; }
    pin_inner "$repo" "$commit" "$dest"
  )
}

field() {  # field <run.json> <key>  the postmaster.<key> of a run.json
  python3 -c 'import json,sys; r=json.load(open(sys.argv[1])).get("postmaster") or {}; print(r.get(sys.argv[2]) or "")' \
    "$1" "$2" 2>/dev/null
}

claim() {  # claim <run.json>: `checkout:<path>` when the run names a checkout, `no` when
           # its postmaster record names none, `unknown` when the record cannot be read at all;
           # the scan fails closed on unknown
  python3 -c '
import json, sys
try:
    r = json.load(open(sys.argv[1]))
except Exception:
    print("unknown"); raise SystemExit(0)
if not isinstance(r, dict) or not isinstance(r.get("postmaster"), dict):
    print("unknown")
else:
    co = r["postmaster"].get("checkout")
    if co is None or co == "":
        print("no")
    elif not isinstance(co, str):
        print("unknown")
    else:
        print("checkout:" + co)
' "$1" 2>/dev/null || echo unknown
}

canon() {  # canon <dir>: its absolute physical path, or nothing
  CDPATH= cd -P -- "$1" 2>/dev/null && pwd -P
}

path_of() {  # path_of <dispatch>: the run's tool checkout, canonical; the waybill's for an old run
  local d=$1 checkout tool section c
  [ -f "$d/run.json" ] || { echo "run-meta: no run.json in $d" >&2; return 1; }
  c=$(claim "$d/run.json")
  case $c in
    unknown|"") echo "run-meta: $d/run.json records an unreadable checkout" >&2; return 1 ;;
    checkout:*) checkout=${c#checkout:} ;;
    no)
      # An old unpinned waybill keeps the tool path it already names. The ticket travels in
      # the waybill verbatim and may show a tool: line of its own, so only the Dispatch
      # section counts; a waybill without one reads whole, as before.
      [ -f "$d/brief.md" ] || { echo "run-meta: $d/run.json records no checkout and there is no waybill" >&2; return 1; }
      section=$(awk '/^## Dispatch/{buf="";f=1;next} f&&/^## /{f=0} f{buf=buf $0 "\n"} END{printf "%s", buf}' "$d/brief.md")
      [ -n "$section" ] || section=$(cat "$d/brief.md")
      tool=$(printf '%s' "$section" | grep -E '^tool:[[:space:]]*\S' | sed 's/^tool:[[:space:]]*//;s/[[:space:]]*$//')
      [ -n "$tool" ] && [ "$(printf '%s\n' "$tool" | wc -l | tr -d ' ')" -eq 1 ] \
        || { echo "run-meta: the waybill must name exactly one tool: path" >&2; return 1; }
      checkout=$tool ;;
  esac
  checkout=$(canon "$checkout") \
    || { echo "run-meta: no checkout at $checkout" >&2; return 1; }
  printf '%s\n' "$checkout"
}

check_pin() {  # check_pin <dispatch>: the run's checkout still serves its dispatch commit
  local d=$1 checkout commit at dirty c
  checkout=$(path_of "$d") || return 1
  c=$(claim "$d/run.json")
  case $c in
    unknown|"") echo "run-meta: $d/run.json records an unreadable checkout" >&2; return 1 ;;
    no)
      # An old unpinned waybill: the path only has to be a git checkout.
      git -C "$checkout" rev-parse --git-dir >/dev/null 2>&1 \
        || { echo "run-meta: $checkout is not a git checkout" >&2; return 1; }
      return 0 ;;
  esac
  commit=$(field "$d/run.json" commit) || return 1
  [ -n "$commit" ] || { echo "run-meta: $d/run.json records no postmaster commit" >&2; return 1; }
  [ -d "$checkout" ] || { echo "run-meta: no pinned checkout at $checkout" >&2; return 1; }
  at=$(git -C "$checkout" rev-parse --verify -q HEAD 2>/dev/null) \
    || { echo "run-meta: $checkout is not a git checkout" >&2; return 1; }
  [ "$at" = "$commit" ] \
    || { echo "run-meta: $checkout is at ${at:0:12}, not the recorded ${commit:0:12}" >&2; return 1; }
  dirty=$(git -C "$checkout" status --porcelain 2>/dev/null) \
    || { echo "run-meta: could not read $checkout" >&2; return 1; }
  [ -z "$dirty" ] \
    || { echo "run-meta: $checkout is not clean at ${commit:0:12}; it does not serve that commit's versions" >&2; return 1; }
  return 0
}

in_flight() {  # in_flight <runs-root> <checkout>: yes when some run still uses this pin
  local root=$1 checkout=$2 p d stage got c found=1 hidden=""
  (
    # The scan owns its shell: every glob-affecting state is set explicitly here, and
    # nothing is saved or restored, so no ambient shell state can reach the enumeration.
    # dotglob on: a project is any repo basename, dot-prefixed included.
    # nullglob on: an unmatched glob expands to nothing; no name ends the scan.
    # globskipdots on: defensive; only .* patterns can yield . and .., and the scan
    # uses none, but every glob-affecting state is explicit here regardless.
    # globasciiranges on: ranges match ASCII whatever the locale (the bash 5.2 default).
    # failglob, extglob, nocaseglob, globstar off: the scan uses no failing, extended,
    # case-folded or ** match; each stays at what the scan needs.
    # nocasematch off: the claim and stage dispatch below matches exactly.
    unset GLOBIGNORE  # ambient ignores must not hide runs from the scan
    shopt -s dotglob nullglob globskipdots globasciiranges
    shopt -u failglob extglob nocaseglob globstar nocasematch
    # Two loops so an unreadable level is seen: one flat glob drops its branch silently.
    if [ ! -r "$root" ] || [ ! -x "$root" ]; then hidden=$root; fi
    for p in "$root"/*/; do
      if [ ! -r "$p" ] || [ ! -x "$p" ]; then hidden=$p; break; fi  # an unreadable project hides runs; keep
      for d in "$p"*/; do
        if [ ! -r "$d" ] || [ ! -x "$d" ]; then hidden=$d; break 2; fi  # an unreadable run hides; keep
        [ -f "$d/run.json" ] || continue
        c=$(claim "$d/run.json")
        case $c in
          unknown|"") found=0; break 2 ;;   # a record that cannot be read keeps the pin
          no) continue ;;
          checkout:*) got=${c#checkout:} ;;
        esac
        if [ "$got" != "$checkout" ]; then
          # The same checkout recorded through a symlink spells differently; a path that
          # resolves nowhere cannot be this pin, which exists.
          got=$(canon "$got") || continue
          [ "$got" = "$checkout" ] || continue
        fi
        stage=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("stage") or "")' \
          "$d/manifest.json" 2>/dev/null) || stage=""
        case $stage in
          done|abandoned) ;;
          *) found=0; break 2 ;;
        esac
      done
    done
    if [ -n "$hidden" ]; then
      echo "run-meta: cannot list $hidden; keeping $checkout" >&2
      exit 0
    fi
    exit $found
  )
}

worktree_locked() {  # worktree_locked <common-dir> <checkout>: yes when an admin locked this pin
  [ -f "$1/worktrees/$(basename "$2")/locked" ] && return 0
  git --git-dir="$1" worktree list --porcelain 2>/dev/null | awk -v c="$2" '
    /^worktree /{w=substr($0,10)} w==c && /^locked/{f=1} END{exit !f}'
}

release_pin() {  # release_pin <dispatch>: remove the pin when no run in flight uses it
  local d=$1 checkout root common tools dirty c
  [ -f "$d/run.json" ] || { echo "run-meta: no run.json in $d" >&2; return 1; }
  c=$(claim "$d/run.json")
  case $c in
    unknown|"") echo "run-meta: $d/run.json records an unreadable checkout; left alone" >&2; return 1 ;;
    no) echo "run-meta: $d/run.json records no pinned checkout; nothing to release"; return 0 ;;
    checkout:*) checkout=${c#checkout:} ;;
  esac
  [ -d "$checkout" ] || { echo "run-meta: no pinned checkout at $checkout; nothing to release"; return 0; }
  checkout=$(canon "$checkout") || { echo "run-meta: no pinned checkout at $checkout; nothing to release"; return 0; }
  tools=$(CDPATH= cd -P -- "$TOOLS" 2>/dev/null && pwd -P) || tools="$TOOLS"
  case $checkout in
    "$tools"/*) ;;
    *) echo "run-meta: $checkout is not a pin under $TOOLS; left alone"; return 1 ;;
  esac
  root=$(CDPATH= cd -P -- "$d/../.." 2>/dev/null && pwd -P) \
    || { echo "run-meta: could not determine the runs root for $d; left alone" >&2; return 1; }
  # The scan and the removal hold one lock, which dispatch takes across its pin and run.json
  # write: a release either sees a dispatch's record and keeps the pin, or removes wholly
  # before the dispatch cuts. Every check below re-runs under the lock, so two releases at
  # once serialize and the loser finds the pin already gone.
  (
    exec 9>"$TOOLS/.pin.lock" && flock 9 || { echo "run-meta: could not lock $TOOLS" >&2; exit 1; }
    if in_flight "$root" "$checkout"; then
      echo "run-meta: kept $checkout; another run in flight still uses it"
      exit 0
    fi
    [ -e "$checkout" ] || { echo "run-meta: $checkout was already removed"; exit 0; }
    common=$(git -C "$checkout" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) \
      || { echo "run-meta: $checkout is not a git checkout; left alone" >&2; exit 1; }
    if git --git-dir="$common" worktree remove "$checkout" >/dev/null 2>&1; then
      echo "run-meta: removed $checkout"
      exit 0
    fi
    [ -e "$checkout" ] || { echo "run-meta: $checkout was already removed"; exit 0; }
    if worktree_locked "$common" "$checkout"; then
      echo "run-meta: $checkout is locked; left alone" >&2; exit 1
    fi
    dirty=$(git -C "$checkout" status --porcelain 2>/dev/null) || dirty="?"
    if [ -n "$dirty" ] && git --git-dir="$common" worktree remove --force "$checkout" >/dev/null 2>&1; then
      echo "run-meta: removed $checkout, which was not clean"
      exit 0
    fi
    if [ -n "$dirty" ]; then
      echo "run-meta: git could not remove $checkout even with --force" >&2; exit 1
    fi
    echo "run-meta: git could not remove $checkout" >&2; exit 1
  )
}

meta() {  # meta <dispatch> <repo>
  local d=$1 repo=$2 commit checkout
  [ -d "$d" ] || { echo "run-meta: no such dispatch directory: $d" >&2; return 1; }
  git -C "$repo" rev-parse --git-dir >/dev/null 2>&1 || { echo "run-meta: not a git repo: $repo" >&2; return 1; }
  [ -f "$CONFIG" ] || { echo "run-meta: no config at $CONFIG" >&2; return 1; }
  [ -e "$d/run.json" ] && { echo "run-meta: $d/run.json already written; left alone"; return 0; }
  commit=$(git -C "$TOOL" rev-parse HEAD) || { echo "run-meta: no commit in $TOOL" >&2; return 1; }
  mkdir -p "$TOOLS" || { echo "run-meta: could not make $TOOLS" >&2; return 1; }
  # The pin and the run.json that records it are cut under one lock, which release takes
  # across its scan and removal: a dispatch either lands wholly before a release's scan and
  # is kept, or cuts wholly after its removal.
  (
    exec 9>"$TOOLS/.pin.lock" && flock 9 || { echo "run-meta: could not lock $TOOLS" >&2; exit 1; }
    [ -e "$d/run.json" ] && { echo "run-meta: $d/run.json already written; left alone"; exit 0; }
    checkout=$(pin_inner "$TOOL" "$commit" "$TOOLS/$commit") || exit 1
    python3 - "$d" "$repo" "$TOOL" "$CONFIG" "$checkout" "$commit" <<'PY' || { echo "run-meta: could not write $d/run.json" >&2; exit 1; }
import datetime as dt, json, os, pathlib, shutil, subprocess, sys, tempfile, tomllib
d, repo, tool, config, checkout = map(pathlib.Path, sys.argv[1:6])
pinned_commit = sys.argv[6]

def git(where, *args):
    r = subprocess.run(["git", "-C", str(where), *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None

def version(harness):
    if not shutil.which(harness):
        return "not on PATH"
    try:
        r = subprocess.run([harness, "--version"], capture_output=True, text=True, timeout=15)
        out = (r.stdout or r.stderr).strip().splitlines()
        return out[0] if out else "no version output"
    except (subprocess.TimeoutExpired, OSError) as e:
        return "no version: %s" % type(e).__name__

cfg = tomllib.load(open(config, "rb"))
harnesses = set()
for lane in (cfg.get("lanes") or {}).values():
    if lane.get("harness"): harnesses.add(lane["harness"])
team = cfg.get("team") or {}
for role in ("coachman", "coachman_fallback", "postmaster"):
    if isinstance(team.get(role), dict) and team[role].get("harness"): harnesses.add(team[role]["harness"])
for leg in (team.get("coachman_legs") or {}).values():
    if isinstance(leg, dict) and leg.get("harness"): harnesses.add(leg["harness"])

record = {
    "written": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "project": d.resolve().parent.name,
    "run": d.resolve().name,
    "target": {"head": git(repo, "rev-parse", "HEAD"), "branch": git(repo, "symbolic-ref", "--short", "-q", "HEAD")},
    "postmaster": {"commit": pinned_commit,
                   "uncommitted_changes": bool(git(tool, "status", "--porcelain")),
                   "checkout": str(checkout)},
    "config": cfg,
    "harness_versions": {h: version(h) for h in sorted(harnesses)},
}
fd, tmp = tempfile.mkstemp(dir=d); os.close(fd)
with open(tmp, "w") as f:
    json.dump(record, f, indent=2, default=str); f.write("\n")
os.replace(tmp, d / "run.json")
print("run-meta: wrote %s (postmaster %s, pinned at %s)" % (d / "run.json", (record["postmaster"]["commit"] or "?")[:12], checkout))
PY
  )
}

usage() { echo "usage: run-meta.sh <dispatch> <repo> | pin <repo> <commit> | path <dispatch> | check <dispatch> | release <dispatch> | --self-test" >&2; exit 1; }
case "${1:-}" in
  --self-test) [ $# -eq 1 ] || usage ;;
  pin)     [ $# -eq 3 ] || usage; pin "$2" "$3"; exit $? ;;
  path)    [ $# -eq 2 ] || usage; path_of "$2"; exit $? ;;
  check)   [ $# -eq 2 ] || usage; check_pin "$2"; exit $? ;;
  release) [ $# -eq 2 ] || usage; release_pin "$2"; exit $? ;;
  *)       [ $# -eq 2 ] || usage; meta "$1" "$2"; exit $? ;;
esac

# --- self-test ----------------------------------------------------------------------------
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
export POSTMASTER_TOOL_PINS="$tmp/tools"; TOOLS=$POSTMASTER_TOOL_PINS
d="$tmp/project/RUN-1"; repo="$tmp/target"; mkdir -p "$d" "$repo"
git -C "$repo" init -q -b main && git -C "$repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m first
cat > "$tmp/config.toml" <<'EOF'
[lanes.one]
harness = "bash"
model = "m1"
env_file = "~/somewhere/secret.env"
[lanes.two]
harness = "no-such-harness-xyz"
model = "m2"
[team]
workhorses = ["one", "two"]
coachman = { harness = "bash", model = "judge" }
EOF
export POSTMASTER_CONFIG="$tmp/config.toml"; CONFIG=$POSTMASTER_CONFIG
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; fails=$((fails+1)); }
check() { python3 -c "import json,sys; r=json.load(open('$d/run.json')); sys.exit(0 if ($2) else 1)" 2>/dev/null && ok "$1" || fail "$1"; }
try() { out=$("$0" "$@" 2>&1); rc=$?; }

echo "positive controls"
meta "$d" "$repo" >/dev/null && ok "run.json is written" || fail "run.json is written"
check "it names the postmaster commit"            "r['postmaster']['commit'] == '$(git -C "$TOOL" rev-parse HEAD)'"
check "it names the target's HEAD and branch"     "r['target'] == {'head': '$(git -C "$repo" rev-parse HEAD)', 'branch': 'main'}"
check "it keeps the config as it was"             "r['config']['lanes']['one']['model'] == 'm1' and r['config']['team']['workhorses'] == ['one','two']"
check "it records each harness's version"         "r['harness_versions']['bash'].startswith('GNU bash')"
check "a harness not installed says so"           "r['harness_versions']['no-such-harness-xyz'] == 'not on PATH'"
check "an env file is named, never read"          "r['config']['lanes']['one']['env_file'] == '~/somewhere/secret.env'"
check "it names the pinned checkout"              "r['postmaster']['checkout'] == '$TOOLS/$(git -C "$TOOL" rev-parse HEAD)'"
try path "$d"
[ $rc -eq 0 ] && [ "$out" = "$TOOLS/$(git -C "$TOOL" rev-parse HEAD)" ] && ok "path prints the pin" \
  || fail "path prints the pin" "$out"
try check "$d"
[ $rc -eq 0 ] && ok "check passes a pin that serves its commit" || fail "check passes a pin that serves its commit" "$out"
shared="$tmp/project/RUN-2"; mkdir -p "$shared"
meta "$shared" "$repo" >/dev/null
try path "$shared"
[ $rc -eq 0 ] && [ "$out" = "$TOOLS/$(git -C "$TOOL" rev-parse HEAD)" ] \
  && ok "a second run at the same commit shares the pin" || fail "a second run at the same commit shares the pin" "$out"

# AC3: a run dispatched at one commit still serves its versions after main moves on.
# The identical command is `check`; the runbook and the script are read from both checkouts,
# and the script is run from both.
fake=$tmp/fake-tool
git -C "$tmp" init -q -b main "$fake"
git -C "$fake" config user.name t; git -C "$fake" config user.email t@t
mkdir -p "$fake/skills/postmaster" "$fake/scripts"
printf '# coachman MARKER=A\n' > "$fake/skills/postmaster/coachman.md"
printf '#!/bin/sh\necho MARKER=A\n' > "$fake/scripts/foo.sh" && chmod +x "$fake/scripts/foo.sh"
git -C "$fake" add -A && git -C "$fake" commit -qm A
commitA=$(git -C "$fake" rev-parse HEAD)
pinA=$(pin "$fake" "$commitA") || fail "a pin of a tool repo at A is cut"
printf '# coachman MARKER=B\n' > "$fake/skills/postmaster/coachman.md"
printf '#!/bin/sh\necho MARKER=B\n' > "$fake/scripts/foo.sh"
git -C "$fake" add -A && git -C "$fake" commit -qm B
run_pinned="$tmp/project/RUN-PINNED"; run_live="$tmp/project/RUN-LIVE"
mkdir -p "$run_pinned" "$run_live"
for pair in "$run_pinned:$pinA:$commitA" "$run_live:$fake:$commitA"; do
  dd=${pair%%:*}; rest=${pair#*:}; co=${rest%%:*}; cm=${rest#*:}
  printf '{"postmaster": {"commit": "%s", "checkout": "%s"}, "stage": "synthesis"}\n' "$cm" "$co" > "$dd/run.json"
  printf '{"stage": "synthesis"}\n' > "$dd/manifest.json"
done
marker_of() { grep -o 'MARKER=.' "$1/skills/postmaster/coachman.md" | head -1; }
got=$(marker_of "$pinA"); want=$(marker_of "$fake")
[ "$got" = "MARKER=A" ] && [ "$want" = "MARKER=B" ] \
  && ok "after main moved on, the pin still reads A while main reads B (marker_of)" \
  || fail "after main moved on, the pin still reads A while main reads B (marker_of)" "pin=$got main=$want"
got=$(grep -o 'MARKER=.' "$pinA/scripts/foo.sh" | head -1); want=$(grep -o 'MARKER=.' "$fake/scripts/foo.sh" | head -1)
[ "$got" = "MARKER=A" ] && [ "$want" = "MARKER=B" ] \
  && ok "and the script reads A on the pin while main reads B" \
  || fail "and the script reads A on the pin while main reads B (pin=$got main=$want)"
got=$(bash "$pinA/scripts/foo.sh"); want=$(bash "$fake/scripts/foo.sh")
[ "$got" = "MARKER=A" ] && [ "$want" = "MARKER=B" ] \
  && ok "and the script runs A from the pin while main runs B (script_of)" \
  || fail "and the script runs A from the pin while main runs B (pin=$got main=$want)"
try check "$run_pinned"
[ $rc -eq 0 ] && ok "check passes the run pinned at A" || fail "check passes the run pinned at A" "$out"
try check "$run_live"
[ $rc -eq 1 ] && ok "check fails the run pointed at main after it moved on (identical command)" \
  || fail "check fails the run pointed at main after it moved on (identical command)" "$out"
printf 'drift\n' >> "$pinA/skills/postmaster/coachman.md"
try check "$run_pinned"
[ $rc -eq 1 ] && ok "check fails a pin that no longer serves its commit" \
  || fail "check fails a pin that no longer serves its commit" "$out"
git -C "$pinA" checkout -q -- skills/postmaster/coachman.md

echo "negative controls"
cp "$d/run.json" "$tmp/before.json"; sleep 1; meta "$d" "$repo" >/dev/null
cmp -s "$d/run.json" "$tmp/before.json" && ok "a second call leaves run.json alone" || fail "a second call leaves run.json alone"
rm -- "$d/run.json"; CONFIG="$tmp/none.toml"; meta "$d" "$repo" >/dev/null 2>&1; rc=$?; CONFIG=$POSTMASTER_CONFIG
[ $rc -eq 1 ] && [ ! -e "$d/run.json" ] && ok "no config is refused, and nothing is written" || fail "no config is refused, and nothing is written (exit $rc)"
meta "$d" "$tmp/not-a-repo" >/dev/null 2>&1; rc=$?
[ $rc -eq 1 ] && ok "a target that is not a repo is refused" || fail "a target that is not a repo is refused (exit $rc)"
try path "$tmp/project/no-such-run"
[ $rc -eq 1 ] && ok "path on a run with no run.json is refused" || fail "path on a run with no run.json is refused" "$out"
try pin "$fake" no-such-commit
[ $rc -eq 1 ] && ok "a commit the repo does not have is refused, and no pin is cut" \
  || fail "a commit the repo does not have is refused, and no pin is cut" "$out"
# AC4: release keeps a pin another in-flight run uses, and removes it once none does.
# RUN-PINNED and a third run share pinA; RUN-LIVE is the negative control that already moved.
run_third="$tmp/project/RUN-THIRD"; mkdir -p "$run_third"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinA" > "$run_third/run.json"
printf '{"stage": "shipping"}\n' > "$run_third/manifest.json"
try release "$run_pinned"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinA" ] \
  && ok "release keeps the pin while another run in flight still uses it" || fail "release keeps the pin while another run in flight still uses it" "$out"
printf '{"stage": "done"}\n' > "$run_third/manifest.json"
try release "$run_pinned"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinA" ] \
  && ok "release keeps the pin while its own run is still in flight" || fail "release keeps the pin while its own run is still in flight" "$out"
printf '{"stage": "done"}\n' > "$run_pinned/manifest.json"
try release "$run_pinned"
[ $rc -eq 0 ] && grep -q "removed" <<<"$out" && [ ! -e "$pinA" ] \
  && ok "release removes the pin once no run in flight uses it" || fail "release removes the pin once no run in flight uses it" "$out"
try release "$run_pinned"
[ $rc -eq 0 ] && ok "release again is a no-op" || fail "release again is a no-op" "$out"
noco="$tmp/project/RUN-OLD"; mkdir -p "$noco"
printf '{"postmaster": {"commit": "abc"}}\n' > "$noco/run.json"
try release "$noco"
[ $rc -eq 0 ] && ok "release of a run with no pinned checkout is a no-op" \
  || fail "release of a run with no pinned checkout is a no-op" "$out"
badown="$tmp/project/RUN-BADOWN"; mkdir -p "$badown"
printf '{"postmaster": {"commit": "%s", "checkout": 12345}}\n' "$commitA" > "$badown/run.json"
printf '{"stage": "done"}\n' > "$badown/manifest.json"
try release "$badown"
[ $rc -eq 1 ] && grep -q "unreadable" <<<"$out" \
  && ok "release refuses a run whose own checkout is not a string" \
  || fail "release refuses a run whose own checkout is not a string ($out)"
rm -rf -- "$badown"  # unknown to every later scan; its control is done
# A sibling whose record cannot be read keeps the pin; one that records no checkout is skipped.
g4rel="$tmp/project/RUN-G4"; g4sib="$tmp/project/RUN-G4SIB"; mkdir -p "$g4rel" "$g4sib"
pinG4=$(pin "$fake" "$commitA") || fail "a pin is cut for the unreadable-sibling controls"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinG4" > "$g4rel/run.json"
printf '{"stage": "done"}\n' > "$g4rel/manifest.json"
printf '{"stage": "synthesis"}\n' > "$g4sib/manifest.json"
printf 'NOT JSON\n' > "$g4sib/run.json"
try release "$g4rel"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinG4" ] \
  && ok "release keeps the pin for a sibling whose run.json does not parse" \
  || fail "release keeps the pin for a sibling whose run.json does not parse ($out)"
printf '{"postmaster": ["not", "an", "object"]}\n' > "$g4sib/run.json"
try release "$g4rel"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinG4" ] \
  && ok "release keeps the pin for a sibling whose postmaster is not an object" \
  || fail "release keeps the pin for a sibling whose postmaster is not an object ($out)"
printf '{"postmaster": {"commit": "%s", "checkout": 12345}}\n' "$commitA" > "$g4sib/run.json"
try release "$g4rel"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinG4" ] \
  && ok "release keeps the pin for a sibling whose checkout is not a string" \
  || fail "release keeps the pin for a sibling whose checkout is not a string ($out)"
printf '{}\n' > "$g4sib/run.json"
try release "$g4rel"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinG4" ] \
  && ok "release keeps the pin for a sibling with no postmaster record" \
  || fail "release keeps the pin for a sibling with no postmaster record ($out)"
printf '{"postmaster": {"commit": "%s"}}\n' "$commitA" > "$g4sib/run.json"
try release "$g4rel"
[ $rc -eq 0 ] && grep -q "removed" <<<"$out" && [ ! -e "$pinG4" ] \
  && ok "release removes past a sibling that records no checkout" \
  || fail "release removes past a sibling that records no checkout ($out)"
hidrun="$tmp/.hidden/RUN-HID"; hidrel="$tmp/project/RUN-HIDREL"; mkdir -p "$hidrun" "$hidrel"
pinH=$(pin "$fake" "$commitA") || fail "a pin is cut for the hidden-project controls"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinH" > "$hidrun/run.json"
printf '{"stage": "synthesis"}\n' > "$hidrun/manifest.json"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinH" > "$hidrel/run.json"
printf '{"stage": "done"}\n' > "$hidrel/manifest.json"
try release "$hidrel"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinH" ] \
  && ok "release keeps the pin for an in-flight run under a dot-prefixed project" \
  || fail "release keeps the pin for an in-flight run under a dot-prefixed project ($out)"
printf '{"stage": "done"}\n' > "$hidrun/manifest.json"
try release "$hidrel"
[ $rc -eq 0 ] && grep -q "removed" <<<"$out" && [ ! -e "$pinH" ] \
  && ok "release removes once the hidden run is done" \
  || fail "release removes once the hidden run is done ($out)"
nphid="$tmp/noproj/RUN-NP"; nprel="$tmp/project/RUN-NPREL"; mkdir -p "$nphid" "$nprel"
pinNP=$(pin "$fake" "$commitA") || fail "a pin is cut for the unreadable-directory controls"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinNP" > "$nphid/run.json"
printf '{"stage": "synthesis"}\n' > "$nphid/manifest.json"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinNP" > "$nprel/run.json"
printf '{"stage": "done"}\n' > "$nprel/manifest.json"
chmod 000 "$tmp/noproj"
try release "$nprel"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinNP" ] \
  && ok "release keeps the pin when a project directory cannot be listed" \
  || fail "release keeps the pin when a project directory cannot be listed ($out)"
chmod 755 "$tmp/noproj"
chmod 000 "$nphid"
try release "$nprel"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinNP" ] \
  && ok "release keeps the pin when a run directory cannot be listed" \
  || fail "release keeps the pin when a run directory cannot be listed ($out)"
chmod 755 "$nphid"
try release "$nprel"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinNP" ] \
  && ok "release still keeps the pin for the readable in-flight run" \
  || fail "release still keeps the pin for the readable in-flight run ($out)"
printf '{"stage": "done"}\n' > "$nphid/manifest.json"
try release "$nprel"
[ $rc -eq 0 ] && grep -q "removed" <<<"$out" && [ ! -e "$pinNP" ] \
  && ok "release removes once the unreadable run is done" \
  || fail "release removes once the unreadable run is done ($out)"
# A literal star in a directory name is data: the scan reads through it and keeps the pin
# for the in-flight runs, without crying unreadable.
mkdir -p "$tmp/project/*EMPTY" "$tmp/project/RUN-SALIVE" "$tmp/project/STAR*RUN" "$tmp/star*proj/RUN-PALIVE"
pinS=$(pin "$fake" "$commitA") || fail "a pin is cut for the star-name controls"
for r in "$tmp/project/RUN-SALIVE" "$tmp/project/STAR*RUN" "$tmp/star*proj/RUN-PALIVE"; do
  printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinS" > "$r/run.json"
  printf '{"stage": "synthesis"}\n' > "$r/manifest.json"
done
starrel="$tmp/project/RUN-STARREL"; mkdir -p "$starrel"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinS" > "$starrel/run.json"
printf '{"stage": "done"}\n' > "$starrel/manifest.json"
try release "$starrel"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && ! grep -q "cannot list" <<<"$out" && [ -d "$pinS" ] \
  && ok "release keeps the pin past star-named directories, crying nothing unreadable" \
  || fail "release keeps the pin past star-named directories, crying nothing unreadable ($out)"
for r in "$tmp/project/RUN-SALIVE" "$tmp/project/STAR*RUN" "$tmp/star*proj/RUN-PALIVE"; do
  printf '{"stage": "done"}\n' > "$r/manifest.json"
done
try release "$starrel"
[ $rc -eq 0 ] && grep -q "removed" <<<"$out" && [ ! -e "$pinS" ] \
  && ok "release removes once the star-named runs are done" \
  || fail "release removes once the star-named runs are done ($out)"
gi_run="$tmp/giproj/RUN-GI"; gi_rel="$tmp/project/RUN-GIREL"; mkdir -p "$gi_run" "$gi_rel"
pinGI=$(pin "$fake" "$commitA") || fail "a pin is cut for the GLOBIGNORE controls"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinGI" > "$gi_run/run.json"
printf '{"stage": "synthesis"}\n' > "$gi_run/manifest.json"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinGI" > "$gi_rel/run.json"
printf '{"stage": "done"}\n' > "$gi_rel/manifest.json"
printf 'GLOBIGNORE=%s\n' "$tmp/giproj/" > "$tmp/benv-ignore.sh"
export BASH_ENV="$tmp/benv-ignore.sh"
try release "$gi_rel"
unset BASH_ENV
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$pinGI" ] \
  && ok "release keeps the pin under a BASH_ENV that ignores the live project" \
  || fail "release keeps the pin under a BASH_ENV that ignores the live project ($out)"
# The hostile controls: release under a BASH_ENV holding the opposite of every
# explicit scan setting, over a fixture shaped to show each one: an empty project
# level, a dot-named project holding the live run, and star-named, bracket-named
# and mixed-case projects.
hroot=$tmp/hruns
mkdir -p "$hroot/empty-proj" "$hroot/.dotproj/RUN-HDOT" "$hroot/giproj/RUN-HGI" \
  "$hroot/STAR*PROJ/RUN-HS" "$hroot/br[ack]et/RUN-HB" "$hroot/MiXeD/RUN-HM" \
  "$hroot/project/RUN-HREL"
# The hostile pin is its own commit, so the hostile remove below does not eat the
# GLOBIGNORE pin, which is still needed after; the fake repo's HEAD is B here.
commitH=$(git -C "$fake" rev-parse HEAD)
pinH=$(pin "$fake" "$commitH") || fail "a pin is cut for the hostile controls"
for r in "$hroot/.dotproj/RUN-HDOT" "$hroot/giproj/RUN-HGI" "$hroot/STAR*PROJ/RUN-HS" \
    "$hroot/br[ack]et/RUN-HB" "$hroot/MiXeD/RUN-HM" "$hroot/project/RUN-HREL"; do
  printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitH" "$pinH" > "$r/run.json"
  printf '{"stage": "done"}\n' > "$r/manifest.json"
done
printf '{"stage": "synthesis"}\n' > "$hroot/.dotproj/RUN-HDOT/manifest.json"
cat > "$tmp/benv-hostile.sh" <<EOF
GLOBIGNORE=$hroot/giproj/
shopt -s failglob nocaseglob extglob globstar nocasematch
shopt -u dotglob nullglob globskipdots globasciiranges
EOF
export BASH_ENV="$tmp/benv-hostile.sh"
try release "$hroot/project/RUN-HREL"
unset BASH_ENV
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && ! grep -q "cannot list" <<<"$out" && [ -d "$pinH" ] \
  && ok "release keeps the pin under every hostile glob setting at once" \
  || fail "release keeps the pin under every hostile glob setting at once ($out)"
printf '{"stage": "done"}\n' > "$hroot/.dotproj/RUN-HDOT/manifest.json"
export BASH_ENV="$tmp/benv-hostile.sh"
try release "$hroot/project/RUN-HREL"
unset BASH_ENV
[ $rc -eq 0 ] && grep -q "removed" <<<"$out" && [ ! -e "$pinH" ] \
  && ok "release removes under every hostile glob setting at once when nothing is live" \
  || fail "release removes under every hostile glob setting at once when nothing is live ($out)"
printf '{"stage": "done"}\n' > "$gi_run/manifest.json"
try release "$gi_rel"
[ $rc -eq 0 ] && grep -q "removed" <<<"$out" && [ ! -e "$pinGI" ] \
  && ok "release removes once the GLOBIGNORE run is done" \
  || fail "release removes once the GLOBIGNORE run is done ($out)"
meta "$d" "$repo" >/dev/null
try check "$d"
[ $rc -eq 0 ] && ok "check still passes the run that shares the live tool pin" \
  || fail "check still passes the run that shares the live tool pin" "$out"
# Concurrent cuts of one commit share one pin; the loser reuses the winner's checkout.
race="$tmp/tools/$commitA"
rm -rf "$race"
( pin "$fake" "$commitA" >/dev/null 2>&1 ) &
( pin "$fake" "$commitA" >/dev/null 2>&1 ) &
wait
[ -d "$race" ] && [ "$(git -C "$race" rev-parse HEAD 2>/dev/null)" = "$commitA" ] \
  && ok "two concurrent cuts of one commit end with one shared pin" \
  || fail "two concurrent cuts of one commit end with one shared pin"
git clone -q "$fake" "$tmp/fake-clone" 2>/dev/null
try pin "$tmp/fake-clone" "$commitA"
[ $rc -eq 0 ] && [ "$out" = "$race" ] \
  && ok "a pin of the same commit from another clone reuses the checkout" \
  || fail "a pin of the same commit from another clone reuses the checkout" "$out"
printf 'drift\n' >> "$race/skills/postmaster/coachman.md"
try pin "$fake" "$commitA"
[ $rc -eq 1 ] && ok "a pin that is not clean is refused on reuse" \
  || fail "a pin that is not clean is refused on reuse" "$out"
git -C "$race" checkout -q -- skills/postmaster/coachman.md
try pin "$fake" "$commitA"
[ $rc -eq 0 ] && [ "$out" = "$race" ] && ok "a cleaned pin is shared again" \
  || fail "a cleaned pin is shared again" "$out"
commitB=$(git -C "$fake" rev-parse HEAD)
pinB=$(pin "$fake" "$commitB") || fail "a pin at B is cut for the refusal controls"
git -C "$pinB" checkout -q "$commitA"
try pin "$fake" "$commitB"
[ $rc -eq 1 ] && ok "a pin holding another commit is refused" \
  || fail "a pin holding another commit is refused ($out)"
git -C "$fake" worktree remove --force "$pinB"
git -C "$fake" commit -q --allow-empty -m C
commitC=$(git -C "$fake" rev-parse HEAD)
mkdir -p "$TOOLS/$commitC" && printf 'mine\n' > "$TOOLS/$commitC/mine.txt"
try pin "$fake" "$commitC"
[ $rc -eq 1 ] && ok "a pin path that is not a checkout is refused" \
  || fail "a pin path that is not a checkout is refused ($out)"
rm -rf -- "$TOOLS/$commitC"
# An old unpinned waybill keeps the tool path it already names.
legacy_run="$tmp/project/RUN-LEGACY"; mkdir -p "$legacy_run"
printf '{"postmaster": {"commit": "%s"}}\n' "$commitA" > "$legacy_run/run.json"
printf '# Waybill: 7\n\ntool: %s\n' "$fake" > "$legacy_run/brief.md"
try path "$legacy_run"
[ $rc -eq 0 ] && [ "$out" = "$(CDPATH= cd -P -- "$fake" && pwd -P)" ] \
  && ok "path falls back to an old waybill's tool path" \
  || fail "path falls back to an old waybill's tool path" "$out"
try check "$legacy_run"
[ $rc -eq 0 ] && ok "check passes an old waybill on a git checkout" \
  || fail "check passes an old waybill on a git checkout" "$out"
printf '# Waybill: 7\n\ntool: %s\n' "$tmp/nowhere" > "$legacy_run/brief.md"
try check "$legacy_run"
[ $rc -eq 1 ] && ok "check fails an old waybill whose tool is gone" \
  || fail "check fails an old waybill whose tool is gone" "$out"
printf '# Waybill: 7\n\ntool: %s\ntool: %s\n' "$fake" "$fake" > "$legacy_run/brief.md"
try path "$legacy_run"
[ $rc -eq 1 ] && ok "path refuses a waybill with two tool lines" \
  || fail "path refuses a waybill with two tool lines" "$out"
printf '# Waybill: 7\n\n## Ticket\na sample:\ntool: /from/the/ticket\n\n## Dispatch\ntool: %s\n' "$fake" > "$legacy_run/brief.md"
try path "$legacy_run"
[ $rc -eq 0 ] && [ "$out" = "$(CDPATH= cd -P -- "$fake" && pwd -P)" ] \
  && ok "path ignores a tool: line in the ticket body" \
  || fail "path ignores a tool: line in the ticket body ($out)"
printf '# Waybill: 7\n\n## Dispatch\ntool: %s\ntool: %s\n' "$fake" "$fake" > "$legacy_run/brief.md"
try path "$legacy_run"
[ $rc -eq 1 ] && ok "path refuses a Dispatch section with two tool lines" \
  || fail "path refuses a Dispatch section with two tool lines ($out)"
# path and check refuse an unreadable checkout instead of taking the waybill fallback.
badpath="$tmp/project/RUN-BADPATH"; mkdir -p "$badpath"
printf '# Waybill: 7\n\n## Dispatch\ntool: %s\n' "$fake" > "$badpath/brief.md"
printf '{}\n' > "$badpath/run.json"
try path "$badpath"
[ $rc -eq 1 ] && grep -q "unreadable" <<<"$out" \
  && ok "path refuses a run with no postmaster record" \
  || fail "path refuses a run with no postmaster record ($out)"
printf '{"postmaster": {"commit": "%s", "checkout": false}}\n' "$commitA" > "$badpath/run.json"
try path "$badpath"
[ $rc -eq 1 ] && grep -q "unreadable" <<<"$out" \
  && ok "path refuses a run whose checkout is not a string" \
  || fail "path refuses a run whose checkout is not a string ($out)"
try check "$badpath"
[ $rc -eq 1 ] && grep -q "unreadable" <<<"$out" \
  && ok "check refuses a run whose checkout is not a string" \
  || fail "check refuses a run whose checkout is not a string ($out)"
rm -rf -- "$badpath"  # unknown to every later scan; its controls are done
# check fails a pin at the wrong commit, whatever shape the record is in.
pinW=$(pin "$fake" "$commitB") || fail "a pin at B is cut for the mismatch controls"
misrun="$tmp/project/RUN-MIS"; mkdir -p "$misrun"
printf '# Waybill: 7\n\n## Dispatch\ntool: %s\n' "$fake" > "$misrun/brief.md"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinW" > "$misrun/run.json"
try check "$misrun"
[ $rc -eq 1 ] && grep -q "not the recorded" <<<"$out" \
  && ok "check fails a pin at the wrong commit" \
  || fail "check fails a pin at the wrong commit ($out)"
printf '{}\n' > "$misrun/run.json"
try check "$misrun"
[ $rc -eq 1 ] && grep -q "unreadable" <<<"$out" \
  && ok "check fails a wrong-commit pin when the record has no postmaster" \
  || fail "check fails a wrong-commit pin when the record has no postmaster ($out)"
printf '{"postmaster": {"commit": "%s", "checkout": false}}\n' "$commitA" > "$misrun/run.json"
try check "$misrun"
[ $rc -eq 1 ] && grep -q "unreadable" <<<"$out" \
  && ok "check fails a wrong-commit pin when the checkout is not a string" \
  || fail "check fails a wrong-commit pin when the checkout is not a string ($out)"
rm -rf -- "$misrun"  # unknown to every later scan; its controls are done
git -C "$fake" worktree remove --force "$pinW"
# A recorded path through a symlink resolves to the canonical checkout.
ln -s "$TOOLS" "$tmp/tools-link"
link_run="$tmp/project/RUN-LINK"; mkdir -p "$link_run"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$tmp/tools-link/$commitA" > "$link_run/run.json"
try path "$link_run"
[ $rc -eq 0 ] && [ "$out" = "$race" ] && ok "path prints the canonical checkout" \
  || fail "path prints the canonical checkout" "$out"
printf '{"stage": "shipping"}\n' > "$link_run/manifest.json"
# Two runs closing at once both release cleanly; the loser finds the pin already gone.
rel_a="$tmp/project/RUN-REL-A"; rel_b="$tmp/project/RUN-REL-B"
mkdir -p "$rel_a" "$rel_b"
for rel in "$rel_a" "$rel_b"; do
  printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$race" > "$rel/run.json"
  printf '{"stage": "done"}\n' > "$rel/manifest.json"
done
try release "$rel_a"
[ $rc -eq 0 ] && grep -q "kept" <<<"$out" && [ -d "$race" ] \
  && ok "release keeps the pin for an in-flight run recorded through a symlink" \
  || fail "release keeps the pin for an in-flight run recorded through a symlink" "$out"
printf '{"stage": "done"}\n' > "$link_run/manifest.json"
races=0; lastrace=""
for round in 1 2 3 4 5 6 7 8 9 10; do
  pinR=$(pin "$fake" "$commitA") || { races=$((races+1)); lastrace="round $round cuts no pin"; break; }
  for rel in "$rel_a" "$rel_b"; do
    printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinR" > "$rel/run.json"
  done
  "$0" release "$rel_a" >"$tmp/rel-a.out" 2>&1 & ra_pid=$!
  "$0" release "$rel_b" >"$tmp/rel-b.out" 2>&1 & rb_pid=$!
  wait $ra_pid; ra=$?; wait $rb_pid; rb=$?
  [ $ra -eq 0 ] && [ $rb -eq 0 ] && [ ! -e "$pinR" ] \
    || { races=$((races+1)); lastrace="round $round: a=$ra b=$rb $(cat "$tmp/rel-a.out" "$tmp/rel-b.out")"; }
done
[ $races -eq 0 ] && ok "ten concurrent-release races all exit 0 and remove the pin" \
  || fail "ten concurrent-release races all exit 0 and remove the pin ($lastrace)"
# A dispatch racing a release serializes: either the release sees the new record and keeps
# the pin, or it removes wholly before the dispatch cuts. Either way both exit 0 and the
# new run checks out.
mkdir -p "$tmp/stubbin"
printf '#!/bin/sh\nif [ "$1" = "--version" ]; then sleep 3; echo "slow 1.0"; else echo "slow 1.0"; fi\n' \
  > "$tmp/stubbin/slowharness" && chmod +x "$tmp/stubbin/slowharness"
cat > "$tmp/slow.toml" <<'EOF'
[lanes.one]
harness = "slowharness"
model = "m1"
[team]
coachman = { harness = "slowharness", model = "judge" }
EOF
printf '{"stage": "done"}\n' > "$d/manifest.json"
printf '{"stage": "done"}\n' > "$shared/manifest.json"
livecommit=$(git -C "$TOOL" rev-parse HEAD)
livepin=$(pin "$TOOL" "$livecommit") || fail "a pin of the live tool is cut for the dispatch race"
g1done="$tmp/project/RUN-G1DONE"; g1new="$tmp/project/RUN-G1NEW"; mkdir -p "$g1done" "$g1new"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$livecommit" "$livepin" > "$g1done/run.json"
printf '{"stage": "done"}\n' > "$g1done/manifest.json"
CONFIG="$tmp/slow.toml"; PATH="$tmp/stubbin:$PATH"
meta "$g1new" "$repo" >"$tmp/g1-meta.out" 2>&1 & g1mp=$!
sleep 1
"$0" release "$g1done" >"$tmp/g1-rel.out" 2>&1; g1rr=$?
wait $g1mp; g1mr=$?
CONFIG=$POSTMASTER_CONFIG
newco=$(field "$g1new/run.json" checkout)
try check "$g1new"
[ $g1mr -eq 0 ] && [ $g1rr -eq 0 ] && [ -n "$newco" ] && [ -d "$newco" ] && [ $rc -eq 0 ] \
  && ok "a dispatch racing a release records a pin that checks out" \
  || fail "a dispatch racing a release records a pin that checks out (meta=$g1mr release=$g1rr check=$rc)"
# Two dispatches of one run serialize: the loser finds run.json already written.
drace="$tmp/project/RUN-DRACE"; mkdir -p "$drace"
meta "$drace" "$repo" >"$tmp/drace-a.out" 2>&1 & dra_pid=$!
meta "$drace" "$repo" >"$tmp/drace-b.out" 2>&1 & drb_pid=$!
wait $dra_pid; dra=$?; wait $drb_pid; drb=$?
{ grep -q "already written" "$tmp/drace-a.out" || grep -q "already written" "$tmp/drace-b.out"; } \
  && [ $dra -eq 0 ] && [ $drb -eq 0 ] \
  && ok "two dispatches of one run write run.json once" \
  || fail "two dispatches of one run write run.json once (a=$dra b=$drb $(cat "$tmp/drace-a.out" "$tmp/drace-b.out"))"
# Release force-removes an unreferenced pin it cannot remove cleanly, but honors a lock.
pinD=$(pin "$fake" "$commitA") || fail "a pin is cut for the dirty-release controls"
g6rel="$tmp/project/RUN-G6"; mkdir -p "$g6rel"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinD" > "$g6rel/run.json"
printf '{"stage": "done"}\n' > "$g6rel/manifest.json"
printf 'drift\n' >> "$pinD/skills/postmaster/coachman.md"
try release "$g6rel"
[ $rc -eq 0 ] && grep -q "not clean" <<<"$out" && [ ! -e "$pinD" ] \
  && ok "release force-removes an unreferenced pin that is not clean" \
  || fail "release force-removes an unreferenced pin that is not clean ($out)"
pinL=$(pin "$fake" "$commitA") || fail "a pin is cut for the locked-release control"
printf '{"postmaster": {"commit": "%s", "checkout": "%s"}}\n' "$commitA" "$pinL" > "$g6rel/run.json"
git -C "$fake" worktree lock "$pinL"
try release "$g6rel"
[ $rc -eq 1 ] && grep -q "locked" <<<"$out" && [ -d "$pinL" ] \
  && ok "release leaves a locked pin alone" \
  || fail "release leaves a locked pin alone ($out)"
git -C "$fake" worktree unlock "$pinL"
try release "$g6rel"
[ $rc -eq 0 ] && grep -q "removed" <<<"$out" && [ ! -e "$pinL" ] \
  && ok "release removes the pin once unlocked" \
  || fail "release removes the pin once unlocked ($out)"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
