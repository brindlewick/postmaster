#!/usr/bin/env bash
# Cut a disposable reviewer scratch: a detached worktree at a snapshot, with the installed
# dependency directories CLONED from a source worktree. Nothing is ever installed into a
# scratch; a lane that opens on a broken scratch reports the breakage as a finding about the
# diff, or gives up on running the suite and reverts to reading.
#
#   cut-scratch.sh <repo> <source-worktree> <dest-path> <commit>
#
# Clones each directory named in DEPS_DIRS (default: node_modules) at the root AND under every
# workspace member (packages/*, apps/*): in a workspace each member carries its own link farm,
# and cloning only the root leaves a checkout that cannot resolve its own packages.
# cp -c is a filesystem clone where the filesystem supports it; the plain copy is the fallback.
#
#   exit 0  scratch created; the dependency clone is reported per directory
#   exit 1  usage, or git could not create the worktree
set -uo pipefail
REPO=${1:?usage: cut-scratch.sh <repo> <source-worktree> <dest-path> <commit>}
SRC=${2:?}
DEST=${3:?}
SNAP=${4:?}
DEPS=${DEPS_DIRS:-node_modules}

git -C "$REPO" worktree add --detach "$DEST" "$SNAP" >/dev/null 2>&1 \
  || { echo "cut-scratch: git could not create $DEST at $SNAP" >&2; exit 1; }

clone_dir() {  # $1 source dir, $2 destination dir
  [ -d "$1" ] || return 1
  mkdir -p "$(dirname "$2")"
  cp -Rc "$1" "$2" 2>/dev/null || cp -R "$1" "$2"
}

cloned=0
for d in $DEPS; do
  clone_dir "$SRC/$d" "$DEST/$d" && { cloned=$((cloned + 1)); echo "cloned $d"; }
  for member in "$SRC"/packages/*/ "$SRC"/apps/*/; do
    [ -d "$member" ] || continue
    rel=${member#"$SRC"/}
    clone_dir "$member$d" "$DEST/$rel$d" && { cloned=$((cloned + 1)); echo "cloned $rel$d"; }
  done
done

echo "scratch $DEST at $(git -C "$DEST" rev-parse --short HEAD), $cloned dependency dir(s) cloned"
[ "$cloned" -eq 0 ] && echo "cut-scratch: no dependency directory found under $SRC; if the project has one, install it there first" >&2
exit 0
