/** Production assault, ordinary weapon inputs only. No spawned bodies or HP edits. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.L10_OUT ?? 'test-results/fixes-13h-l10/probe';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: process.env.L10_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2', tier: 'low' });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  const result = await session.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.settings.set({ quality: 'low' });
    await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-disperse-ready' });
    a.pause(); a.cheats.god(true); a.teleport(1, { x: 4002, z: -27 });
    a.input.set({ interact: true }); await a.step(1); a.input.clear();
    const kills: unknown[] = [], inputs: unknown[] = [];
    const off = g.world.events.on('combat.kill', event => {
      const e = g.world.entities.get(event.targetId)!;
      kills.push({ ...event, archetype: e.archetype, variant: e.infected?.variant, model: e.infected?.model, appearance: e.appearance });
    });
    for (let tick = 0; tick < 5400; tick += 6) {
      const p = g.world.entities.get(1)!, threats = g.world.infected!.active.filter(e => e.health.current > 0 && !e.infected?.pursuit && !e.hidden && !e.infected?.hidden);
      threats.sort((x, y) => Math.hypot(x.transform.x - p.transform.x, x.transform.z - p.transform.z) - Math.hypot(y.transform.x - p.transform.x, y.transform.z - p.transform.z));
      const target = threats[0], rack = p.weapons!.RIGHT.rack, index = rack.findIndex(e => e.id === 'weapon.rocket-launcher');
      if (index < 0) throw Error('Finale checkpoint lacks its rocket launcher');
      if (target) {
        const dx = target.transform.x - p.transform.x, dz = target.transform.z - p.transform.z, distance = Math.hypot(dx, dz) || 1;
        const input = { selectedSlot: { side: 'RIGHT' as const, index }, aimSource: 'keyboard' as const, aim: { x: dx / distance, z: dz / distance }, aimPoint: { x: target.transform.x, z: target.transform.z }, right: { down: false, held: true, up: false } };
        a.input.set(input); inputs.push({ tick: a.tick(), ...input });
      } else a.input.clear();
      await a.step(6);
    }
    off(); a.input.clear(); await a.step(150); await a.screenshotReady();
    const bodies = [...g.world.entities.iterate()].filter(e => e.corpse);
    const crowd = (g.view as unknown as { crowd: { corpseGeometry: Map<string, import('three').BufferGeometry> } }).crowd;
    const sources = [...crowd.corpseGeometry].map(([key, geometry]) => ({ key, source: geometry.userData, vertices: geometry.getAttribute('position').count }));
    const pages: unknown[] = [];
    g.view.scene.traverse(o => {
      const m = o as import('three').InstancedMesh;
      if (m.name.startsWith('corpses:') && m.count) pages.push({ name: m.name, instances: m.count, vertices: m.geometry.getAttribute('position').count, triangles: (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3, source: m.geometry.userData });
    });
    return { kills, inputs, bodies: bodies.map(e => ({ id: e.id, archetype: e.archetype, variant: e.infected?.variant, model: e.infected?.model, appearance: e.appearance, at: e.transform })), sources, pages, tick: a.tick(), perf: a.perf() };
  });
  writeFileSync(`${out}/evidence.json`, JSON.stringify(result, null, 2));
  await session.page.screenshot({ path: `${out}/console.jpg`, type: 'jpeg', quality: 90 });
  console.log(JSON.stringify({ kills: result.kills.length, bodies: result.bodies.length, sources: result.sources, pages: result.pages, errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
