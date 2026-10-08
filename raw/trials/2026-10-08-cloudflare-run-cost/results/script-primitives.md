# Scripts by what they lean on

76 non-test scripts under scripts/ and scripts/lib/.

| What a script does | Scripts | Of |
| --- | --- | --- |
| starts child processes | 18 | 76 |
| signals processes or process groups | 9 | 76 |
| imports the shared process helpers (lib/proc, lib/processes) | 46 | 76 |
| reads /proc | 8 | 76 |
| uses systemd scopes or cgroup limits | 2 | 76 |
| wraps a harness in bwrap or sandbox-exec | 2 | 76 |
| drives herdr or tmux | 4 | 76 |
| makes symbolic links | 4 | 76 |
| writes or waits on marker, pid or lock files | 23 | 76 |
| runs git worktree commands | 19 | 76 |
| reads the home directory or ~/.postmaster | 21 | 76 |
