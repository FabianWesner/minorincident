import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
/** Teleport probe: SCENE_PORT=3489 sh tools/e2e-lock.sh tsx tools/qa/l10-probe.ts <tier> x,z [x,z...]  -> test-results/qa-l10-play/probe-<tier>-<x>-<z>.png (game camera). */
const [tier, ...pts] = process.argv.slice(2); mkdirSync('test-results/qa-l10-play', { recursive: true });
const s = new SceneSession({ tier: tier as 'high' | 'low', viewport: { width: 960, height: 540 } });
try {
  await s.open(); const p = s.page;
  await p.evaluate(async () => { await window.__SS__!.loadLevel('L10', { seed: 32, checkpoint: 'cure-residential' }); window.__SS__!.pause(); window.__SS__!.cheats.god(true); window.__SS__!.camera.follow(); });
  for (const pt of pts) {
    const [x, z] = pt.split(',').map(Number);
    await p.evaluate(async ({ x, z }) => { window.__SS__!.teleport('player', { x, z }); await window.__SS__!.step(240); }, { x, z });
    await s.screenshot(`test-results/qa-l10-play/probe-${tier}-${x}-${z}.png`);
  }
  console.log('errors', s.errors.length);
} finally { await s.close(); await stopServer(); }
