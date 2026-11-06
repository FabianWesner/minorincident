/** fix65-a (L3-13): native complete-bot L3 traversal; follow-camera frames on the first S-ramp plus living infected near its inner apexes. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';

const tier = (process.env.TIER ?? 'low') as 'low' | 'high', out = `test-results/fix65-a/ramp-${tier}`;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
const rows: unknown[] = [];
try {
  await s.open(); await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async tier => {
    const a = window.__SS__!; a.settings.set({ quality: tier });
    await a.loadLevel('L3', { seed: 1 }); a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1); a.bot.start('complete', { street: 'auto' });
  }, tier);
  for (const [gate, zoom] of [[141, 1.5], [146, 1.5], [150, 1.5], [154, 1], [158, 1.5], [163, 0.5]] as const) {
    const ok = await s.page.evaluate(async gate => {
      const a = window.__SS__!;
      for (let i = 0; i < 4000 && (a.getEntity(1)?.transform.x ?? -1e9) < gate; i++) { if (a.missions.state()?.phase !== 'playing') break; await a.step(5); }
      return (a.getEntity(1)?.transform.x ?? -1e9) >= gate;
    }, gate);
    if (!ok) { rows.push({ gate, reached: false }); break; }
    await s.page.evaluate(z => window.__SS__!.camera.zoom(z), zoom);
    await s.step(2);
    const state = await s.page.evaluate(() => {
      const a = window.__SS__!, near: unknown[] = [], world = (window.__SCENE__ as unknown as { game: { world: { entities: { iterate(): Iterable<{ id: number; infected?: unknown; hidden?: boolean; health: { current: number }; transform: { x: number; y: number; z: number } }> } } } }).game.world;
      for (const e of world.entities.iterate()) if (e.infected && e.health.current > 0 && !e.hidden && e.transform.x > 140 && e.transform.x < 168) near.push({ id: e.id, x: +e.transform.x.toFixed(2), y: +e.transform.y.toFixed(2), z: +e.transform.z.toFixed(2) });
      return { player: a.getEntity(1)!.transform, near };
    });
    await s.screenshot(`${out}/x${gate}-z${zoom}.png`);
    rows.push({ gate, zoom, reached: true, ...state });
  }
} finally { writeFileSync(`${out}/ramp.json`, JSON.stringify(rows, null, 1)); await s.close(); stopServer(); }
console.log(JSON.stringify(rows.map(r => { const x = r as { gate: number; reached: boolean; near?: unknown[] }; return [x.gate, x.reached, x.near?.length]; })));
