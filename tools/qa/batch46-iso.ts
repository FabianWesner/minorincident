/** Batch 46 VQA (slim build), isolated Scene Lab part: male courier tiers 0-4 (idle/run/aim/melee) and a mixed
 * heroine + slimmed + reverted pedestrian lineup (walk, idle, flee, infected attack, corpses day/night).
 * SCENE_PORT=4892 E2E_PORT=4891 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/batch46-iso.ts [high|low] [courier|cast]
 * Writes JPEG frames to test-results/batch46-vqa/iso (git-ignored).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const tiers = (process.argv[2] ? [process.argv[2]] : ['high', 'low']) as ('high' | 'low')[];
const parts = process.argv[3] ? [process.argv[3]] : ['courier', 'cast'];
const out = 'test-results/batch46-vqa/iso';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const shot = async (s: SceneSession, name: string) => { await s.ready(); await s.page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85 }); };

const slimmed = ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-b', 'npc.civilian-adult-m'];
const reverted = ['npc.civilian-woman-a', 'npc.civilian-elderly', 'npc.civilian-adult-f'];
try {
  for (const tier of tiers) {
    const s = new SceneSession({ tier, backend: 'webgpu', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    try {
      await s.open();
      if (parts.includes('courier')) for (const gear of [0, 1, 2, 3, 4]) for (const act of ['idle', 'run', 'aim', 'melee'] as const) {
        const state = act === 'run' ? { run: [[-6, 0], [6, 0]], loop: true } : 'idle';
        const spec: SceneSpec = {
          name: `b46-courier-t${gear}-${act}`, seed: 1, ground: 'asphalt', size: 30, time: 'L1',
          actors: [
            { id: 'courier', kind: 'courier', at: [act === 'run' ? -6 : 0, 0], yaw: 0, loadout: [['weapon.bat', 'weapon.fists'], ['weapon.handgun']], look: { model: 'male', gearTier: gear }, state },
            ...(act === 'aim' || act === 'melee' ? [{ id: 'target', kind: 'infected', at: [act === 'aim' ? 4 : 1.4, 0], archetype: 'infected.runner', state: 'idle' }] : []),
          ],
          script: act === 'aim' ? [{ frame: 5, actor: 'courier', do: { select: 'RIGHT', index: 0 } }, { frame: 20, actor: 'courier', do: { aim: 'target', seconds: 3 } }]
            : act === 'melee' ? [{ frame: 20, actor: 'courier', do: { attack: 'target', seconds: 1.4, inPlace: true } }] : [],
          camera: { mode: 'follow', actor: 'courier', zoom: 1 }, frames: 0,
        } as unknown as SceneSpec;
        await s.load(spec);
        const frames = act === 'melee' ? [32, 12] : act === 'run' ? [40, 9] : act === 'aim' ? [60, 0] : [30, 0];
        await s.step(frames[0]);
        for (const zoom of [0.5, 1.5]) {
          await s.page.evaluate(z => window.__SS__!.camera.zoom(z), zoom);
          if (frames[1] && zoom === 1.5) await s.step(frames[1]);
          await s.step(2);
          await shot(s, `courier-${tier}-t${gear}-${act}-z${zoom}`);
        }
        const m = await s.metrics() as Record<string, unknown>;
        rows.push({ tier, gear, act, gap: (m as { courier?: unknown }).courier ?? null, errors: s.errors.length });
        console.log(tier, gear, act);
      }
      if (parts.includes('cast')) {
        // Line up: heroine at the centre, slimmed models on the left, reverted on the right; walk then idle.
        const models = [...slimmed, ...reverted];
        const actors = [
          { id: 'courier', kind: 'courier', at: [0, 0], yaw: -90, look: { model: 'female' }, state: 'idle' },
          ...models.map((model, i) => ({ id: `p${i}`, kind: 'pedestrian', at: [(i - 3) * 1.1 + (i >= 3 ? 1.1 : 0), 1.2], yaw: -90, look: { model }, state: 'idle' })),
        ];
        for (const phase of ['idle', 'walk', 'flee', 'attack', 'corpse-day', 'corpse-night'] as const) {
          const walk = phase === 'walk';
          const spec = {
            name: `b46-cast-${phase}`, seed: 2, ground: 'sidewalk', size: 30, time: phase === 'corpse-night' ? 'night' : 'L1',
            actors: actors.map(a => a.kind !== 'pedestrian' ? a : {
              ...a, at: walk ? [(a.at as number[])[0], 6] : a.at,
              state: walk ? { walk: [[(a.at as number[])[0], 6], [(a.at as number[])[0], -4]] } : phase === 'flee' ? { flee: [0, -6] } : 'idle',
            }),
            camera: { mode: 'follow', actor: 'courier', zoom: 1 }, frames: 0,
          } as unknown as SceneSpec;
          if (phase === 'attack' || phase.startsWith('corpse')) {
            (spec as unknown as { actors: unknown[] }).actors.push(...models.map((_, i) => ({ id: `z${i}`, kind: 'infected', at: [(i - 3) * 1.1 + (i >= 3 ? 1.1 : 0), 3.4], yaw: -90, archetype: 'infected.runner', state: { chase: `p${i}` } })));
          }
          await s.load(spec);
          if (phase === 'walk') await s.step(70);
          else if (phase === 'flee') await s.step(25);
          else if (phase === 'attack') await s.step(55);
          else if (phase.startsWith('corpse')) {
            // Every pedestrian is killed (bitten pedestrians turn, so use damage) - corpses persist.
            await s.step(30);
            await s.page.evaluate(() => {
              const a = window.__SS__!;
              for (const e of a.query({ kind: 'civilian' })) a.npcs.health(e.id, 0);
              a.cheats.killAll();
            });
            await s.step(150);
          } else await s.step(30);
          for (const zoom of [0.5, 1.5]) {
            await s.page.evaluate(z => window.__SS__!.camera.zoom(z), zoom);
            await s.step(2);
            await shot(s, `cast-${tier}-${phase}-z${zoom}`);
          }
          const m = await s.metrics() as { bodies?: unknown; actors?: Record<string, { lod?: unknown; state?: unknown }> };
          rows.push({ tier, phase, bodies: m.bodies, actors: Object.fromEntries(Object.entries(m.actors ?? {}).map(([k, v]) => [k, { lod: v.lod, state: v.state }])), errors: [...s.errors] });
          console.log(tier, phase, s.errors.length);
        }
      }
    } finally { await s.close(); }
  }
} finally { writeFileSync(`${out}/rows-${tiers.join('-')}-${parts.join('-')}.json`, JSON.stringify(rows, null, 1)); stopServer(); }
