#!/bin/bash
# mockpair.sh <name> <port> <stall> <mode> <every> [ENV=VAL ...] : one mock and one muse launch against it
S=$(cd "$(dirname "$0")" && pwd); name=$1 port=$2 stall=$3 mode=$4 every=$5; shift 5
mkdir -p $S/$name/data/muse/model-catalog && cp $S/model-catalog.json $S/$name/data/muse/model-catalog/6d657461__p746268.json
python3 $S/mock.py --port $port --stall $stall --mode $mode --every $every --lead ${LEAD:-0} --log $S/$name/mock.log & mp=$!
sleep 1
TRIAL_STDIN=mock-key TRIAL_CWD=$S/ws timeout 900 $S/run.py $S/$name "$@" --json --prompt-file $S/p-ok.txt --model muse-spark-1.3-contributor --reasoning-effort max --yolo --api-key-stdin --base-url http://127.0.0.1:$port
sleep 2; kill $mp
