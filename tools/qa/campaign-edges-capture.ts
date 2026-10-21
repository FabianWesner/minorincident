/** Reproducible all-level retaining-edge evidence; one headless browser at a time. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { HeightStep } from '../../src/sim/world/HeightSteps';
import type { Game } from '../../src/Game';
import { compositions } from '../../src/levels/compositions';

const out = 'test-results/edges-all/captures'; mkdirSync(out, { recursive: true });
const baseline = JSON.parse(readFileSync('docs/reports/edges-all/height-steps-before.json', 'utf8')) as { results: { level: string; missing: HeightStep[] }[] };
const requests = [
  ['L2', 'annex', 'carry-annex-rubble-1/geometry-0', 64, -12.5],
  ['L3', 'west-onramp', ':991/highway-0-119', 144, -1.5],
  ['L3', 'east-onramp', ':992/highway-0-119', 203, 1.5],
  ['L4', 'town-hall', 'bld.town-hall:1/geometry-0', -27.5, -21.6],
  ['L5', 'crater-south', 'l5-crater-6/geometry-0', 16, -4.9],
  ['L5', 'crater-north', 'l5-crater-6/geometry-9', 15, -13.7],
  ['L6', 'shelter', 'surface-0', 30, -15],
  ['L6', 'night-apron', 'surface-3', 288, 23],
  ['L6', 'northgate-platform', 'northgate-platform', 249.4, 12.6],
  ['L6', 'exit-support', 'l6-37/fixed-0', 287.6, 8],
  ['L10', 'cure-lab', 'bld.cure-lab-main:194/geometry-1', 2721.7, 23],
] as const;
const spots = requests.map(([level, name, source, x, z]) => {
  const steps = baseline.results.find(r => r.level === level)!.missing.filter(s => s.source.includes(source));
  steps.sort((a, b) => Math.hypot((a.a[0] + a.b[0]) / 2 - x, (a.a[1] + a.b[1]) / 2 - z) - Math.hypot((b.a[0] + b.b[0]) / 2 - x, (b.a[1] + b.b[1]) / 2 - z));
  assert.ok(steps.length, `${level}/${source} missing from baseline`);
  return { level, name, edge: steps[0] };
});
const filter = process.env.EDGE_SPOTS?.split(',');
const rows: Record<string, unknown>[] = filter && existsSync(`${out}/evidence.json`) ? JSON.parse(readFileSync(`${out}/evidence.json`, 'utf8')) : [];
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend: 'webgpu', tier, viewport: { width: 1600, height: 900 }, query: { level: 'L2' } });
    try {
      await session.open();
      await session.page.evaluate('globalThis.__name = (fn) => fn');
      await session.page.addStyleTag({ content: '.mission-ui{display:none!important}' });
      let loaded = '';
      for (const spot of spots.filter(s => !filter || filter.includes(s.name))) {
        if (loaded !== spot.level) {
          await session.page.evaluate(async ({ level, tier }) => {
            const a = window.__SS__!; a.settings.set({ quality: tier });
            await a.loadLevel(level, { seed: 2, progression: `${level}-default` as import('../../src/sim/progression/Campaign').ProgressionPreset }); a.pause(); a.cheats.god(true);
            if (level === 'L4' || level === 'L5') { a.missions.begin(); a.missions.completeObjective(level === 'L4' ? 'ride' : 'emerge'); }
          }, { level: spot.level, tier });
          loaded = spot.level;
        }
        for (const light of ['native', 'night'] as const) for (const zoom of [1, 1.5]) {
          const native = spot.level === 'L6' && ['night-apron', 'exit-support'].includes(spot.name) ? 'L6' : compositions[spot.level].timeOfDay;
          const preset = light === 'night' && !['L6', 'L10'].includes(spot.level) ? 'L6' : native;
          const state = await session.page.evaluate(async ({ spot, zoom, preset }) => {
            const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
            game.view.settings({ timeOfDay: preset, cameraShake: false, cheapDof: false });
            const e = spot.edge, x = (e.a[0] + e.b[0]) / 2, z = (e.a[1] + e.b[1]) / 2;
            // Stay laterally clear of the measured step and its reveal disc.
            const tx = e.b[0] - e.a[0], tz = e.b[1] - e.a[1], len = Math.hypot(tx, tz);
            let placed = false;
            for (const along of [8, -8, 6, -6, 10, -10]) {
              for (const away of [2, 4, -2]) {
                const destination = { x: x + e.outward[0] * away + tx / len * along, z: z + e.outward[1] * away + tz / len * along };
                a.teleport(1, destination);
                const p = a.getEntity(1)!.transform;
                if (Math.hypot(p.x - destination.x, p.z - destination.z) <= 1.6) { placed = true; break; }
              }
              if (placed) break;
            }
            if (!placed) throw new Error(`${spot.name}: no clear courier staging point`);
            await a.step(2);
            const hero = a.getEntity(1)!.transform, rig = game.view.view;
            rig.inspectionPose = null; rig.reset(hero); rig.focus.set(x, e.upper, z); rig.zoom(Math.log(zoom / rig.getState().targetZoom), true); rig.update(hero, 0);
            await a.step(1);
            if (['crater-north', 'northgate-platform', 'west-onramp'].includes(spot.name)) {
              const target = rig.focus.clone(), offset = game.view.camera.position.clone().sub(target);
              rig.inspectionPose = { target: target.toArray() as [number, number, number], position: [target.x + offset.x, target.y + offset.y, target.z - Math.abs(offset.z)] };
              rig.update(hero, 0);
            }
            await a.screenshotReady();
            // Test visibility against the actual drawn meshes before reading pixels.
            // Sampling is determined by geometry, never by pixel brightness.
            const modulePath = '/node_modules/three/build/three.core.js';
            const { Raycaster } = await import(modulePath) as typeof import('three');
            const ray = Object.assign(new Raycaster(), { firstHitOnly: true });
            const meshes: import('three').Object3D[] = [];
            game.view.scene.traverseVisible(o => {
              if (!('isMesh' in o) || !o.isMesh) return;
              const m = (o as import('three').Mesh).material, list = Array.isArray(m) ? m : [m];
              if (list.some(m => m.depthWrite)) meshes.push(o);
            });
            const pixel = (p: import('three').Vector3) => { const v = p.clone().project(game.view.camera); return { x: (v.x + 1) * 800, y: (1 - v.y) * 450 }; };
            const rejects: unknown[] = [];
            const visible = (p: import('three').Vector3, cap: boolean) => {
              const origin = game.view.camera.position, distance = origin.distanceTo(p);
              ray.set(origin, p.clone().sub(origin).normalize()); ray.far = distance + (cap ? .05 : .3);
              const hit = ray.intersectObjects(meshes, false)[0];
              if (!hit || Math.abs(hit.distance - distance) > (cap ? .12 : .25)) { if (rejects.length < 8) rejects.push({ cap, target: p.toArray(), distance, hit: hit && { distance: hit.distance, point: hit.point.toArray(), name: hit.object.name, parent: hit.object.parent?.name } }); return false; }
              if (cap && hit.object.parent?.name !== 'walkable-height-step-edges') return false;
              if (!cap) p.copy(hit.point);
              const pp = pixel(p); return pp.x > 3 && pp.x < 1597 && pp.y > 3 && pp.y < 897;
            };
            const probes = [];
            for (const f of [.25, .5, .75]) {
              const px = e.a[0] + tx * f, pz = e.a[1] + tz * f;
              const cap = rig.focus.clone().set(px - e.outward[0] * .12, e.upper + .025, pz - e.outward[1] * .12);
              if (!visible(cap, true)) continue;
              for (let offset = .6; offset <= 8; offset += .2) {
                const lx = px + e.outward[0] * offset, lz = pz + e.outward[1] * offset;
                // The metro exit's visible landing continues beyond this authored
                // support box at 0.6 m: compare its kerb with that adjacent landing.
                const landing = spot.name === 'northgate-platform';
                const height = landing ? .6 : game.world.districts!.pavingHeight(lx, lz);
                if (!landing && height >= e.upper - .3) continue;
                const lower = rig.focus.clone().set(lx, height, lz);
                if (!visible(lower, false)) continue;
                probes.push({ fraction: f, cap: pixel(cap), lower: pixel(lower), capWorld: cap.toArray(), lowerWorld: lower.toArray() }); break;
              }
            }
            return { referenceSurface: spot.name === 'northgate-platform' ? 'continuous metro landing at 0.6 m' : 'visible lower ground', probes, rejects, player: hero, camera: a.getState().render.camera, lighting: a.getState().render.lighting, perf: a.perf(), figures: a.query({}).filter(e => !e.hidden && (e.id === 1 || e.infected || e.civilian || e.companion)).map(e => e.transform) };
          }, { spot, zoom, preset });
          const midpoint = [(spot.edge.a[0] + spot.edge.b[0]) / 2, (spot.edge.a[1] + spot.edge.b[1]) / 2];
          assert.ok(Math.hypot(state.camera.target[0] - midpoint[0], state.camera.target[2] - midpoint[1]) < 3, `${spot.name}: camera left the edge`);
          const name = `${spot.level}-${spot.name}-${tier}-${light}-z${zoom}`;
          await session.page.screenshot({ path: `${out}/${name}.png` });
          assert.equal(state.perf.backend, 'webgpu'); assert.equal(state.perf.quality.tier, tier);
          assert.ok(Math.abs(state.camera.zoom - zoom) < .001);
          const previous = rows.findIndex(r => r.name === name); if (previous >= 0) rows.splice(previous, 1);
          rows.push({ name, spot, tier, light, preset, zoom, ...state, errors: [...session.errors] });
          writeFileSync(`${out}/evidence.json`, JSON.stringify(rows, null, 2));
          console.log(name);
        }
      }
      assert.deepEqual(session.errors, []);
    } finally { await session.close(); }
  }
} finally { stopServer(); }
