import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, origin } from '../scenelab/session';
const s = new SceneSession();
try {
  await s.open();
  await s.page.route('**/surface-proof.html', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"><script type="module" src="/tools/look/footprints-surfaces-browser.ts"></script>' }));
  await s.page.goto(`${origin}/surface-proof.html`); await s.page.waitForFunction('Boolean(window.renderProof)');
  const rows = [];
  for (const kind of ['bridge', 'ground', 'wall', 'repeated']) {
    await s.page.evaluate(kind => (window as unknown as { renderProof(k: string): Promise<void> }).renderProof(kind), kind);
    const bytes = await s.page.locator('canvas').screenshot({ path: `test-results/footprints/surface-${kind}.png` });
    const png = PNG.sync.read(bytes); let pixels = 0;
    for (let i = 0; i < png.data.length; i += 4) if (png.data[i] > 20) pixels++;
    rows.push({ kind, pixels });
  }
  writeFileSync('test-results/footprints/surface-proof.json', JSON.stringify({ rows, errors: s.errors }, null, 2));
  if (rows[0].pixels < 100 || rows.slice(1).some(row => row.pixels !== 0) || s.errors.length) throw new Error(JSON.stringify({ rows, errors: s.errors }));
  console.log(JSON.stringify(rows));
} finally { await s.close(); stopServer(); }
