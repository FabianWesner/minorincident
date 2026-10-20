import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import routes from '../../layouts/D-CURE/routes.json' with { type: 'json' };
/**
 * look-l10 game-camera sweep: every L10 region station at player zooms 0.5 / 1 / 1.5, one tier and backend per run.
 * SCENE_SERVER=preview SCENE_PORT=3471 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/l10-look.ts <label> <high|low> <webgl2|webgpu> [station,...]
 * -> test-results/look-l10/<label>/<backend>-<tier>/<station>-z<zoom>.jpg plus one sheet per region.
 */
const [label = 'after', tier = 'high', backend = 'webgl2', only] = process.argv.slice(2);
export const stations: { id: string; region: string; at: [number, number] }[] = [
  { id: 'r1-crash', region: 'crash', at: [552, 4] },
  { id: 'r1-verge', region: 'crash', at: [640, 8] },
  { id: 'r2-security', region: 'approach', at: [782, 30] },
  { id: 'r2-detour', region: 'approach', at: [930, 80] },
  { id: 'r3-depot', region: 'approach', at: [1300, 40] },
  { id: 'r3-yard', region: 'approach', at: [1560, 100] },
  { id: 'r4-post', region: 'approach', at: [1880, 25] },
  { id: 'r4-breach', region: 'approach', at: [2150, -75] },
  { id: 'r5-entry', region: 'campus', at: [2530, 20] },
  { id: 'r5-terminal', region: 'campus', at: [2700, 45] },
  { id: 'r6-supply', region: 'approach', at: [2950, 0] },
  { id: 'r6-breach', region: 'approach', at: [3300, 95] },
  { id: 'r7-entry', region: 'complex', at: [3760, -30] },
  { id: 'r7-console', region: 'complex', at: [4002, -18] },
  { id: 'r7-epilogue', region: 'epilogue', at: [4020, 4] },
];
/** `walk`: one station every 320 m of the critical route (between anchors, where most play happens). */
const walk = (() => {
  const pts = routes.regions.flatMap((r, i) => (i ? r.route.slice(1) : r.route) as [number, number][]), out: typeof stations = [];
  let carry = 160;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (carry <= d) { const t = carry / d; out.push({ id: `walk-${out.length}`, region: `walk${Math.floor(out.length / 4)}`, at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] }); carry += 320; }
    carry -= d;
  }
  return out;
})();
const picked = only === 'walk' ? walk : only ? stations.filter(s => only.split(',').includes(s.id)) : stations;
const out = `test-results/look-l10/${label}/${backend}-${tier}`; mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier: tier as 'high' | 'low', backend: backend as Backend, viewport: { width: 1280, height: 720 } });
const zooms = only === 'walk' ? [1] : [0.5, 1, 1.5];
const metrics: unknown[] = [];
try {
  await session.open(); const p = session.page;
  await p.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-crash' }); if (a.missions.state()?.phase === 'briefing') a.missions.begin(); a.pause(); a.cheats.god(true); a.camera.follow(); });
  const cells = new Map<string, { frame: number; jpeg: Buffer }[]>();
  for (const s of picked) {
    await p.evaluate(async ({ x, z }) => { const a = window.__SS__!; a.teleport('player', { x, z }); a.camera.follow(); await a.step(240); }, { x: s.at[0], z: s.at[1] });
    for (const zoom of zooms) {
      await p.mouse.move(640, 360);
      // Wheel notches are 0.14 in log space and clamp at the 0.5 / 1.5 limits; reset to 1 by going wide then back.
      for (let i = 0; i < 8; i++) await p.mouse.wheel(0, -120);
      const notches = zoom === 0.5 ? 0 : zoom === 1 ? 5 : 8;
      for (let i = 0; i < notches; i++) await p.mouse.wheel(0, 120);
      await p.evaluate(() => window.__SS__!.step(45));
      const jpeg = await session.snapshot();
      writeFileSync(`${out}/${s.id}-z${zoom}.jpg`, jpeg);
      const perf = await p.evaluate(() => { const a = window.__SS__!, f = a.perf(), cam = (a.getState().render as unknown as { camera?: { zoom?: number } }).camera; return { draws: f.drawCalls, triangles: f.triangles, zoom: cam?.zoom, lighting: f.lighting }; });
      metrics.push({ station: s.id, ...perf, zoom });
      const key = s.region; if (!cells.has(key)) cells.set(key, []); cells.get(key)!.push({ frame: Number(`${picked.indexOf(s)}${zooms.indexOf(zoom)}`), jpeg });
    }
  }
  for (const [region, list] of cells) await session.makeSheet(list, `${out}/sheet-${region}.jpg`, 420, 700);
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ errors: session.errors, metrics }, null, 1));
  console.log('errors', session.errors.length, JSON.stringify(metrics));
} finally { await session.close(); stopServer(); }
