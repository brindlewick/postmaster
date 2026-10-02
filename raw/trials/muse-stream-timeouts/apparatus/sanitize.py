#!/usr/bin/env python3
"""Filter: replace machine paths in recorded text with placeholders, and drop anything that
names the account's subscription."""
import re, sys
SUBS = [
    (re.compile(r'/tmp/claude-\d+/[^/\s"]+/[0-9a-f-]{36}/scratchpad/trials'), '<trial>'),
    (re.compile(r'/tmp/claude-\d+/[^/\s"]+/[0-9a-f-]{36}/scratchpad'), '<scratch>'),
    (re.compile(r'/home/[^/\s]+/\.postmaster/harness-data'), '<harness-data>'),
    (re.compile(r'/home/[^/\s]+/\.postmaster/runs/postmaster'), '<runs>'),
    (re.compile(r'/home/[^/\s]+/postmaster'), '<repo>'),
    (re.compile(r'/home/[^/\s]+'), '~'),
    (re.compile(r'fbcode/musecode/build/src/crates/'), ''),
]
for line in sys.stdin:
    if 'subscription_usage' in line or '"tier"' in line:
        continue
    for rx, rep in SUBS:
        line = rx.sub(rep, line)
    sys.stdout.write(line)
