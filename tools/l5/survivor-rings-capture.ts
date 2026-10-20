/** L5 look-step survivor ring evidence: game camera at zoom 1, 1.5 and 0.5 (wheel clamps), per backend and quality tier.
 *  usage: tsx tools/l5/survivor-rings-capture.ts <webgl2|webgpu> <high|low> [outDir] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
const backend = (process.argv[2] ?? 'webgl2') as Backend, tier = (process.argv[3] ?? 'high') as 'high' | 'low';
const dir = `${process.argv[4] ?? 'test-results/epics/E23/survivor-rings'}/${backend}-${tier}`;
mkdirSync(dir, { recursive: true });
const session = new SceneSession({ backend, tier });
const info: Record<string, unknown> = { backend, tier };
try {
  await session.open();
  await session.page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L5', { seed: 1, progression: 'L5-default' }); a.pause(); a.missions.begin(); await a.step(2);
    a.cheats.completeObjective('emerge'); await a.step(660);
    a.teleport(1, { x: -45, z: 37 }); await a.step(90); a.camera.follow();
  });
  const wheel = async (dy: number) => { await session.page.mouse.move(640, 360); for (let i = 0; i < 40; i++) await session.page.mouse.wheel(0, dy); await session.page.evaluate(() => window.__SS__!.step(120)); };
  await session.page.evaluate(() => window.__SS__!.step(60));
  await session.screenshot(`${dir}/zoom-1.png`);
  await wheel(100); await session.screenshot(`${dir}/zoom-1.5.png`);
  await wheel(-100); await session.screenshot(`${dir}/zoom-0.5.png`);
  info.perf = await session.page.evaluate(() => window.__SS__!.perf());
  info.errors = session.errors;
  writeFileSync(`${dir}/metrics.json`, JSON.stringify(info, null, 2));
} finally { await session.close(); stopServer(); }
