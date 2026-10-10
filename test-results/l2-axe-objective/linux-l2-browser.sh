#!/bin/sh
set -eu
python3 - <<'INNER'
from pathlib import Path
p=Path('playwright.config.ts')
p.write_text(p.read_text().replace('deviceScaleFactor: 1', 'deviceScaleFactor: .5'))
p=Path('tests/e2e/fixtures.ts')
p.write_text(p.read_text().replace('dpr=1', 'dpr=.5'))
for p in Path('tests/e2e/levels').glob('*.spec.ts'):
 p.write_text(p.read_text().replace("'--use-angle=metal'", "'--use-angle=swiftshader', '--enable-unsafe-swiftshader'"))
INNER
npm run build
E2E_PORT=4437 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L2.spec.ts tests/e2e/levels/l2-apron-alarm.spec.ts tests/e2e/levels/l2-axe-findable.spec.ts tests/e2e/levels/l2-rescue-setpiece.spec.ts tests/e2e/smoke.spec.ts --project=chromium --workers=1
