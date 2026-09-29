#!/usr/bin/env python3
"""Per-response wire timeline from a MUSE_TRANSPORT_TRACE stderr log (lines timestamped by run.py).
Attributes each SSE event to its response by response.id or by the rs_<resp> prefix of item ids;
message and function-call items go to the response whose reasoning item was last seen."""
import json, re, sys
path = sys.argv[1]; verbose = '-v' in sys.argv
streams = {}; order = []; last_rs = None; t0 = None
for line in open(path, errors='replace'):
    m = re.match(r'(\d+\.\d+) (REQUEST|SSE RESPONSE): (.*)', line.rstrip('\n'))
    if not m: continue
    t = float(m.group(1)); t0 = t0 or t
    if m.group(2) == 'REQUEST':
        try: key = json.loads(m.group(3)).get('prompt_cache_key', '')
        except Exception: key = re.search(r'"prompt_cache_key":"([^"]*)"', m.group(3)); key = key.group(1) if key else '?'
        order.append(('req', t, key)); continue
    raw = m.group(3); ev = re.search(r'event: ([\w.]+)', raw); ev = ev.group(1) if ev else 'data'
    rid = re.search(r'"id":"(resp_[0-9a-f]+)"', raw) if ev in ('response.created', 'response.in_progress', 'response.completed', 'response.failed', 'response.incomplete') else None
    if rid: rid = rid.group(1)
    else:
        im = re.search(r'rs_(resp_)?([0-9a-f]{24}):', raw) or re.search(r'"(?:item_id|id)":"rs_([0-9a-f]{24})', raw)
        rid = ('resp_' + im.group(im.lastindex)) if im else last_rs
    if ev in ('response.output_item.added',) and 'rs_' in raw: last_rs = rid
    s = streams.setdefault(rid, dict(events=[], first=t)); s['events'].append((t, ev))
for rid, s in streams.items():
    ev = s['events']; t_first = ev[0][0]; t_last = ev[-1][0]
    gaps = [(ev[i][0] - ev[i-1][0], ev[i-1][1], ev[i][1], ev[i-1][0] - t_first) for i in range(1, len(ev))]
    big = max(gaps, default=(0, '', '', 0))
    summ = [t for t, e in ev if e == 'response.reasoning_summary_part.added']
    print(f"{rid} start +{t_first - t0:7.1f}s dur {t_last - t_first:7.1f}s events {len(ev):3d} summaries {len(summ):2d} last-summary-at +{(summ[-1] - t_first) if summ else 0:6.1f}s max-gap {big[0]:6.1f}s after {big[1]} at +{big[3]:.1f}s -> {big[2]}")
    if verbose:
        for i, (t, e) in enumerate(ev):
            print(f"   +{t - t_first:7.2f}s gap {t - ev[i-1][0] if i else 0:6.2f} {e}")
