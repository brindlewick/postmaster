import json, sys, os, glob, re
T = sys.argv[1]
cases = [
 ('m0b', 'stall 3 s, silent', {}),
 ('m1', 'stall 200 s, silent, no content first', {}),
 ('m2', 'stall 20 s, silent, no content first', {'TBH_STREAM_IDLE_TIMEOUT_SECS': '5'}),
 ('m3', 'stall 200 s, silent, no content first', {'TBH_STREAM_IDLE_TIMEOUT_SECS': '600'}),
 ('m4', 'stall 200 s, an SSE comment every 10 s, no content first', {}),
 ('m5', 'stall 200 s, a reasoning summary every 10 s', {}),
 ('m6', 'summaries at 10 s and 20 s, then silent to 230 s', {'TBH_STREAM_IDLE_TIMEOUT_SECS': '600'}),
 ('m7', 'summaries at 10 s and 20 s, then silent to 230 s', {}),
 ('m8', 'summaries at 10 s and 20 s, then silent to 60 s', {'TBH_STREAM_IDLE_TIMEOUT_SECS': '5'}),
 ('m9', 'summaries at 10 s and 20 s, then an SSE comment every 10 s to 230 s', {}),
 ('m10', 'summaries at 10 s and 20 s, then silent to 90 s', {'TBH_STREAM_IDLE_TIMEOUT_SECS': '30'}),
 ('m11', 'stall 60 s, silent, no content first', {'TBH_STREAM_FIRST_EVENT_TIMEOUT_SECS': '20'}),
]
print('Muse Code 1.4.0-R4302.1 against apparatus/mock.py on loopback (--base-url), prompt "Say OK.",')
print('--reasoning-effort max, a throwaway key on stdin. Times are seconds from the main request.')
print('Every main response opens with response.created, response.in_progress and a reasoning item.')
print('A run marked "stopped" was ended by hand once its retry had been seen.')
for name, desc, env in cases:
    d = os.path.join(T, name)
    mp = os.path.join(d, 'meta.json')
    meta = json.load(open(mp)) if os.path.exists(mp) else {}
    print('\n=== %s: %s; env %s' % (name, desc, ' '.join('%s=%s' % kv for kv in env.items()) or 'none'))
    if meta: print('exit %s after %.1f s' % (meta['rc'], meta['end'] - meta['start']) + ('  (stopped)' if meta['rc'] in (143, -15) else ''))
    else: print('(stopped by hand; no exit recorded)')
    log = [json.loads(l) for l in open(os.path.join(d, 'mock.log'))]
    t0 = next((j['t'] for j in log if j['kind'] == 'request' and j.get('main')), None)
    for j in log:
        if j['kind'] == 'get' or t0 is None: continue
        what = ('request %d %s' % (j['n'], 'main' if j.get('main') else j.get('key', '').split(':')[1])) if j['kind'] == 'request' else ('stream %d ended: %s' % (j['n'], j['outcome']))
        print('  mock %+7.1f s  %s' % (j['t'] - t0, what))
    for l in open(os.path.join(d, 'events.jsonl')):
        r = json.loads(l)
        if r['payload_type'].startswith('run.terminal'):
            print('  muse run.terminal: %s, reason %s, text %r' % (r['payload']['terminal'], r['payload'].get('reason'), r['payload'].get('text')))
    for f in sorted(glob.glob(os.path.join(d, 'data/muse/local-tracing/bootstrap/*.log*'))):
        for l in open(f, errors='replace'):
            if 'event="model.attempt.lifecycle"' in l and '018f0000' not in l and 'phase="admission"' not in l:
                m = re.search(r'attempt=(\d+) .*phase="(\w+)" outcome="(\w+)" reason="(\w+)" next_attempt=(\d+) retry_delay_ms=(\d+) duration_ms=(\d+)', l)
                print('  muse attempt %s: %s %s %s, after %.3f s; next attempt %s after %s ms' % (m.group(1), m.group(2), m.group(3), m.group(4), int(m.group(7)) / 1000, m.group(5), m.group(6)))
