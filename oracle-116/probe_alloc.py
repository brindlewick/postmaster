#!/usr/bin/env python3
# Allocate without end, self-bounded: hold up to argv[1] MB in touched 100MB
# chunks. Prints HELD_MB=<n>. Exits 0 only if the bound is reached with no
# trip; a MemoryError (allocation refused) exits 3; an OOM kill dies by signal.
import sys

bound_mb = int(sys.argv[1]) if len(sys.argv) > 1 else 6144
CHUNK = 100 * 1024 * 1024
held = []
try:
    while sum(len(c) for c in held) < bound_mb * 1024 * 1024:
        b = bytearray(CHUNK)
        for off in range(0, CHUNK, 4096):
            b[off] = 1
        held.append(b)
        # Progress per chunk, flushed: an OOM kill leaves no final line.
        print("MB=%d" % (sum(len(c) for c in held) // (1024 * 1024)), flush=True)
except MemoryError:
    print("HELD_MB=%d" % (sum(len(c) for c in held) // (1024 * 1024)), flush=True)
    sys.exit(3)
print("HELD_MB=%d" % (sum(len(c) for c in held) // (1024 * 1024)), flush=True)
sys.exit(0)
