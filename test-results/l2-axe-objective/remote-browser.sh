#!/bin/sh
set -eu
export E2E_PORT=4327
# GPU driver selection for this ephemeral Linux workspace. No gameplay assertion changes.
python3 - <<'PY'
from pathlib import Path
for p in Path('tests/e2e/levels').glob('*.spec.ts'):
    s = p.read_text()
    p.write_text(s.replace("'--use-angle=metal'", "'--use-angle=swiftshader', '--enable-unsafe-swiftshader'"))
PY
npm run build
sh tools/e2e-lock.sh npx playwright test tests/e2e/levels tests/e2e/smoke.spec.ts --project=chromium --workers=2
