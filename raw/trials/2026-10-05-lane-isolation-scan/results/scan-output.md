Streams read: 60 in 30 runs. No stream found for: #218 sol, #218 mimo.

## Streams with at least one sighting, by kind

`named` is a path the lane's own prompt or ticket gave it. `refs-other` is a git command whose target was a variable or another folder. Neither is counted as a reach.

| kind | streams | runs |
| --- | --- | --- |
| sibling | 0 | 0 |
| shared | 2 | 2 |
| other | 0 | 0 |
| refs | 8 | 8 |
| commit | 8 | 6 |
| outside | 6 | 5 |
| refs-other | 5 | 5 |
| named | 3 | 3 |

## By label

| kind | label | streams |
| --- | --- | --- |
| shared | the run's shared worktree | 2 |
| refs | branch-list | 2 |
| refs | log-all | 4 |
| refs | worktree-list | 2 |
| commit | git | 1 |
| commit | other | 2 |
| commit | process list | 6 |
| outside | memory-folder | 1 |
| outside | postmaster-private:config.toml | 5 |
| outside | run-records:other | 2 |
| outside | run-records:own | 3 |
| refs-other | branch-list (elsewhere) | 1 |
| refs-other | branch-list (unresolved) | 4 |
| refs-other | for-each-ref (elsewhere) | 1 |
| refs-other | log-all (unresolved) | 1 |
| refs-other | ls-remote (elsewhere) | 1 |
| refs-other | read-lane-ref (unresolved) | 1 |
| refs-other | worktree-list (elsewhere) | 1 |
| refs-other | worktree-list (unresolved) | 3 |
| named | postmaster-private:config.toml | 1 |
| named | postmaster-private:drafts | 1 |
| named | run-records:own | 1 |

## By confinement mode and model

| confine | model | streams | shared worktree | other lane's commit read with git | other branches listed or searched | outside |
| --- | --- | --- | --- | --- | --- | --- |
| not recorded | gpt-6-astra | 1 | 0 | 0 | 0 | 0 |
| not recorded | gpt-6-luna | 14 | 0 | 0 | 0 | 0 |
| not recorded | gpt-6-sol | 2 | 0 | 0 | 0 | 0 |
| not recorded | mimo-v2.6-pro | 17 | 0 | 1 | 3 | 0 |
| on | gpt-6-luna | 13 | 0 | 0 | 0 | 1 |
| on | mimo-v2.6-flash | 8 | 2 | 0 | 4 | 5 |
| on | mimo-v2.6-pro | 5 | 0 | 0 | 1 | 0 |

Streams with no known commit of the other lane, where the `commit` kind cannot fire: 0.

## Sightings per stream

Calls are tool calls with the same call id folded together. A stream not listed had none.

| run | lane | model | confine | calls | sibling | shared | other | refs | commit | outside | refs-other | named |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 75 | mimo | mimo-v2.6-pro |  | 182 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| 92 | luna | gpt-6-luna |  | 70 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| 92 | mimo | mimo-v2.6-pro |  | 148 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| 158 | mimo | mimo-v2.6-pro |  | 389 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 |
| 159 | mimo | mimo-v2.6-pro |  | 200 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| 163 | mimo | mimo-v2.6-pro |  | 378 | 0 | 0 | 0 | 2 | 2 | 0 | 0 | 0 |
| 170 | mimo | mimo-v2.6-pro |  | 473 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| 201 | sol | gpt-6-sol |  | 75 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| 201 | mimo | mimo-v2.6-pro |  | 248 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 5 |
| 216 | mimo | mimo-v2.6-pro | on | 758 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| 217 | mimo | mimo-v2.6-pro | on | 1087 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| 237 | luna | gpt-6-luna | on | 451 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| 237 | mimo | mimo-v2.6-flash | on | 1179 | 0 | 0 | 0 | 1 | 0 | 11 | 2 | 0 |
| 252 | mimo | mimo-v2.6-flash | on | 595 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 |
| 258 | mimo | mimo-v2.6-flash | on | 1806 | 0 | 0 | 0 | 5 | 0 | 0 | 2 | 0 |
| 259 | mimo | mimo-v2.6-flash | on | 810 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| 265 | mimo | mimo-v2.6-flash | on | 735 | 0 | 4 | 0 | 1 | 0 | 6 | 3 | 0 |
| 266 | mimo | mimo-v2.6-flash | on | 1130 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| 268 | mimo | mimo-v2.6-flash | on | 616 | 0 | 176 | 0 | 3 | 0 | 6 | 0 | 0 |
| 270 | mimo | mimo-v2.6-flash | on | 1313 | 0 | 0 | 0 | 0 | 0 | 2 | 10 | 0 |

