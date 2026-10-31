/** Batch 45 VQA: walk the dressed stretches by real keyboard input (WASD toward screen-projected waypoints), report stalls.
 * SCENE_PORT=4882 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/batch45-walk.ts
 */
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';

const legs: Record<string, { start: [number, number]; path: [number, number][] }> = {
  L6: { start: [262, 15], path: [[284, 15], [284, 21], [259, 21], [259, 15], [273, 8.5], [276, 15]] },
  L7: { start: [265, 15], path: [[233, 15], [233, 20.5], [214, 15], [196, 9.5], [176, 15], [157, 20.5], [138, 15], [119, 9.5], [110, 15]] },
  L10: { start: [2917, -5], path: [[2977, -5], [2977, 95], [3317, 95], [3577, 95], [3577, -25], [3697, -25], [3797, -25], [3797, -41], [3897, -41], [3897, -25], [3935, -25]] },
};
const s = new SceneSession({ tier: 'low', backend: 'webgpu', viewport: { width: 1280, height: 720 } });
const keys = new Set<string>();
const press = async (want: string[]) => {
  for (const k of [...keys]) if (!want.includes(k)) { await s.page.keyboard.up(k); keys.delete(k); }
  for (const k of want) if (!keys.has(k)) { await s.page.keyboard.down(k); keys.add(k); }
};
try {
  await s.open();
  for (const [level, leg] of Object.entries(legs)) {
    if (process.env.WALK_LEVEL && process.env.WALK_LEVEL !== level) continue;
    await s.page.evaluate(async ({ level, start }) => {
      const a = window.__SS__!;
      await a.loadLevel(level, { seed: 45, progression: `${level}-default` as never });
      a.cheats.god(true); a.settings.set({ quality: 'low' }); a.camera.follow();
      if (a.missions.state()?.phase === 'briefing') a.missions.begin();
      if (level === 'L6') for (const id of ['shelter', 'stop', 'retreat']) a.cheats.completeObjective(id);
      a.teleport(1, { x: start[0], z: start[1] }); a.resume(); await a.screenshotReady();
    }, { level, start: leg.start });
    for (let i = 0; i < 4; i++) { console.log(JSON.stringify({ level, at: await s.page.evaluate(() => { const h = window.__SS__!.getEntity(1)!.transform; return [+h.x.toFixed(1), +h.z.toFixed(1)]; }) })); await new Promise(r => setTimeout(r, 500)); }
    const t0 = Date.now(); let stalls = 0;
    for (const [i, wp] of leg.path.entries()) {
      let last = { x: 0, z: 0, t: Date.now() }, reached = false;
      const legT = Date.now();
      while (Date.now() - legT < Number(process.env.WALK_LEG_MS ?? 120_000)) {
        const st = await s.page.evaluate(({ wp }) => {
          const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
          const h = a.getEntity(1)!.transform, cam = game.view.camera;
          const V = cam.position.constructor as unknown as new (x: number, y: number, z: number) => { project: (c: unknown) => { x: number; y: number } };
          const dd = Math.hypot(wp[0] - h.x, wp[1] - h.z) || 1, p = new V(h.x + (wp[0] - h.x) / dd * 3, h.y, h.z + (wp[1] - h.z) / dd * 3).project(cam), q = new V(h.x, h.y, h.z).project(cam);
          return { x: h.x, z: h.z, dx: p.x - q.x, dy: -(p.y - q.y), d: Math.hypot(wp[0] - h.x, wp[1] - h.z), hp: a.getEntity(1)!.health };
        }, { wp });
        if (st.d < 1.6) { reached = true; break; }
        const k: string[] = []; const L = Math.hypot(st.dx, st.dy);
        if (Math.abs(st.dx) / L > .38) k.push(st.dx > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(st.dy) / L > .38) k.push(st.dy > 0 ? 'KeyS' : 'KeyW');
        await press(k);
        if (Math.random() < .03) console.log(JSON.stringify({ level, pos: [+st.x.toFixed(1), +st.z.toFixed(1)], wp, dx: +st.dx.toFixed(2), dy: +st.dy.toFixed(2) }));
        if (Math.hypot(st.x - last.x, st.z - last.z) > .5) { last = { x: st.x, z: st.z, t: Date.now() }; }
        else if (Date.now() - last.t > 2500) { stalls++; console.log(JSON.stringify({ level, stall: { x: +st.x.toFixed(1), z: +st.z.toFixed(1) }, wp })); last.t = Date.now(); }
        await new Promise(r => setTimeout(r, 120));
      }
      console.log(JSON.stringify({ level, waypoint: i, wp, reached, seconds: Math.round((Date.now() - legT) / 1000) }));
    }
    await press([]);
    console.log(JSON.stringify({ level, done: true, stalls, seconds: Math.round((Date.now() - t0) / 1000), errors: s.errors.length }));
  }
} finally { await s.close(); stopServer(); }
