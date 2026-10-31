/** Real campaign before/after review, shared headless pool, production QA bundles.
 * SCENE_PORT=4873 SCENE_SERVER=preview [SCENE_DIST=...] sh tools/e2e-lock.sh node --import tsx tools/qa/look-empty-review.ts before|after [high|low]
 * Does not alter the scene. Paused stops use the normal follow camera and authored height field.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
import { measureContrast } from '../scenelab/contrast';

const phase = process.argv[2] ?? 'after';
const tiers = (process.argv[3] ? [process.argv[3]] : ['high', 'low']) as ('high' | 'low')[];
const out = `test-results/look-empty/${phase}`;
const stations = {
  L6: [[261, 15], [273, 15], [283, 15]],
  L7: [[265, 15], [247, 15], [233, 15], [214, 15], [195, 15], [176, 15], [157, 15], [138, 15], [119, 15], [100, 15]],
  L10: [[668, 25], [1095, 25], [1420, 100], [2000, -75], [2640, 45], [2880, -5], [2950, -5], [2977, 45], [3020, 95], [3100, 95], [3220, 95], [3370, 95], [3490, 95], [3577, 40], [3630, -25], [3740, -25], [3850, -41]],
} as const;
const rows: unknown[] = [];
mkdirSync(out, { recursive: true });
try {
  for (const tier of tiers) {
    const s = new SceneSession({ tier, backend: 'webgpu', query: { loadProfile: '1' }, viewport: { width: 1280, height: 720 } });
    try {
      await s.open();
      for (const level of ['L6', 'L7', 'L10'] as const) {
        if (process.env.LOOK_LEVEL && process.env.LOOK_LEVEL !== level) continue;
        await s.page.evaluate(async ({ level, tier }) => {
          const a = window.__SS__!;
          await a.loadLevel(level, { seed: 32, progression: `${level}-default` });
          a.pause(); a.cheats.god(true); a.settings.set({ quality: tier }); a.camera.follow();
          if (a.missions.state()?.phase === 'briefing') a.missions.begin();
          if (level === 'L6') {
            for (const id of ['shelter', 'stop', 'retreat']) a.cheats.completeObjective(id);
            a.teleport(1, { x: 273, z: 15 }); await a.step(2);
          }
          await a.screenshotReady();
        }, { level, tier });
        const warm = await s.page.evaluate(() => ({ ...window.__SS__!.perf().nodeBuildMaterials }));
        await s.page.evaluate(() => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          const debug = game.view.renderer.debug, previous = debug.onNodeBuilderCreated;
          const trace: unknown[] = [];
          (window as unknown as { lookEmptyBuilds: unknown[] }).lookEmptyBuilds = trace;
          debug.onNodeBuilderCreated = (builder, object) => {
            previous?.(builder, object);
            const draw = object as unknown as { object: import('three').Object3D; material: import('three').Material };
            const ancestry: unknown[] = [];
            for (let node: import('three').Object3D | null = draw.object; node; node = node.parent) ancestry.push({ name: node.name, asset: node.userData.assetId });
            trace.push({ material: draw.material.name, ancestry });
          };
        });
        const belt = level === 'L10' ? await s.page.evaluate(() => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          return game.world.districts!.districts.flatMap(d => d.decay.placements).filter(p => /^decor-cure-belt-r[1-5]-/.test(p.id));
        }) : null;
        if (belt) writeFileSync(`${out}/unchanged-belt-${tier}.json`, JSON.stringify(belt));
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
            return { player: hero, camera: a.getState().render.camera, trace: (window as unknown as { lookEmptyBuilds: unknown[] }).lookEmptyBuilds, perf: { draws: f.drawCalls, triangles: f.triangles, backend: f.backend, quality: f.quality, builds: { ...f.nodeBuildMaterials } } };
          }, { x, z, zoom });
          const name = `${level}-${tier}-${x}-${z}-z${zoom}`;
          const contrast = level === 'L10' ? await measureContrast(s.page, { name, contrast: { district: 'D-CURE', halfWidthM: 3, stepM: 2 } }) : null;
          await s.page.screenshot({ path: `${out}/${name}.png` });
          const late = Object.entries(state.perf.builds).filter(([key, n]) => n > (warm[key] ?? 0));
          rows.push({ name, level, tier, x, z, zoom, ...state, contrast, warm, late, errors: [...s.errors] });
          const evidenceFile = `${out}/evidence-${tier}.json`;
          const previous = existsSync(evidenceFile) ? JSON.parse(readFileSync(evidenceFile, 'utf8')) as { name: string }[] : [];
          const merged = new Map(previous.map(row => [row.name, row]));
          for (const row of rows as { name: string }[]) merged.set(row.name, row);
          writeFileSync(evidenceFile, JSON.stringify([...merged.values()], null, 2));
          console.log(JSON.stringify({ name, draws: state.perf.draws, tris: state.perf.triangles, contrast: contrast?.median, late: late.length }));
        }
      }
    } finally { await s.close(); }
  }
} finally { stopServer(); }