## The sightings, first three per stream and kind

### #75 mimo

- commit / process list (shell, event line 148 2026-09-30T10:40:12Z): `dbf8a2d`
- commit / process list (shell, event line 148 2026-09-30T10:40:12Z): `dbf8a2d`
- commit / process list (shell, event line 158 2026-09-30T10:50:42Z): `dbf8a2d`

### #92 luna

- commit / process list (shell, event line 115): `ff4a0a1`

### #92 mimo

- commit / process list (shell, event line 111 2026-09-30T10:41:13Z): `3450eb8`
- commit / process list (shell, event line 111 2026-09-30T10:41:13Z): `3450eb8`

### #158 mimo

- refs / branch-list (shell, event line 34 2026-09-29T23:46:43Z): `file -e bb782a973e69^{commit} 2>&1; git cat-file -e 468035b6cf24^{commit} 2>&1; git branch -a | head -40; ls .git 2>/dev/null | head; git rev-parse --git-dir`
- commit / process list (shell, event line 326 2026-09-30T15:02:04Z): `518728d`
- commit / process list (shell, event line 326 2026-09-30T15:02:04Z): `518728d`

### #159 mimo

- refs / worktree-list (shell, event line 169 2026-09-30T14:23:00Z): `723d54871b4b8ba728 73fca4e4a513d8915bf067723d54871b4b8ba728 2>&1; echo exit:$?; git -C <repo> worktree list | head -20`

### #163 mimo

- refs / log-all (shell, event line 53 2026-09-29T21:54:39Z): `git log --all --oneline --grep='contract' | head -20; echo '---'; git log --all --oneline --g`
- refs / log-all (shell, event line 58 2026-09-29T21:54:51Z): `git show 015f1a8 --stat | head -30 && echo '====' && git log --all --oneline --grep='contract marker\|contract version\|landing' | head -20`
- commit / git (shell, event line 53 2026-09-29T21:54:39Z): `44aa5ef`
- commit / git (shell, event line 53 2026-09-29T21:54:39Z): `44aa5ef`
- commit / git (shell, event line 57 2026-09-29T21:54:51Z): `44aa5ef`

### #170 mimo

- commit / process list (shell, event line 432 2026-09-30T23:43:21Z): `ef8258e`
- commit / process list (shell, event line 432 2026-09-30T23:43:21Z): `ef8258e`
- commit / process list (shell, event line 438 2026-09-30T23:47:42Z): `ef8258e`

### #201 sol

- commit / other (shell, event line 6): `68b41bc`

### #201 mimo

- commit / other (read, event line 62 2026-10-02T10:13:12Z): `79b0dc6`
- commit / other (read, event line 62 2026-10-02T10:13:12Z): `79b0dc6`
- commit / process list (shell, event line 199 2026-10-02T10:36:37Z): `5f2261f`
- named / run-records:own (shell, event line 221 2026-10-02T10:50:47Z): `b2c/scripts/verify.sh results <repo>/.postmaster/runs/201 . 2>&1; echo '===='; cat /tmp`
- named / run-records:own (shell, event line 224 2026-10-02T10:51:04Z): `ls -la <repo>/.postmaster/runs/201/ 2>/dev/null | head -30; echo`
- named / run-records:own (shell, event line 224 2026-10-02T10:51:04Z): `| head -30; echo '===='; find <repo>/.postmaster/runs/201 -name '*verify*' -o -name '*g`

