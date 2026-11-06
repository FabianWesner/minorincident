/**
 * fix68-a (L3-13): free inspection camera views of the raised corridor ramp (x 143..168) for diagnosis.
 * Usage: RAMP_TIER=high RAMP_OUT=test-results/fix68/x SCENE_PORT=... sh tools/e2e-lock.sh npx tsx tools/qa/fix68/l3-ramp-inspect.ts
 */
import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../../scenelab/session';

const tier = (process.env.RAMP_TIER ?? 'high') as 'low' | 'high', out = process.env.RAMP_OUT ?? `test-results/fix68/inspect-${tier}`;
mkdirSync(out, { recursive: true });
const views: Record<string, { position: [number, number, number]; target: [number, number, number] }> = {
  g150: { position: [161, 16, 15], target: [150, 4, 4.3] },
  g154: { position: [165, 16, 12.5], target: [154, 4.9, 1.65] },
  g158: { position: [169, 17, 8], target: [158, 5.7, -2.6] },
  top: { position: [155, 40, 0.1], target: [155, 3, 0] },
  se: { position: [165, 14, 14], target: [154, 4, 0] },
  nw: { position: [145, 14, -14], target: [156, 4, 0] },
  side: { position: [155, 8, 22], target: [155, 4, 0] },
  inner: { position: [170, 10, -2], target: [155, 4, 1] },
};
const s = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
try {
  await s.open(); await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async ({ tier, lod }) => {
    const a = window.__SS__!; a.settings.set({ quality: tier });
    await a.loadLevel('L3', { seed: 1, progression: 'L3-default' });
    a.missions.begin(); a.pause(); a.cheats.god(true);
    a.inspect.enable(true, { courier: 'ghost' }); a.inspect.timeScale(0); a.inspect.lod(lod as 'real' | 'game');
  }, { tier, lod: process.env.RAMP_LOD ?? 'game' });
  for (const [name, v] of Object.entries(views)) {
    await s.page.evaluate(async v => { const a = window.__SS__!; a.inspect.setCamera(v); await a.step(3); await a.screenshotReady(); }, v);
    await s.page.screenshot({ path: `${out}/${name}.png` });
  }
} finally { await s.close(); stopServer(); }
