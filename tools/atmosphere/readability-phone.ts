/** Service-gate prompt capture; invoke under e2e-lock after build. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
const out = 'docs/reports/readability-w6b/phone', rows: object[] = [];
mkdirSync(out, { recursive: true });
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const landscape of [false, true]) {
    const profile = landscape ? 'landscape' : 'portrait';
    const s = new SceneSession({ backend, tier: 'low', phone: true, viewport: landscape ? { width: 844, height: 390 } : { width: 390, height: 844 }, query: { ui: '1' } });
    try {
      await s.open(); await s.load({ ...readSpec('tests/scenes/catalog/qa-w6-phone-gate.json'), camera: { mode: 'game', target: [91.3, 0, 15], zoom: .5 } });
      await s.step(30); await s.ready();
      const prompt = s.page.locator('[data-testid=interaction-prompt]');
      const caption = await prompt.innerText();
      if (!await prompt.isVisible() || !caption.includes('ACTION to close the gate') || /\bE\b/.test(caption)) throw new Error(`Wrong touch gate prompt: ${caption}`);
      const rect = await prompt.boundingBox();
      const viewport = s.page.viewportSize()!;
      if (!rect || rect.x < 0 || rect.y < 0 || rect.x + rect.width > viewport.width || rect.y + rect.height > viewport.height) throw new Error('Gate prompt outside viewport');
      await s.page.screenshot({ path: `${out}/${backend}-${profile}.png` });
      rows.push({ backend, profile, caption, rect, errors: s.errors });
      if (s.errors.length) throw new Error(s.errors.join('\n'));
      console.log(`${backend} ${profile}: ${caption}`);
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/index.json`, JSON.stringify(rows, null, 2)); }
