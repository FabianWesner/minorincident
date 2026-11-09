#!/usr/bin/env bash
set -eu
tar -xzf docs/reports/r17-l7escort/evidence/main-l7-runtime.tar.gz
python3 - <<'PY'
p = 'src/data/l7.ts'
s = open(p).read()
assert s.count('damage: 34, shoveTicks: 45') == 1
open(p, 'w').write(s.replace('damage: 34, shoveTicks: 45', 'damage: 17, shoveTicks: 45'))
PY
node --import tsx/esm tools/qa/r17-l7diff.ts escort-bite17 both 1,2,3
