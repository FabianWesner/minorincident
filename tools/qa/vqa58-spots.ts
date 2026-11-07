/** vqa58: staged close-ups for batch 58 (production levels, follow camera). Corpses (ring + overlap pile + Alpha) in L1/L3/L4/L7/L10,
 * L1 back-lane fence, L3 ramp joint x177 and both checkpoint coaches, L9 APC smoke, L10 live Alphas. Captures to test-results only.
 *   VQA_OUT=test-results/vqa58/spots VQA_BACKENDS=webgpu,webgl2 VQA_TIERS=low,high VQA_PARTS=corpses,l1,l3,l9,l10 \
 *   SCENE_PORT=3358 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/vqa58-spots.ts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VQA_OUT ?? 'test-results/vqa58/spots';
const backends = (process.env.VQA_BACKENDS ?? 'webgpu,webgl2').split(',') as ('webgl2' | 'webgpu')[];
const tiers = (process.env.VQA_TIERS ?? 'low,high').split(',') as ('high' | 'low')[];
const zooms = (process.env.VQA_ZOOMS ?? '1.5,1').split(',').map(Number);
const parts = (process.env.VQA_PARTS ?? 'corpses,l1,l3,l9,l10').split(',');
const corpseLevels = (process.env.VQA_CORPSE_LEVELS ?? 'L1,L3,L4,L7,L10').split(',');
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const presets: Record<string, string | undefined> = { L1: undefined, L3: 'L3-default', L4: 'L4-default', L7: 'L7-default', L9: 'L9-default', L10: 'L10-default' };
try {
  for (const backend of backends) for (const tier of tiers) {
    const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
    try {
      await s.open(); await s.page.evaluate('window.__name = f => f');
      const shot = async (label: string) => { const file = `${out}/${label}-${backend}-${tier}.jpg`; await s.page.screenshot({ path: file, type: 'jpeg', quality: 88 }); return file; };
      const load = (level: string) => s.page.evaluate(async ({ level, tier, progression }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier, cameraShake: false });
        await a.loadLevel(level, { seed: 1, ...(progression ? { progression } : {}) } as never);
        a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true);
        const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!.transform;
        return { x: p.x, z: p.z, quality: g.view.getState().quality, backend: g.view.getState().backend };
      }, { level, tier, progression: presets[level] });
      const zoomShots = async (label: string, extra: object = {}) => {
        for (const zoom of zooms) {
          await s.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); for (let i = 0; i < 3; i++) await a.step(10); await a.screenshotReady(); }, zoom);
          rows.push({ backend, tier, zoom, label, ...extra, file: await shot(`${label}-z${zoom}`) });
        }
      };
      const at = (x: number, z: number, ticks = 120) => s.page.evaluate(async ({ x, z, ticks }) => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        a.teleport(1, { x, z }); g.view.view.reset(g.world.entities.get(1)!.transform); await a.step(ticks);
        const p = g.world.entities.get(1)!.transform; return [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)];
      }, { x, z, ticks });
      if (parts.includes('corpses')) for (const level of corpseLevels) {
        const start = await load(level);
        // Ring of runners 3.5 m out, a 7-body overlap pile 5 m east, one Alpha 6 m west; all die together.
        const info = await s.page.evaluate(async ({ x, z, level }) => {
          const a = window.__SS__!, ids: number[] = [];
          a.cheats.killAll(); await a.step(30);
          for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; try { ids.push(a.spawn(i % 3 === 2 ? 'infected.brute' : 'infected.runner', { x: x + Math.cos(t) * 3.5, z: z + Math.sin(t) * 3.5 })); } catch { /* blocked */ } }
          for (let i = 0; i < 7; i++) try { ids.push(a.spawn('infected.runner', { x: x + 5 + (i % 3) * .3, z: z + Math.floor(i / 3) * .3 })); } catch { /* blocked */ }
          try { ids.push(a.spawn('infected.alpha', { x: x - 6, z })); } catch { /* blocked */ }
          if (level === 'L4' || level === 'L7') try { ids.push(a.spawn('infected.dog', { x, z: z - 5 })); } catch { /* none */ }
          await a.step(20); a.cheats.killAll(); await a.step(240); a.cheats.killAll(); await a.step(240);
          return { spawned: ids.length };
        }, { x: start.x, z: start.z, level });
        await zoomShots(`${level}-corpses`, { ...info, start });
      }
      if (parts.includes('l1')) {
        await load('L1');
        for (const [name, x, z] of [['fence-street', -32.4, -46.5], ['fence-lane', -37.2, -47.5], ['fence-north', -33, -52]] as const) {
          const pos = await at(x, z); await zoomShots(`L1-${name}`, { pos });
        }
      }
      if (parts.includes('l3')) {
        await load('L3');
        for (const [name, x, z] of [['ramp177', 177, 0], ['ramp172', 172, 0], ['coach-south', 149, -5.6], ['coach-north', 149, 2.4]] as const) {
          const pos = await at(x, z); await zoomShots(`L3-${name}`, { pos });
        }
      }
      if (parts.includes('l9')) {
        await load('L9');
        // Drive the APC a little with the complete bot, then look at smoke on the hull.
        await s.page.evaluate(async () => { const a = window.__SS__!; a.bot.start('complete'); for (let i = 0; i < 40; i++) await a.step(30); a.bot.stop(); });
        await zoomShots('L9-apc-drive');
        await s.page.evaluate(async () => { const a = window.__SS__!; a.bot.start('complete'); for (let i = 0; i < 40; i++) await a.step(30); a.bot.stop(); });
        await zoomShots('L9-apc-drive2');
      }
      if (parts.includes('l10')) {
        const start = await load('L10');
        await s.page.evaluate(async ({ x, z }) => { const a = window.__SS__!; a.cheats.killAll(); await a.step(20); for (let i = 0; i < 3; i++) try { a.spawn('infected.alpha', { x: x + 4 + i * 2.5, z: z + (i - 1) * 2.5 }); } catch { /* L10 Alphas need a cure region */ } for (let i = 0; i < 6; i++) a.spawn('infected.runner', { x: x - 4, z: z + i - 3 }); await a.step(40); }, start);
        await zoomShots('L10-live-alphas', { start });
      }
      if (s.errors.length) rows.push({ backend, tier, errors: s.errors.slice(0, 8) });
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
