# Workhorses, fixture runs, on the hidden tests

| Run | Ranked | Hidden tests, first lane's branch | Hidden tests, second lane's branch | Hidden tests, merged result | Code share: first only / second only / shared / neither, % | Slower lane's extra wait, min |
| --- | --- | --- | --- | --- | --- | --- |
| fixture-15 | mimo, luna | 20/20 | 20/20 | 20/20 | 54.9 / 8.1 / 10.1 / 26.9 | 3 (mimo) |
| fixture-16 | mimo, luna | 20/20 | 20/20 | at base | 85.1 / 0 / 14.9 / 0 | 11 (mimo) |
| fixture-17 | mimo, luna | 20/20 | 20/20 | 20/20 | 86 / 0.1 / 10.1 / 3.8 | 2 (mimo) |
| fixture-18 | mimo, luna | 20/20 | 20/20 | 20/20 | 87 / 0.1 / 11.7 / 1.2 | 4 (mimo) |
| fixture-19 | mimo, sol | 20/20 | 20/20 | 20/20 | 79.7 / 0 / 20.3 / 0 | 8 (mimo) |
| fixture-20 | sol, mimo | 20/20 | 20/20 | 20/20 | 12.1 / 60.5 / 20.5 / 6.9 | – |
| fixture-21 | mimo, sol | 20/20 | 20/20 | 20/20 | 77.6 / 0 / 22.4 / 0 | 4 (mimo) |
| fixture-23 | mimo, sol | 20/20 | 20/20 | 20/20 | 62.1 / 13.7 / 23.2 / 0.9 | 9 (mimo) |
| fixture-24 | sol, mimo | 20/20 | 20/20 | 20/20 | 29.2 / 15.9 / 14.8 / 40.2 | 6 (mimo) |
| fixture-25 | sol, mimo | 20/20 | 20/20 | 20/20 | 56.8 / 6.4 / 17.8 / 19 | 4 (mimo) |
| fixture-26 | mimo, sol | 20/20 | 20/20 | 20/20 | 87.6 / 0.2 / 9.2 / 3 | – |
| fixture-27 | mimo, sol | 20/20 | 20/20 | 20/20 | 88 / 0 / 12 / 0 | 4 (mimo) |
| fixture-28 | mimo, sol | 20/20 | 20/20 | 20/20 | 56.9 / 13.7 / 23.5 / 5.8 | 8 (mimo) |
| fixture-29 | mimo, sol | at base | at base | 20/20 | 83.8 / 0.4 / 15 / 0.8 | 7 (mimo) |
| fixture-30 | mimo, sol | 20/20 | 20/20 | 20/20 | 85.3 / 1.8 / 12.8 / 0.1 | – |
| fixture-31 | mimo, sol | 20/20 | 20/20 | 20/20 | 62.8 / 0.8 / 12.8 / 23.5 | 8 (mimo) |
| fixture-32 | sol, mimo | 20/20 | 20/20 | 20/20 | 20.5 / 52.9 / 26.6 / 0 | – |
| fixture-33 | mimo, sol | 20/20 | 20/20 | 20/20 | 84.9 / 0 / 15.1 / 0 | – |
| fixture-34 | mimo, sol | 20/20 | 20/20 | 20/20 | 74 / 8.2 / 17.4 / 0.4 | 8 (mimo) |
| fixture-35 | mimo, sol | 20/20 | 20/20 | 20/20 | 24.8 / 12.3 / 22.6 / 40.3 | 4 (mimo) |
| fixture-36 | mimo, sol | 20/20 | 20/20 | 20/20 | 81.8 / 2.7 / 15.3 / 0.3 | 6 (mimo) |
| fixture-37 | mimo, astra | missing | missing | 20/20 | 78.7 / 0 / 11.2 / 10.1 | 35 (astra) |
| fixture-38 | astra, mimo | 20/20 | 20/20 | 20/20 | 71.6 / 1.4 / 17.9 / 9 | 7 (mimo) |
| fixture-39 | mimo, sol | 20/20 | 20/20 | 20/20 | 87 / 1.5 / 10.4 / 1.1 | – |

Of 22 runs whose lane branches could be scored, 22 had both lanes passing every hidden test (44 of 44 lane branches). The merged result passed in 23 of 23 runs that merged.
