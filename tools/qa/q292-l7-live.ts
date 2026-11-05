/** Q-292 live L7: real mission at night, the courier walks toward the corridor encounter; the camera follows the
 * nearest infected that keeps a turned civilian look and the nearest archetype infected, 8 frames 0.25 s apart.
 * SCENE_PORT=4894 E2E_PORT=4893 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/q292-l7-live.ts <outDir> [low|high] [zoom,...]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.argv[2] ?? 'test-results/q292-live';
const tier = (process.argv[3] ?? 'low') as 'low' | 'high';
const zooms = (process.argv[4] ?? '1,1.5').split(',').map(Number);
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const s = new SceneSession({ backend: 'webgpu', tier, viewport: { width: 800, height: 600 }, deviceScaleFactor: 2, query: { level: 'L7' } });
try {
  await s.open();
  await s.page.evaluate('globalThis.__name = (fn) => fn');
  await s.page.evaluate(async (tier) => {
    const a = window.__SS__!; await a.loadLevel('L7', { seed: 2, progression: 'L7-default' });
    a.settings.set({ quality: tier }); a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow();
    // Skip the rocket walk: the encounter starts exactly as picking up the launcher does (l7.armed).
    (window.__SCENE__ as unknown as { game: Game }).game.world.l7Encounters!.start();
  }, tier);
  // Let the encounters spawn and close in (the courier stands at the start; infected come to her).
  const census = await s.page.evaluate(async () => {
    const a = window.__SS__!; const found: unknown[] = [];
    for (let i = 0; i < 24; i++) {
      await a.step(300);
      const hero = a.getEntity(1)!.transform;
      const inf = a.query({}).filter(e => e.infected && e.health.current > 0 && !e.corpse);
      found.push({ t: i * 5 + 5, n: inf.length, turned: inf.filter(e => (e as { appearance?: { entityId?: number } }).appearance?.entityId === e.id).length, near: inf.filter(e => Math.hypot(e.transform.x - hero.x, e.transform.z - hero.z) < 20).length });
      if (inf.filter(e => (e as { appearance?: { entityId?: number } }).appearance?.entityId === e.id).length >= 2) break;
    }
    return found;
  });
  console.log(JSON.stringify(census));
  for (const kind of ['turned', 'archetype'] as const) for (const zoom of zooms) {
    const pick = await s.page.evaluate(({ kind }) => {
      const a = window.__SS__!, hero = a.getEntity(1)!.transform;
      const inf = a.query({}).filter(e => e.infected && e.health.current > 0 && !e.corpse && ((e as { appearance?: { entityId?: number } }).appearance?.entityId === e.id) === (kind === 'turned'));
      inf.sort((p, q) => Math.hypot(p.transform.x - hero.x, p.transform.z - hero.z) - Math.hypot(q.transform.x - hero.x, q.transform.z - hero.z));
      const e = inf[0] as undefined | { id: number; archetype: string; appearance?: { asset?: string; tier?: string } };
      return e ? { id: e.id, archetype: e.archetype, asset: e.appearance?.asset, tier: e.appearance?.tier } : null;
    }, { kind });
    if (!pick) { console.log('no', kind); continue; }
    const trace: { cx: number; cy: number }[] = [];
    // The game camera follows the courier: put her 8 m from the picked infected, then crop around its projected feet (device pixels, DPR 2).
    await s.page.evaluate(async ({ id, zoom }) => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, t = a.getEntity(id)!.transform;
      a.teleport(1, { x: t.x + 8, z: t.z + 2 }); await a.step(2);
      const rig = game.view.view; rig.zoom(Math.log(zoom / rig.getState().targetZoom), true); await a.step(1);
    }, { id: pick.id, zoom });
    for (let k = 0; k < 8; k++) {
      const st = await s.page.evaluate(async ({ id }) => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        await a.step(15); await a.screenshotReady();
        const e = a.getEntity(id)!, t = e.transform, q = game.view.project(t.x, t.y - .7, t.z);
        return { x: +t.x.toFixed(2), z: +t.z.toFixed(2), state: e.infected?.state, cx: Math.round((q[0] + 1) * innerWidth), cy: Math.round((1 - q[1]) * innerHeight) };
      }, { id: pick.id });
      trace.push(st);
      await s.page.screenshot({ path: `${out}/l7-${kind}-${tier}-z${zoom}-${k}.jpg`, type: 'jpeg', quality: 80 });
    }
    rows.push({ kind, zoom, pick, trace });
    console.log(kind, zoom, JSON.stringify(pick));
  }
} finally { writeFileSync(`${out}/rows-${tier}.json`, JSON.stringify(rows, null, 1)); await s.close(); stopServer(); }
