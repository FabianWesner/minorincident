#!/usr/bin/env bash
set -eu
case "${1:-}" in 5|8) ;; *) exit 64;; esac
tar -xzf docs/reports/r17-l7escort/evidence/main-l7-runtime.tar.gz
python3 - "$1" <<'PY'
import sys
p = 'src/data/l7.ts'
s = open(p).read()
assert s.count('damage: 34, shoveTicks: 45') == 1
open(p, 'w').write(s.replace('damage: 34, shoveTicks: 45', f'damage: {int(sys.argv[1])}, shoveTicks: 45'))
p = 'src/debug/bot/LevelSevenBot.ts'
s = open(p).read()
assert s.count('this.waypoint >= 3 ? .3 : 2') == 1
open(p, 'w').write(s.replace('this.waypoint >= 3 ? .3 : 2', 'this.waypoint >= 3 ? .7 : 2'))
PY
node --import tsx/esm tools/qa/r17-l7diff.ts "escort-bite$1" both 1,2,3
