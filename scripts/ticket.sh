#!/usr/bin/env bash
# File-based tickets with exactly one copy of every ticket, whatever branch or worktree the
# reader is in. Tickets live on a dedicated branch named `tickets`, rooted at its own empty
# commit and checked out at <repo>/.worktrees/tickets; code branches never carry ticket
# files, so a ticket cannot be in two states at once. Reads come from the branch through git,
# never from a checkout. Writes are commits on the branch, serialised by a lock.
#
#   ticket.sh <repo> init <prefix>                 create the branch and worktree; idempotent
#   ticket.sh <repo> next-id                       the next unused id
#   ticket.sh <repo> create <title> <body-file>    new ticket in state todo; prints its id
#   ticket.sh <repo> read <id>                     print the ticket as it is on the branch
#   ticket.sh <repo> state <id> <state> [actor]    todo | in-progress | blocked | done | cancelled
#   ticket.sh <repo> comment <id> <actor> <text>   append a dated line under ## Log
#   ticket.sh <repo> list [state]                  one line per ticket: id, state, title
#
#   exit 0  ok
#   exit 1  usage, not initialised, unknown id, or git failure
#   exit 2  invalid state
set -uo pipefail
REPO=${1:?usage: ticket.sh <repo> <command> ...}
CMD=${2:?usage: ticket.sh <repo> <command> ...}
shift 2
BR=tickets
TW="$REPO/.worktrees/$BR"
STATES="todo in-progress blocked done cancelled"

die() { echo "ticket: $*" >&2; exit 1; }
branch_exists() { git -C "$REPO" show-ref --verify --quiet "refs/heads/$BR"; }
need_init() {
  branch_exists || die "no tickets branch in $REPO; run: ticket.sh $REPO init <prefix>"
  [ -d "$TW" ] || die "tickets worktree missing at $TW; run init again"
}
prefix() { git -C "$REPO" show "$BR:.tracker" 2>/dev/null | sed -n 's/^prefix=//p'; }
exists() { git -C "$REPO" cat-file -e "$BR:$1.md" 2>/dev/null; }
now() { date -u +'%Y-%m-%d %H:%M'; }
lock() {
  local i=0
  until mkdir "$TW/.lock" 2>/dev/null; do
    i=$((i + 1)); [ "$i" -gt 60 ] && die "lock held for 60s: $TW/.lock"
    sleep 1
  done
  trap 'rmdir "$TW/.lock" 2>/dev/null' EXIT
}
commit() { git -C "$TW" add -A && git -C "$TW" commit -q -m "$1" || die "commit failed on $BR"; }
field() { git -C "$REPO" show "$BR:$1" | sed -n "s/^$2: //p" | head -1; }

case $CMD in
  init)
    P=${1:?usage: ticket.sh <repo> init <prefix>}
    if branch_exists; then
      [ -d "$TW" ] || git -C "$REPO" worktree add "$TW" "$BR" >/dev/null 2>&1 \
        || die "could not check out $BR at $TW"
      echo "tickets branch exists; prefix $(prefix); worktree $TW"; exit 0
    fi
    # A root commit with an empty tree: unrelated to any code history, on every git version.
    empty=$(git -C "$REPO" hash-object -t tree /dev/null) || die "hash-object failed"
    root=$(git -C "$REPO" commit-tree "$empty" -m "tickets: root") || die "commit-tree failed"
    git -C "$REPO" branch "$BR" "$root" || die "could not create branch $BR"
    mkdir -p "$REPO/.worktrees"
    git -C "$REPO" worktree add "$TW" "$BR" >/dev/null 2>&1 || die "could not check out $BR at $TW"
    grep -qxF '.worktrees/' "$REPO/.git/info/exclude" 2>/dev/null \
      || echo '.worktrees/' >> "$REPO/.git/info/exclude"
    printf 'prefix=%s\n' "$P" > "$TW/.tracker"
    commit "tickets: init, prefix $P"
    echo "tickets branch created; prefix $P; worktree $TW" ;;
  next-id)
    need_init; P=$(prefix)
    n=$(git -C "$REPO" ls-tree --name-only "$BR" \
        | sed -n "s/^$P-\([0-9][0-9]*\)\.md$/\1/p" | sort -n | tail -1)
    echo "$P-$(( ${n:-0} + 1 ))" ;;
  create)
    need_init
    TITLE=${1:?usage: ticket.sh <repo> create <title> <body-file>}
    BODY=${2:?usage: ticket.sh <repo> create <title> <body-file>}
    [ -f "$BODY" ] || die "no such body file: $BODY"
    lock
    ID=$("$0" "$REPO" next-id) || exit 1
    {
      printf -- '---\nid: %s\ntitle: %s\nstate: todo\ncreated: %s\n---\n\n' "$ID" "$TITLE" "$(date -u +%Y-%m-%d)"
      cat "$BODY"
      printf '\n\n## Log\n- %s postmaster: created\n' "$(now)"
    } > "$TW/$ID.md"
    commit "$ID: $TITLE"
    echo "$ID" ;;
  read)
    need_init; ID=${1:?usage: ticket.sh <repo> read <id>}
    exists "$ID" || die "no such ticket: $ID"
    git -C "$REPO" show "$BR:$ID.md" ;;
  state)
    need_init
    ID=${1:?usage: ticket.sh <repo> state <id> <state> [actor]}
    ST=${2:?usage: ticket.sh <repo> state <id> <state> [actor]}
    ACTOR=${3:-postmaster}
    case " $STATES " in
      *" $ST "*) ;;
      *) echo "ticket: invalid state '$ST' (one of: $STATES)" >&2; exit 2 ;;
    esac
    exists "$ID" || die "no such ticket: $ID"
    lock
    F="$TW/$ID.md"
    sed "s/^state: .*/state: $ST/" "$F" > "$F.tmp" && mv "$F.tmp" "$F"
    printf -- '- %s %s: state %s\n' "$(now)" "$ACTOR" "$ST" >> "$F"
    commit "$ID: $ST"
    echo "$ID $ST" ;;
  comment)
    need_init
    ID=${1:?usage: ticket.sh <repo> comment <id> <actor> <text>}
    ACTOR=${2:?usage: ticket.sh <repo> comment <id> <actor> <text>}
    shift 2
    TEXT=${*:?usage: ticket.sh <repo> comment <id> <actor> <text>}
    exists "$ID" || die "no such ticket: $ID"
    lock
    printf -- '- %s %s: %s\n' "$(now)" "$ACTOR" "$TEXT" >> "$TW/$ID.md"
    commit "$ID: comment"
    echo "$ID commented" ;;
  list)
    need_init; WANT=${1:-}
    for f in $(git -C "$REPO" ls-tree --name-only "$BR" | grep -E '\.md$'); do
      st=$(field "$f" state)
      [ -n "$WANT" ] && [ "$st" != "$WANT" ] && continue
      printf '%-10s %-12s %s\n' "$(field "$f" id)" "$st" "$(field "$f" title)"
    done ;;
  *) die "unknown command: $CMD" ;;
esac
