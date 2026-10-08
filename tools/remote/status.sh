#!/bin/sh
# Pool overview: servers, job slots, load, idle time, price. Per-runner detail: ssh -i ~/.ssh/mi-runner runner@<ip>.
D=$(cd "$(dirname "$0")" && pwd)
python3 -I "$D/pool.py" status; python3 -I "$D/pool.py" cost
