#!/bin/bash
# status.sh <trial>... : exit line, per-response summary, terminal record, answer check
S=$(cd "$(dirname "$0")" && pwd)
for t in "$@"; do
  echo "== $t: $(cat $S/$t.out 2>/dev/null)"
  python3 $S/gaps.py $S/$t/stderr.log 2>/dev/null | awk '/summaries *[1-9]/' | tail -3
  python3 - "$S/$t/events.jsonl" "$S" <<'PY'
import json, sys, re, os
try: recs = [json.loads(l) for l in open(sys.argv[1])]
except FileNotFoundError: sys.exit()
for r in recs:
    if r['payload_type'].startswith('run.terminal'):
        txt = r['payload'].get('text') or ''
        print('   ', r['payload_type'], r['payload'].get('reason'), repr(txt[:100]))
        rows = re.findall(r'\b\d{9}\b', txt)
        for name in ('sudoku2', 'sudoku1'):
            f = os.path.join(sys.argv[2], name + '.solution')
            if os.path.exists(f) and len(rows) >= 9:
                sol = open(f).read().split()
                if rows[:9] == sol: print('    answer matches', name)
PY
done
