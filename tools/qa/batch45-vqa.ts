/** Batch 45 pre-PROD visual QA: L6 exit, L7 Northgate approach, L10 corridor/final approach.
 * SCENE_PORT=4882 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/batch45-vqa.ts [high|low]
 * Progressed campaign presets (L6/L7/L10-default: gear carried, L6 survivors), real follow camera, zoom 1 and 1.5.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';

const tiers = (process.argv[2] ? [process.argv[2]] : ['high', 'low']) as ('high' | 'low')[];
const out = process.env.VQA_OUT ?? 'test-results/batch45-vqa';
const stations = {
  L6: [[258, 22], [266, 15], [273, 9], [283, 20]],
  L7: [[265, 15], [245, 15], [233, 15], [214, 15], [195, 15], [176, 15], [157, 15], [138, 15], [119, 15]],
  L10: [[2880, -5], [2930, -5], [2977, 45], [3020, 95], [3100, 95], [3220, 95], [3370, 95], [3490, 95], [3577, 40], [3630, -25], [3740, -25], [3850, -41], [3890, -35]],
} as const;
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const tier of tiers) {
    const s = new SceneSession({ tier, backend: 'webgpu', viewport: { width: 1280, height: 720 } });
    try {
      await s.open();
      for (const level of ['L6', 'L7', 'L10'] as const) {
        if (process.env.VQA_LEVEL && process.env.VQA_LEVEL !== level) continue;
        const info = await s.page.evaluate(async ({ level, tier }) => {
          const a = window.__SS__!;
          await a.loadLevel(level, { seed: 45, progression: `${level}-default` as never });
          a.pause(); a.cheats.god(true); a.settings.set({ quality: tier }); a.camera.follow();
          if (a.missions.state()?.phase === 'briefing') a.missions.begin();
          if (level === 'L6') { for (const id of ['shelter', 'stop', 'retreat']) a.cheats.completeObjective(id); a.teleport(1, { x: 273, z: 15 }); await a.step(2); }
          await a.screenshotReady();
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          const ds = game.world.districts!.districts;
          const added = ds.flatMap(d => d.decay.placements.filter(p => /^decor-(l6-exit|l7-northgate|cure-belt-r[67])/.test(p.id)).map(p => ({ id: p.id, asset: p.assetId, pos: p.position.map(v => +v.toFixed(2)), origin: d.origin, aabb: p.visualAabb, ground: game.world.districts!.groundHeight(p.position[0] + d.origin[0], p.position[2] + d.origin[1]) })));
          const st = a.getState() as unknown as { entities?: { kind?: string }[] };
          return { added, vehicles: (game.world as unknown as { vehicles?: { list?: () => unknown[] } }).vehicles ? 'present' : 'none', entityKinds: st.entities?.length ?? null };
        }, { level, tier });
        writeFileSync(`${out}/${level}-${tier}-placements.json`, JSON.stringify(info, null, 1));
        await s.page.addStyleTag({ content: '#hud,.hud,.mission-tracker,.mission-minimap,.mission-marker,.story-bubble,.mission-toast,.mission-subtitle,[data-testid=mission-button]{visibility:hidden!important}' });
        for (const [x, z] of stations[level]) for (const zoom of [1, 1.5]) {
          const state = await s.page.evaluate(async ({ x, z, zoom }) => {
            const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
            a.teleport(1, { x, z }); await a.step(1);
            const hero = a.getEntity(1)!.transform, rig = game.view.view;
            rig.focus.set(hero.x, hero.y - .7, hero.z); rig.update(hero, 0);
            rig.zoom(Math.log(zoom / rig.getState().targetZoom), true);
            await a.step(1); await a.screenshotReady();
            const f = a.perf();
            return { hero: { x: hero.x, y: hero.y, z: hero.z }, draws: f.drawCalls, tris: f.triangles };
          }, { x, z, zoom });
          const name = `${level}-${tier}-${x}_${z}-z${zoom}`;
          await s.page.screenshot({ path: `${out}/${name}.png` });
          rows.push({ name, ...state, errors: [...s.errors] });
          console.log(JSON.stringify({ name, ...state }));
        }
        // Lantern flicker / pop check: three frames 0.25 s apart at a lit stop, zoom 1.5.
        const [fx, fz] = stations[level][Math.min(2, stations[level].length - 1)];
        for (let i = 0; i < 3; i++) {
          await s.page.evaluate(async ({ fx, fz, i }) => {
            const a = window.__SS__!;
            if (i === 0) { a.teleport(1, { x: fx, z: fz }); }
            a.resume?.(); await new Promise(r => setTimeout(r, 250)); a.pause(); await a.screenshotReady();
          }, { fx, fz, i });
          await s.page.screenshot({ path: `${out}/${level}-${tier}-flicker${i}.png` });
        }
      }
    } finally { await s.close(); }
  }
} finally { writeFileSync(`${out}/rows-${tiers.join('-')}.json`, JSON.stringify(rows, null, 1)); stopServer(); }
