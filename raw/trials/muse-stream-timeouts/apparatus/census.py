# Census of Muse Code model attempts from local-tracing logs: duration, outcome, stream stats.
import re, glob, sys, os, collections
KV = re.compile(r'(\w+)=("([^"]*)"|\S+)')
def kv(line):
    return {m.group(1): (m.group(3) if m.group(3) is not None else m.group(2)) for m in KV.finditer(line)}
rows = []
for path in sorted(glob.glob(os.path.expanduser('~/.postmaster/harness-data/muse/*/muse/local-tracing/bootstrap/*.log*'))):
    key = path.split('/muse/')[1] if False else path.split('harness-data/muse/')[1].split('/')[0]
    last_term = None; opens = {}
    for line in open(path, errors='replace'):
        if 'event="provider_stream.terminal"' in line:
            last_term = kv(line); last_term['_ts'] = line[:27]
        elif 'event="model.attempt.lifecycle"' in line and 'phase="terminal"' in line:
            d = kv(line)
            rows.append(dict(key=key, ts=line[:27], run=d.get('run_id'), step=d.get('step'), outcome=d.get('outcome'), reason=d.get('reason'),
                             dur=int(d.get('duration_ms', 0)), ev=(last_term or {}).get('wire_events_seen'), bytes=(last_term or {}).get('bytes_read'),
                             ttfe=(last_term or {}).get('time_to_first_event_ms'), term=(last_term or {}).get('terminal'), treason=(last_term or {}).get('reason'),
                             main=not d.get('task_id', '').startswith('018f0000')))
            last_term = None
print('attempts', len(rows))
c = collections.Counter((r['outcome'], r['reason']) for r in rows); print(c.most_common())
main = [r for r in rows if r['main']]
print('main-thread attempts', len(main))
buckets = collections.Counter()
for r in main:
    b = min(r['dur'] // 30000 * 30, 330)
    buckets[(b, r['outcome'] == 'timed_out')] += 1
for b in range(0, 360, 30):
    print(f'{b:3d}-{b+30:3d}s ok={buckets[(b, False)]:5d} timed_out={buckets[(b, True)]}')
print('longest successful:')
for r in sorted(main, key=lambda r: -r['dur'])[:25]:
    print(r['ts'], r['key'], r['dur']/1000, r['outcome'], r['reason'], 'ev', r['ev'], 'bytes', r['bytes'], 'ttfe', r['ttfe'])

print()
print('wire events vs duration (main thread, successful):')
import statistics
by = collections.defaultdict(list)
for r in main:
    if r['ev'] is None: continue
    by[min(r['dur']//20000*20, 300)].append(int(r['ev']))
for b in sorted(by):
    v = by[b]
    print(f'{b:3d}-{b+20:3d}s n={len(v):4d} events median={statistics.median(v):5.1f} max={max(v):3d} min={min(v):3d}')
ev = collections.Counter(int(r['ev']) for r in main if r['ev'])
print('max wire events seen in any main attempt:', max(ev))
print('attempts with >=45 events:', sum(c for e, c in ev.items() if e >= 45), 'with >=57:', sum(c for e, c in ev.items() if e >= 57))
