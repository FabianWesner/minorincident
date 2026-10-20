import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';
const stage = process.env.L7_STAGE ?? 'after';
const out = `test-results/l7-readability/${stage}`;
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const spots = [
  { name: 'po-228', x: 228.46, z: -4.92, edgeZ: 2, upperZ: 15, outward: -1 },
  { name: 'po-edge-close', x: 228.46, z: 3, edgeZ: 2, upperZ: 15, outward: -1 },
  { name: 'northgate-south', x: 262, z: 29, edgeZ: 30, upperZ: 15, outward: 1 },
  { name: 'terrace-middle', x: 174, z: 29, edgeZ: 30, upperZ: 15, outward: 1 },
  { name: 'terrace-foot', x: 116, z: 1, edgeZ: 2, upperZ: 15, outward: -1 },
  { name: 'plaza-crater', x: 15, z: -14.73, edgeZ: -13.7301, upperZ: -13.65, outward: -1 },
];
try {
  for (const backend of (process.env.L7_BACKEND ? [process.env.L7_BACKEND] : ['webgl2', 'webgpu']) as Backend[]) for (const tier of ['high', 'low'] as const) {
    const s = new SceneSession({ backend, tier, viewport: { width: 1600, height: 900 }, query: { level: 'L7' } });
    try {
      await s.open();
      await s.page.evaluate('globalThis.__name = (fn) => fn');
      await s.page.evaluate(async ({ tier, stage }) => {
        const a = window.__SS__!; await a.loadLevel('L7', { seed: 2, progression: 'L7-default' });
        a.settings.set({ quality: tier }); a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow();
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        const edges = game.view.scene.getObjectByName('walkable-height-step-edges');
        if (edges) edges.visible = stage !== 'before';
      }, { tier, stage });
      for (const spot of spots) for (const zoom of [.5, 1, 1.5]) {
        const state = await s.page.evaluate(async ({ spot, zoom }) => {
          const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
          a.teleport(1, { x: spot.x, z: spot.z }); await a.step(2);
          const hero = a.getEntity(1)!.transform, rig = game.view.view;
          rig.focus.set(hero.x, hero.y - .7, hero.z); rig.update(hero, 0);
          rig.zoom(Math.log(zoom / rig.getState().targetZoom), true);
          await a.step(1); await a.screenshotReady();
          const overlays = [...document.querySelectorAll('.mission-tracker,.mission-toast,.mission-minimap,.mission-marker')].filter(e => {
            const style = getComputedStyle(e); return style.display !== 'none' && style.visibility !== 'hidden';
          }).map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
          return { edge: { z: spot.edgeZ, upperZ: spot.upperZ, outward: spot.outward, offsets: spot.name === 'plaza-crater' ? [-2, -1, 1, 2] : [-5, -4, -3, 3, 4, 5] }, overlays, figures: a.query({}).filter(e => e.id === 1 || e.civilian || e.infected || e.companion).map(e => e.transform), player: hero, camera: a.getState().render.camera, perf: a.perf() };
        }, { spot, zoom });
        const name = `${backend}-${tier}-${spot.name}-z${zoom}`;
        await s.page.screenshot({ path: `${out}/${name}.png` });
        assert.equal(state.perf.backend, backend === 'webgl2' ? 'webgl' : 'webgpu');
        assert.equal(state.perf.quality.tier, tier);
        assert.ok(Math.abs(state.camera.zoom - zoom) < .001);
        rows.push({ name, ...state, errors: [...s.errors] });
        console.log(name);
      }
      const bars = await s.page.evaluate(async () => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        const followers = a.query({}).filter(e => e.civilian?.survivor?.mode === 'follow');
        a.teleport(1, { x: 228, z: 7 });
        const control = followers[0]?.id;
        for (const [i, e] of followers.entries()) a.teleport(e.id, { x: 224 + (i % 9), z: i === 0 ? 8 : 1 - Math.floor(i / 9) * .6 });
        a.camera.follow(); await a.step(1);
        const hero = a.getEntity(1)!.transform, rig = game.view.view;
        rig.focus.set(hero.x, hero.y - .7, hero.z); rig.update(hero, 0); rig.zoom(Math.log(1.5 / rig.getState().targetZoom), true);
        await a.step(1); await a.screenshotReady();
        const visible = a.getState().render.healthBars!.bars.map(b => b.id);
        const centres = followers.slice(1).map(e => { const t = a.getEntity(e.id)!.transform, p = rig.focus.clone().set(t.x, t.y + .18, t.z).project(game.view.camera); return { id: e.id, inFrame: Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z > -1 && p.z < 1 }; });
        return { control, hidden: followers.slice(1).map(e => e.id), visible, centres, count: a.getState().render.healthBars!.count };
      });
      await s.page.screenshot({ path: `${out}/${backend}-${tier}-terrain-bars.png` });
      writeFileSync(`${out}/${backend}-${tier}-terrain-bars.json`, JSON.stringify(bars, null, 2));
      assert.ok(bars.control !== undefined, 'L7 must have followers for the terrain occlusion check');
      assert.ok(bars.visible.includes(bars.control), 'upper-terrace survivor must keep its bar');
      assert.ok(bars.centres.filter(c => c.inFrame).length >= 8, 'hidden figures must be in the camera frame');
      assert.ok(bars.hidden.every(id => !bars.visible.includes(id)), 'survivors hidden below the terrace must have no bars');
      await s.page.evaluate(async () => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        a.teleport(1, { x: 228.46, z: 1 }); await a.step(1);
        const hero = a.getEntity(1)!.transform, rig = game.view.view;
        rig.focus.set(hero.x, hero.y - .7, hero.z); rig.update(hero, 0); await a.screenshotReady();
      });
      await s.page.screenshot({ path: `${out}/${backend}-${tier}-below-edge-courier.png` });
      assert.deepEqual(s.errors, []);
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/evidence.json`, JSON.stringify(rows, null, 2)); }
