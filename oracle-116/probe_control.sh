#!/usr/bin/env bash
# A launch within the caps: a few children, a little memory, clean exit.
set -uo pipefail
for _ in 1 2 3 4 5; do ( sleep 1 ) & done
python3 -c "b = bytearray(50*1024*1024); b[::4096] = b'\x01' * (len(b)//4096); print(len(b))"
wait
echo "CONTROL-OK"