### #216 mimo

- refs / branch-list (shell, event line 4 2026-10-03T16:07:27Z): `git branch -a | head -20 && git rev-parse HEAD && git rev-parse --abbrev-ref HEAD`

### #217 mimo

- named / postmaster-private:drafts (read, event line 10 2026-10-03T23:32:03Z): `(private path, not recorded)`

### #237 luna

- outside / postmaster-private:config.toml (shell, event line 561): ` 'postmaster.fixture|fixture' ~/.postmaster/config.toml 2>/dev/null || true"`
- outside / postmaster-private:config.toml (shell, event line 561): ` 'postmaster.fixture|fixture' ~/.postmaster/config.toml 2>/dev/null || true"`
- outside / postmaster-private:config.toml (shell, event line 574): `onfig.example.toml && test -f ~/.postmaster/config.toml && printf 'machine-config-pre`

### #237 mimo

- refs / log-all (shell, event line 106 2026-10-04T04:29:33Z): `cd <repo> && git log --oneline --all -30 | head -40; echo ===; git log --all --grep="fixture" --oneline | head -20; `
- outside / postmaster-private:config.toml (shell, event line 103 2026-10-04T04:29:04Z): `s|^coachman|^ *[a-z_]+ *= *"' ~/.postmaster/config.toml | grep -v -i 'key\|token\|sec`
- outside / run-records:other (shell, event line 126 2026-10-04T04:32:59Z): `grep -h "todo-fixture-39" <repo>/.postmaster/runs/ledger.jsonl 2>/dev/null | head -5; echo =`
- outside / run-records:other (shell, event line 126 2026-10-04T04:32:59Z): ` ===; grep -rn "todo-fixture" <repo>/.postmaster/runs/ledger.jsonl | tail -8; echo ===; ls ~/Cod`
- refs-other / branch-list (unresolved) (shell, event line 998 2026-10-04T07:31:17Z): `1 && D=$F/.postmaster/runs/1 && WT=$F/.worktrees/1 && \ echo "--- branches:" && git -C "$F" branch --list | sed 's/^ *//' && grep -E "^\\| branch|^- branch|Branch" "$D/ca`
- refs-other / worktree-list (unresolved) (shell, event line 1030 2026-10-04T07:33:56Z): `echo "== $w"; git -C "$F/.worktrees/$w" status --porcelain | head -4; fi; done; git -C "$F" worktree list`

### #252 mimo

- refs-other / worktree-list (unresolved) (shell, event line 190 2026-10-04T05:13:54Z): `mp pmt252-XXXX) && bash .postmaster/verify/build-r.sh "$T1" && echo BUILD-OK && git -C "$T1/repo" worktree list && ls "$T1/repo/.worktrees" && "$PWD/scripts/local.sh" "$T`
- refs-other / worktree-list (unresolved) (shell, event line 196 2026-10-04T05:14:26Z): `mp pmt252-XXXX) && bash .postmaster/verify/build-r.sh "$T1" && echo BUILD-OK && git -C "$T1/repo" worktree list && ls "$T1/repo/.worktrees" && "$PWD/scripts/local.sh" "$T`
- refs-other / log-all (unresolved) (shell, event line 202 2026-10-04T05:14:47Z): `etached worktree git -C $O commit -qm "oracle staged copy" echo "--- rev-list"; git -C $O rev-list HEAD --not --branches; echo exit=$? echo "--- format-patch --not --bran`

### #258 mimo

