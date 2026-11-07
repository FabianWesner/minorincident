/** vqa58 corpse reproduction, with the drawn frozen vertices checked against the production floor. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { InstancedMesh } from 'three';
import type { EntitySnapshot } from '../../src/sim/world/types';

const backend = (process.argv[2] ?? 'webgpu') as 'webgpu' | 'webgl2';
const tier = (process.argv[3] ?? 'high') as 'low' | 'high';
const level = process.argv[4] ?? 'L1';
const out = process.env.VQA_OUT ?? 'test-results/r5-vis/corpses';
mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend, tier, query: { ui: '1' } });
try {
  await s.open(); await s.page.evaluate('window.__name = f => f');
  const result = await s.page.evaluate(async ({ tier, level }) => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.settings.set({ quality: tier, cameraShake: false });
    await a.loadLevel(level, { seed: 1, ...(level === 'L1' ? {} : { progression: `${level}-default` }) } as never);
    a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true);
    const p = { ...g.world.entities.get(1)!.transform }, ids: number[] = [];
    a.cheats.killAll(); await a.step(30);
    for (let i = 0; i < 8; i++) {
      const t = i / 8 * Math.PI * 2;
      try { ids.push(a.spawn(i % 3 === 2 ? 'infected.brute' : 'infected.runner', { x: p.x + Math.cos(t) * 3.5, z: p.z + Math.sin(t) * 3.5 })); } catch { /* production admission */ }
    }
    for (let i = 0; i < 7; i++) try { ids.push(a.spawn('infected.runner', { x: p.x + 5 + i % 3 * .3, z: p.z + Math.floor(i / 3) * .3 })); } catch { /* production admission */ }
    try { ids.push(a.spawn('infected.alpha', { x: p.x - 6, z: p.z })); } catch { /* L10 region ownership */ }
    await a.step(20); a.cheats.killAll(); await a.step(480); await a.screenshotReady();
    type Corpses = { bodies: Map<string, EntitySnapshot>; slots: Map<string, { page: { mesh: InstancedMesh }; index: number }> };
    const pools: Corpses[] = [];
    g.view.scene.traverse(node => { const p = node as unknown as Corpses; if (p.bodies instanceof Map && p.slots instanceof Map) pools.push(p); });
    const bodies = pools.flatMap(pool => [...pool.bodies].filter(([, e]) => ids.includes(e.id)).map(([key, e]) => {
      const slot = pool.slots.get(key)!, mesh = slot.page.mesh, m = mesh.instanceMatrix.array, offset = slot.index * 16;
      const pos = mesh.geometry.getAttribute('position');
      let minY = Infinity, maxY = -Infinity, buried = 0, minClearance = Infinity, worst: unknown;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const wx = m[offset] * x + m[offset + 4] * y + m[offset + 8] * z + m[offset + 12];
        const wy = m[offset + 1] * x + m[offset + 5] * y + m[offset + 9] * z + m[offset + 13];
        const wz = m[offset + 2] * x + m[offset + 6] * y + m[offset + 10] * z + m[offset + 14];
        const floor = g.world.districts!.supportBelow(wx, wz, e.transform.y - .7), clearance = wy - floor;
        if (clearance < minClearance) { minClearance = clearance; worst = { x: wx, y: wy, z: wz, floor }; }
        if (clearance < -.08) buried++;
        minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
      }
      return { id: e.id, archetype: e.archetype, variant: e.infected?.variant, source: e.transform,
        at: Array.from(m.slice(offset + 12, offset + 15)), screen: a.camera.project(m[offset + 12], m[offset + 13], m[offset + 14]),
        minY, maxY, height: maxY - minY, vertices: pos.count, buried, minClearance, worst };
    }));
    return { level, backend: a.getState().render.backend, tier, start: p, bodies, layout: a.debug.corpseLayout(), effects: a.perf().effects };
  }, { tier, level });
  writeFileSync(`${out}/${level}-${backend}-${tier}.json`, JSON.stringify({ ...result, errors: s.errors }, null, 2));
  for (const zoom of [1, 1.5]) {
    await s.page.evaluate(async z => { const a = window.__SS__!; a.camera.zoom(z); await a.step(1); await a.screenshotReady(); }, zoom);
    await s.page.screenshot({ path: `${out}/${level}-${backend}-${tier}-z${zoom}.jpg`, type: 'jpeg', quality: 90 });
  }
  console.log(JSON.stringify(result));
} finally { await s.close(); stopServer(); }
