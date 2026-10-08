# What that time costs on Cloudflare Containers

Rates: [pricing.mdx at cloudflare-docs 6e1b964](https://github.com/cloudflare/cloudflare-docs/blob/6e1b96433cf016efd2c0c9057a7e27a8e112376f/src/content/docs/containers/platform/pricing.mdx),
read 2026-10-08. Memory and disk are charged for what the instance type provisions, for as long as
the instance runs; CPU for active use only. The tables bracket CPU use at none, a quarter and all
vCPUs busy, since the audit holds no CPU measurement.

## One running hour

| Instance type | vCPU | Memory, GiB | Disk, GB | $ per hour, CPU 0% busy | $ per hour, CPU 25% busy | $ per hour, CPU 100% busy |
| --- | --- | --- | --- | --- | --- | --- |
| lite | 0.0625 | 0.25 | 2 | 0.003 | 0.004 | 0.007 |
| basic | 0.25 | 1 | 4 | 0.010 | 0.015 | 0.028 |
| standard-1 | 0.5 | 4 | 8 | 0.038 | 0.047 | 0.074 |
| standard-2 | 1 | 6 | 12 | 0.057 | 0.075 | 0.129 |
| standard-3 | 2 | 8 | 16 | 0.076 | 0.112 | 0.220 |
| standard-4 | 4 | 12 | 20 | 0.113 | 0.185 | 0.401 |

## The median real run's container time

Lanes and reviewers at the median run's seconds from the audit. The coachman's process time is not recorded for every launch, so it is bracketed. The floor
is the sum, over a run's coachman threads, of the last process's uptime from each thread's session
export: the median of 14 runs is 3.6 hours. The ceiling is the seconds in the stages
a leg can run in (the wait for the user's spec review included) over the same 14 runs: a median of
18.8 hours. The 4 runs without session exports are the longest by stage seconds; over all
18 runs the ceiling's median is 23.8 hours, which would raise the top of every cell
below (the largest cell, all standard-4 with every vCPU busy, from $9.60
to $12). The cost tables use the floor and the ceiling of the same 14 runs.
The gates run inside these launches and add nothing of their own. List rates, with no monthly
allowance taken off. Each cell reads "coachman at its floor to coachman at its ceiling".

| Scenario | Lanes | Reviewers | Coachman | Run total, $ (CPU 0% busy) | Run total, $ (CPU 25% busy) | Run total, $ (CPU 100% busy) |
| --- | --- | --- | --- | --- | --- | --- |
| all standard-2 | standard-2 | standard-2 | standard-2 | 0.50 to 1.37 | 0.65 to 1.80 | 1.12 to 3.09 |
| all standard-3 | standard-3 | standard-3 | standard-3 | 0.66 to 1.82 | 0.98 to 2.68 | 1.92 to 5.27 |
| all standard-4 | standard-4 | standard-4 | standard-4 | 0.98 to 2.71 | 1.61 to 4.43 | 3.49 to 9.60 |
| lanes and reviewers standard-3, coachman standard-4 | standard-3 | standard-3 | standard-4 | 0.79 to 2.52 | 1.24 to 4.06 | 2.56 to 8.67 |

## The median fixture run

The audit holds no session uptime for fixture runs, so the coachman is bracketed by zero and the
median fixture run's stage seconds (1.6 hours).

| Scenario | Lanes | Reviewers | Coachman | Run total, $ (CPU 0% busy) | Run total, $ (CPU 25% busy) | Run total, $ (CPU 100% busy) |
| --- | --- | --- | --- | --- | --- | --- |
| all standard-2 | standard-2 | standard-2 | standard-2 | 0.06 to 0.15 | 0.08 to 0.20 | 0.14 to 0.34 |
| all standard-3 | standard-3 | standard-3 | standard-3 | 0.08 to 0.20 | 0.12 to 0.30 | 0.23 to 0.58 |
| all standard-4 | standard-4 | standard-4 | standard-4 | 0.12 to 0.30 | 0.20 to 0.49 | 0.42 to 1.06 |
| lanes and reviewers standard-3, coachman standard-4 | standard-3 | standard-3 | standard-4 | 0.08 to 0.26 | 0.12 to 0.41 | 0.23 to 0.87 |