- refs / log-all (shell, event line 185 2026-10-04T09:44:23Z): `cd <repo>/.worktrees/258-mimo && git log --format=%H --all -- scripts/launch.sh | head -3`
- refs / log-all (shell, event line 193 2026-10-04T09:44:34Z): `cd <repo>/.worktrees/258-mimo && for c in $(git log --format=%H --all -- scripts/launch.sh | head -10); do if git cat-file -e $c:scripts/launch.sh 2>`
- refs / log-all (shell, event line 197 2026-10-04T09:44:45Z): `cd <repo>/.worktrees/258-mimo && git log --format=%H --all -- scripts/local.sh | while read c; do if git cat-file -e $c:scripts/local.sh 2`
- refs-other / ls-remote (elsewhere) (shell, event line 916 2026-10-04T10:27:06Z): `git ls-remote --tags https://github.com/bminor/bash.git 2>&1 | grep -E "refs/tags/bash-3\.2$"`
- refs-other / ls-remote (elsewhere) (shell, event line 919 2026-10-04T10:27:14Z): `git ls-remote --tags https://github.com/bminor/bash.git 2>&1 | grep "3\.2" | head -10; echo =`

### #259 mimo

- outside / postmaster-private:config.toml (shell, event line 638 2026-10-04T11:13:24Z): ` echo ===; grep -rn "confine" ~/.postmaster/config.toml 2>/dev/null; grep -n "confine`

### #265 mimo

- shared / 265 (shell, event line 220 2026-10-04T13:04:11Z): `ls -la <repo>/.worktrees/265/scripts/fixture-time-oracle* 2>/dev/null; git -C <repo>/.`
- shared / 265 (shell, event line 220 2026-10-04T13:04:11Z): `wick/postmaster/.worktrees/265/scripts/fixture-time-oracle* 2>/dev/null; git -C <repo>/.worktrees/265 log --oneline -5 2>/dev/null; echo ===; wc -l <repo>/.wor`
- shared / 265 (shell, event line 220 2026-10-04T13:04:11Z): `dlewick/postmaster/.worktrees/265 log --oneline -5 2>/dev/null; echo ===; wc -l <repo>/.worktrees/265/scripts/fixture-time-oracle.ts`
- refs / worktree-list (shell, event line 216 2026-10-04T13:03:26Z): `ome/brindlewick/postmaster/.postmaster/runs/265/actions.jsonl | head; echo ===; git -C <repo> worktree list 2>/dev/null | head -30`
- outside / run-records:own (shell, event line 203 2026-10-04T13:01:03Z): `ns/ 2>/dev/null; echo ===; ls <repo>/.postmaster/runs/265/ 2>/dev/null`
- outside / run-records:own (shell, event line 206 2026-10-04T13:01:25Z): `ls -la <repo>/.postmaster/runs/265/logs/ ~/postm`
- outside / run-records:own (shell, event line 206 2026-10-04T13:01:25Z): `er/.postmaster/runs/265/logs/ <repo>/.postmaster/runs/265/render/ ~/pos`
- refs-other / branch-list (unresolved) (shell, event line 483 2026-10-04T14:29:48Z): `des"; grep -c '"action":"degrade"' $DISPATCH/actions.jsonl echo "--- branches"; git -C $REPO branch --list '1' 'wb/1-*' | tr -d ' *' echo "--- already-landed"; scripts/ru`
- refs-other / worktree-list (unresolved) (shell, event line 511 2026-10-04T14:32:41Z): ` "removed 1-mimo" git -C $REPO worktree remove .worktrees/1 && echo "removed 1" git -C $REPO worktree list scripts/run log-action $DISPATCH postmaster teardown "1" "remov`
- refs-other / worktree-list (unresolved) (shell, event line 514 2026-10-04T14:32:54Z): `una git -C $REPO worktree remove .worktrees/1-scratch-mimo && echo removed-mimo git -C $REPO worktree list scripts/run log-action $DISPATCH postmaster teardown "1" "remov`

