/** vqa59: staged checks for batch 59 (Scene Lab dev server, production levels, follow camera). Captures to test-results only.
 *  truck:   L2 fire-engine ride (native bot boards), ride +3 s / +12 s, zoom 0.5/1/1.5.
 *  corpses: kill rings on the start spot and on a found raised edge (kerb/step 8-60 cm) in L1/L4/L5/L7; per body the drawn
 *           vertices vs the support floor: buried (> 8 cm under), hover (lowest vertex > 12 cm over), height (> 0.8 m = standing/folded).
 *  brutes:  L10 brutes wind up on the courier, die by a real damage event (not killAll); live warning rings before/after.
 *   VQA_BACKENDS=webgpu,webgl2 VQA_TIERS=low,high VQA_PARTS=truck,corpses,brutes SCENE_PORT=3359 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/vqa59-spots.ts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VQA_OUT ?? 'test-results/vqa59/spots';
const backends = (process.env.VQA_BACKENDS ?? 'webgpu,webgl2').split(',') as ('webgl2' | 'webgpu')[];
const tiers = (process.env.VQA_TIERS ?? 'low,high').split(',') as ('high' | 'low')[];
const parts = (process.env.VQA_PARTS ?? 'truck,corpses,brutes').split(',');
const corpseLevels = (process.env.VQA_CORPSE_LEVELS ?? 'L1,L4,L5,L7').split(',');
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const presets: Record<string, string | undefined> = { L1: undefined, L2: 'L2-default', L4: 'L4-default', L5: 'L5-default', L7: 'L7-default', L10: 'L10-default' };
try {
  for (const backend of backends) for (const tier of tiers) {
    const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
    try {
      await s.open(); await s.page.evaluate('window.__name = f => f');
      const shot = async (label: string) => { const file = `${out}/${label}-${backend}-${tier}.jpg`; await s.page.screenshot({ path: file, type: 'jpeg', quality: 88 }); return file; };
      const zoomShots = async (label: string, zooms: number[], extra: object = {}) => {
        for (const zoom of zooms) {
          await s.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); for (let i = 0; i < 2; i++) await a.step(1); await a.screenshotReady(); }, zoom);
          rows.push({ backend, tier, zoom, label, ...extra, file: await shot(`${label}-z${zoom}`) });
        }
      };
      const load = (level: string) => s.page.evaluate(async ({ level, tier, progression }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier, cameraShake: false });
        await a.loadLevel(level, { seed: 1, ...(progression ? { progression } : {}) } as never);
        a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true);
        const p = (window.__SCENE__ as unknown as { game: Game }).game.world.entities.get(1)!.transform; return { x: p.x, z: p.z };
      }, { level, tier, progression: presets[level] });

      if (parts.includes('truck')) {
        await s.page.evaluate(async () => {
          const a = window.__SS__!; await a.loadLevel('L2', { seed: 1, progression: 'L2-default' }); a.missions.begin(); a.pause(); a.bot.start('no-axe');
          for (let i = 0; i < 120 && a.missions.state()!.l2!.phase !== 'ride'; i++) await a.step(30);
          if (a.missions.state()!.l2!.phase !== 'ride') throw new Error('native bot did not board'); a.bot.stop?.();
        });
        for (const seconds of [3, 12, 30]) {
          const st = await s.page.evaluate(async seconds => { const a = window.__SS__!; while (a.getState().tick - a.missions.state()!.l2!.departAt < seconds * 60) await a.step(1); const l2 = a.missions.state()!.l2!; return { phase: l2.phase, seated: l2.seated }; }, seconds);
          await zoomShots(`L2-ride-s${seconds}`, [0.5, 1, 1.5], st);
        }
      }

      if (parts.includes('corpses')) for (const level of corpseLevels) {
        const start = await load(level);
        // Find a raised edge (8-60 cm step) within 25 m of the start that the courier can stand next to.
        const edge = await s.page.evaluate(({ x, z }) => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, d = g.world.districts!;
          let best: { x: number; z: number; step: number; dist: number } | null = null;
          for (let r = 3; r <= 25; r += 1) for (let k = 0; k < 24; k++) {
            const t = k / 24 * Math.PI * 2, px = x + Math.cos(t) * r, pz = z + Math.sin(t) * r;
            const h = d.supportBelow(px, pz, 5), hx = d.supportBelow(px + .5, pz, 5), hz = d.supportBelow(px, pz + .5, 5);
            const step = Math.max(Math.abs(hx - h), Math.abs(hz - h));
            if (step > .08 && step < .6 && Math.abs(h) < 1.5 && (!best || r < best.dist)) best = { x: px, z: pz, step, dist: r };
          }
          return best;
        }, start);
        for (const [spot, c] of [['start', start], ...(edge ? [['edge', edge]] as const : [])] as const) {
          if (spot === 'edge') await s.page.evaluate(async ({ x, z }) => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game; a.cheats.killAll(); await a.step(10); a.teleport(1, { x: x + 1.2, z: z + 1.2 }); g.view.view.reset(g.world.entities.get(1)!.transform); await a.step(30); }, c);
          const res = await s.page.evaluate(async ({ x, z }) => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, ids: number[] = [];
            a.cheats.killAll(); await a.step(30);
            for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2; for (const rr of [1.2, 2.4]) try { ids.push(a.spawn(i % 4 === 3 ? 'infected.brute' : 'infected.runner', { x: x + Math.cos(t) * rr, z: z + Math.sin(t) * rr })); } catch { /* blocked */ } }
            await a.step(15); a.cheats.killAll(); await a.step(480); await a.screenshotReady();
            type Pool = { bodies: Map<string, { id: number; transform: { y: number } }>; slots: Map<string, { page: { mesh: import('three').InstancedMesh }; index: number }> };
            const pools: Pool[] = []; g.view.scene.traverse(n => { const p = n as unknown as Pool; if (p.bodies instanceof Map && p.slots instanceof Map) pools.push(p); });
            const bodies = pools.flatMap(pool => [...pool.bodies].filter(([, e]) => ids.includes(e.id)).map(([key, e]) => {
              const slot = pool.slots.get(key)!, mesh = slot.page.mesh, m = mesh.instanceMatrix.array, o = slot.index * 16, pos = mesh.geometry.getAttribute('position');
              let minY = Infinity, maxY = -Infinity, buried = 0, minClear = Infinity;
              for (let i = 0; i < pos.count; i += 3) {
                const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
                const wx = m[o] * vx + m[o + 4] * vy + m[o + 8] * vz + m[o + 12], wy = m[o + 1] * vx + m[o + 5] * vy + m[o + 9] * vz + m[o + 13], wz = m[o + 2] * vx + m[o + 6] * vy + m[o + 10] * vz + m[o + 14];
                const clear = wy - g.world.districts!.supportBelow(wx, wz, e.transform.y + .7);
                if (clear < -.08) buried++; minClear = Math.min(minClear, clear); minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
              }
              return { id: e.id, at: [+m[o + 12].toFixed(2), +m[o + 13].toFixed(2), +m[o + 14].toFixed(2)], height: +(maxY - minY).toFixed(2), buried, minClear: +minClear.toFixed(3) };
            }));
            return { spawned: ids.length, drawn: bodies.length, standing: bodies.filter(b => b.height > .8).length, hovering: bodies.filter(b => b.minClear > .12).length, buriedBodies: bodies.filter(b => b.buried > 20).length, bodies };
          }, c);
          rows.push({ backend, tier, level, spot, centre: c, ...res, bodies: undefined });
          writeFileSync(`${out}/${level}-${spot}-${backend}-${tier}.json`, JSON.stringify({ centre: c, ...res }, null, 1));
          await zoomShots(`${level}-corpses-${spot}`, [1, 1.5], { level, spot });
        }
      }

      if (parts.includes('brutes')) {
        const start = await load('L10');
        const before = await s.page.evaluate(async ({ x, z }) => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, ids: number[] = [];
          a.cheats.killAll(); await a.step(20);
          for (let i = 0; i < 3; i++) try { ids.push(a.spawn('infected.brute', { x: x + 9 + i * 1.5, z: z + (i - 1) * 2.5 })); } catch { /* blocked */ }
          let max = 0; const tells = () => (g.view.vfx as unknown as { tells: Map<number, unknown> }).tells.size;
          for (let i = 0; i < 900; i++) { await a.step(1); max = Math.max(max, tells()); if (tells() >= 2) break; }
          a.pause(); (window as unknown as { __vqaIds: number[] }).__vqaIds = ids;
          return { ids, tells: tells(), maxTells: max, tick: g.world.tick };
        }, start);
        await zoomShots('L10-brutes-live', [1, 1.5], before);
        const after = await s.page.evaluate(async () => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, ids = (window as unknown as { __vqaIds: number[] }).__vqaIds;
          for (const id of ids) { const e = g.world.entities.get(id); if (!e || e.health.current <= 0) continue; const from = g.world.entities.get(1)!.transform, dx = e.transform.x - from.x, dz = e.transform.z - from.z, d = Math.hypot(dx, dz) || 1;
            g.world.combat!.damage.apply({ attackId: 99000 + id, actionId: 'weapon.fists', sourceId: 1, targetId: id, origin: { x: from.x, z: from.z }, direction: { x: dx / d, z: dz / d }, base: 1e4, multiplier: 1, type: 'melee', knockback: .3, stagger: 12, knockdown: false } as never); }
          const tells = () => (g.view.vfx as unknown as { tells: Map<number, unknown> }).tells.size, series: number[] = [];
          for (let i = 0; i < 6; i++) { await a.step(10); series.push(tells()); }
          return { dead: ids.map(id => g.world.entities.get(id)?.health.current ?? -1), tellsAfter: series };
        });
        await zoomShots('L10-brutes-dead', [1, 1.5], after);
      }
      if (s.errors.length) rows.push({ backend, tier, errors: s.errors.slice(0, 8) });
    } finally { await s.close(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
