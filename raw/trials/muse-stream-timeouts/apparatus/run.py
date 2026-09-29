#!/usr/bin/env python3
"""Run one muse exec launch for a trial: stdout JSONL to <out>/events.jsonl with an arrival
timestamp per line (<out>/events.ts), stderr lines timestamped to <out>/stderr.log, and
<out>/meta.json with the argv, env overrides, start, end and exit code."""
import json, os, subprocess, sys, threading, time
out = sys.argv[1]; envs = {}; args = sys.argv[2:]
while args and '=' in args[0] and not args[0].startswith('-'):
    k, v = args.pop(0).split('=', 1); envs[k] = v
os.makedirs(out, exist_ok=True)
env = dict(os.environ); env.update(envs); env.setdefault('MUSE_NO_AUTO_UPDATE', '1')
env.setdefault('XDG_DATA_HOME', os.path.join(out, 'data'))
t0 = time.time()
p = subprocess.Popen(['muse', 'exec'] + args, stdin=subprocess.PIPE if env.get('TRIAL_STDIN') else subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, cwd=env.get('TRIAL_CWD', out))
def pump(stream, path, tspath=None):
    with open(path, 'wb') as f, (open(tspath, 'w') if tspath else open(os.devnull, 'w')) as ts:
        for line in iter(stream.readline, b''):
            now = time.time()
            if tspath:
                f.write(line); ts.write('%.6f\n' % now)
            else:
                f.write(b'%.6f ' % now + line)
            f.flush(); ts.flush()
a = threading.Thread(target=pump, args=(p.stdout, os.path.join(out, 'events.jsonl'), os.path.join(out, 'events.ts')))
b = threading.Thread(target=pump, args=(p.stderr, os.path.join(out, 'stderr.log')))
a.start(); b.start()
if env.get('TRIAL_STDIN'):
    p.stdin.write(env['TRIAL_STDIN'].encode()); p.stdin.close()
rc = p.wait(); a.join(); b.join()
json.dump(dict(argv=['muse', 'exec'] + args, env=envs, start=t0, end=time.time(), rc=rc), open(os.path.join(out, 'meta.json'), 'w'), indent=1)
print(out, 'rc', rc, 'secs %.1f' % (time.time() - t0))