### #266 mimo

- named / postmaster-private:config.toml (shell, event line 744 2026-10-04T12:34:08Z): `ing checks old = '''```sh cat ~/.postmaster/config.toml 2>/dev/null || echo "NOT SET `
- named / postmaster-private:config.toml (shell, event line 744 2026-10-04T12:34:08Z): `" s = s.replace(old, '''Read `~/.postmaster/config.toml` yourself — a missing file me`
- named / postmaster-private:config.toml (shell, event line 750 2026-10-04T12:34:56Z): `ening checks rep('''```sh cat ~/.postmaster/config.toml 2>/dev/null || echo "NOT SET `

### #268 mimo

- shared / 268 (read, event line 3 2026-10-04T09:59:50Z): `<repo>/.worktrees/268/WORKHORSE-SPEC.md`
- shared / 268 (shell, event line 4 2026-10-04T09:59:51Z): `ls -la <repo>/.worktrees/268`
- shared / 268 (shell, event line 7 2026-10-04T09:59:55Z): `ls -la <repo>/.worktrees/268/.postmaster/ <repo>/.worktrees/268/scripts/ 2>&1 | head -`
- refs / log-all (shell, event line 52 2026-10-04T10:16:18Z): `cd <repo>/.worktrees/268 && git log --oneline --all --grep="fixture" | head -20; echo ===; git log --oneline -5; echo ===; git stat`
- refs / log-all (shell, event line 56 2026-10-04T10:16:31Z): `wick/postmaster/.worktrees/268 && git show 719497b --stat | head -20; echo ===; git log --all --oneline --grep="fixture run" | head; echo ===; grep -rn "fixture" raw/READ`
- refs / log-all (shell, event line 60 2026-10-04T10:16:42Z): `cd <repo>/.worktrees/268 && git log --all --diff-filter=A --oneline -- "*/WORKHORSE-SUMMARY.md" | head; echo ===; for c i`
- outside / postmaster-private:config.toml (shell, event line 52 2026-10-04T10:16:18Z): `--short | head; echo ===; cat ~/.postmaster/config.toml 2>/dev/null | head -60`
- outside / run-records:own (shell, event line 83 2026-10-04T10:24:54Z): `ns/ 2>/dev/null; echo ===; ls <repo>/.postmaster/runs/268/ 2>/dev/null | head -30; echo`
- outside / run-records:own (shell, event line 83 2026-10-04T10:24:54Z): `ull | head -30; echo ===; cat <repo>/.postmaster/runs/268/checks.json 2>/dev/null | hea`

### #270 mimo

- outside / postmaster-private:config.toml (shell, event line 74 2026-10-04T19:25:01Z): `cat ~/.postmaster/config.toml 2>/dev/null | head -70; echo `
- outside / postmaster-private:config.toml (shell, event line 636 2026-10-04T21:10:04Z): `python3 - << 'PY' src = open("~/.postmaster/config.toml").read() assert 'mode =' not `
- refs-other / branch-list (unresolved) (shell, event line 703 2026-10-04T21:40:25Z): `tures/270-synth; git -C $R log --format='%H %s' main..1 2>/dev/null; echo ====; git -C $R branch -a | head; echo ====; tail -6 $R/.postmaster/runs/1/actions.jsonl | pytho`
- refs-other / branch-list (elsewhere) (shell, event line 796 2026-10-04T22:06:24Z): `git -C ~/Code/fixtures/270-synth branch -a; echo ====; git -C ~/Code/fixtures/270-synth worktree list; ech`
- refs-other / worktree-list (elsewhere) (shell, event line 796 2026-10-04T22:06:24Z): `git -C ~/Code/fixtures/270-synth branch -a; echo ====; git -C ~/Code/fixtures/270-synth worktree list; echo ====; grep -n "wb/" ~/Code/fixtures/270-synth/.postmaster`

