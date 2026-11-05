/** L5-D1 game-camera before/after evidence, headless through the Scene Lab session. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const stage = process.argv[2] ?? 'after';
const dir = `test-results/epics/E23/l5-district/${stage}`;
mkdirSync(dir, { recursive: true });
const session = new SceneSession();
try {
  await session.open();
  await session.page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L5', { seed: 1, progression: 'L5-default' }); a.pause(); a.missions.begin(); await a.step(2);
    const p = a.getState().player!.transform;
    a.camera.cinematic({ position: [p.x + 4, 8, p.z - 5], target: [p.x - .6, .8, p.z + 1.5] }, true);
  });
  await session.screenshot(`${dir}/basement.png`);
  const pickup = await session.page.evaluate(() => window.__SS__!.query({ kind: 'pickup' }));
  await session.page.evaluate(async () => {
    const a = window.__SS__!; a.camera.follow(); a.teleport(1, { x: 37.8, z: -43.4 }); await a.step(2);
    a.camera.cinematic({ position: [49.8, 14, -30.4], target: [37.8, 1.5, -46.8] }, true);
  });
  await session.screenshot(`${dir}/metro-open.png`);
  await session.page.evaluate(async () => { const a = window.__SS__!; a.cheats.completeObjective('emerge'); await a.step(660); a.cheats.completeObjective('look'); a.teleport(1, { x: 37.8, z: -43.4 }); for (const e of a.query({}).filter(e => e.civilian?.survivor?.mode === 'follow')) a.teleport(e.id, { x: 37.8, z: -43.4 }); await a.step(122); a.camera.cinematic({ position: [49.8, 14, -30.4], target: [37.8, 1.5, -46.8] }, true); });
  await session.screenshot(`${dir}/metro-closed.png`);
  writeFileSync(`${dir}/metrics.json`, JSON.stringify({ pickup, errors: session.errors, perf: await session.page.evaluate(() => window.__SS__!.perf()) }, null, 2));
} finally { await session.close(); stopServer(); }
