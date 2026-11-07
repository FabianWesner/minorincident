/** Targeted production views for vqa58: checkpoint marker, reception corpses and damaged L9 APC. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, readSpec } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { staticCollision } from '../../src/assets/staticCollision';
import type { EntitySnapshot } from '../../src/sim/world/types';
import type { InstancedMesh } from 'three';

const backend = (process.argv[2] ?? 'webgpu') as 'webgpu' | 'webgl2';
const tier = (process.argv[3] ?? 'high') as 'low' | 'high';
const parts = (process.env.VQA_PARTS ?? 'l3,l4,l9').split(',');
const out = process.env.VQA_OUT ?? 'test-results/r5-vis/details';
mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend, tier, query: { ui: '1' } });
const rows: unknown[] = [];
try {
  await s.open(); await s.page.evaluate('window.__name = f => f');
  const shots = async (label: string) => {
    for (const zoom of [1, 1.5]) {
      await s.page.evaluate(async z => { const a = window.__SS__!; a.camera.zoom(z); await a.screenshotReady(); }, zoom);
      if (label.startsWith('L3')) rows.push(await s.page.evaluate(({ label, zoom }) => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        const marker = (g.view as unknown as { marker: import('three').Group }).marker, arrow = marker.children[1] as import('three').Mesh;
        const pos = arrow.getWorldPosition(arrow.position.clone());
        return { part: label, zoom, visible: marker.visible, arrowVisible: arrow.visible, depthTest: (arrow.material as import('three').Material).depthTest,
          crossedAt: g.world.missions!.state.l3!.crossedAt, at: pos.toArray(), projection: g.view.project(pos.x, pos.y, pos.z), camera: g.view.view.getState() };
      }, { label, zoom }));
      else rows.push(await s.page.evaluate(({ label, zoom }) => ({ part: label, zoom, camera: window.__SS__!.getState().render.camera }), { label, zoom }));
      await s.page.screenshot({ path: `${out}/${label}-${backend}-${tier}-z${zoom}.jpg`, type: 'jpeg', quality: 90 });
    }
  };
  if (parts.includes('l3')) {
    await s.load(readSpec('tests/scenes/catalog/l3-base-rendezvous.json'));
    await s.page.evaluate(() => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.world.missions!.state.l3!.crossedAt = 0;
      g.world.missions!.state.marker = 'l3-zone';
      a.teleport(1, { x: 219, z: -3 }); a.camera.follow(); g.view.view.reset(g.world.entities.get(1)!.transform);
    });
    await shots('L3-marker');
    // Same scene/frame with the old material: isolate the wall-depth defect.
    await s.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const marker = (g.view as unknown as { marker: { children: { material: { depthTest: boolean; needsUpdate: boolean } }[] } }).marker;
      const arrow = marker.children[1];
      arrow.material.depthTest = false; arrow.material.needsUpdate = true; });
    await shots('L3-marker-before');
    await s.page.evaluate(() => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.teleport(1, { x: 225, z: 8.6 }); g.view.view.reset(g.world.entities.get(1)!.transform);
      g.view.scene.traverse(node => { if (node.type === 'Group' && node.constructor.name === 'ObjectiveMarker') {
        const arrow = node.children[1] as unknown as { material: { depthTest: boolean; needsUpdate: boolean } };
        arrow.material.depthTest = true; arrow.material.needsUpdate = true;
      } }); });
    await shots('L3-marker-wall');
    await s.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.view.scene.traverse(node => { if (node.constructor.name === 'ObjectiveMarker') {
        const arrow = node.children[1] as unknown as { material: { depthTest: boolean; needsUpdate: boolean } };
        arrow.material.depthTest = false; arrow.material.needsUpdate = true;
      } }); });
    await shots('L3-marker-wall-before');
    // Low inspection angle through the actual checkpoint side wall. The normal
    // follow camera can see over it, so keep this separate from the zoom matrix.
    for (const depthTest of [false, true]) {
      await s.page.evaluate(async depthTest => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const marker = (g.view as unknown as { marker: import('three').Group }).marker;
        const arrow = marker.children[1] as import('three').Mesh;
        (arrow.material as import('three').Material).depthTest = depthTest;
        (arrow.material as import('three').Material).needsUpdate = true;
        a.camera.cinematic({ position: [235, 3, 15], target: [225, 2, 0] }, true);
        await a.screenshotReady();
      }, depthTest);
      await s.page.screenshot({ path: `${out}/L3-depth-${depthTest ? 'after' : 'before'}-${backend}-${tier}.jpg`, type: 'jpeg', quality: 90 });
    }
  }
  if (parts.includes('l4')) {
    await s.load({ name: 'r5-vis-registration', ground: 'district', time: 'L4', tier: 0,
      layout: { level: 'L4', district: 'D-FAIR', bbox: [[-40, -22], [-10, 8]] },
      actors: [{ id: 'courier', kind: 'courier', at: [-23, -9] }], camera: { mode: 'follow', actor: 'courier', zoom: 1 }, frames: 1 });
    const posts = staticCollision['kit.reception-plaza'].boxes.filter(b => b.max[0] - b.min[0] < .15 && b.max[2] - b.min[2] < .15 && b.max[1] < 1.1 && b.max[1] - b.min[1] > .75);
    rows.push(await s.page.evaluate(async posts => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.world.scenario = 'L4'; a.cheats.god(true);
      const ids: number[] = [];
      for (let i = 0; i < 24; i++) try { ids.push(a.spawn('infected.runner', { x: -29 + i % 8, z: i < 8 ? -7.35 : i < 16 ? -10.25 : -9 })); } catch { /* blocked post/table */ }
      await a.step(20); a.cheats.killAll(); await a.step(300); await a.screenshotReady();
      const intersections: { id: number; vertices: number }[] = [];
      g.view.scene.traverse(node => {
        const pool = node as unknown as { bodies?: Map<string, EntitySnapshot>; slots?: Map<string, { page: { mesh: InstancedMesh }; index: number }> };
        if (!pool.bodies || !pool.slots) return;
        for (const [key, body] of pool.bodies) {
          if (!ids.includes(body.id)) continue;
          const slot = pool.slots.get(key)!, mesh = slot.page.mesh, m = mesh.instanceMatrix.array, o = slot.index * 16, p = mesh.geometry.getAttribute('position');
          let vertices = 0;
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const wx = m[o] * x + m[o + 4] * y + m[o + 8] * z + m[o + 12] + 26;
            const wy = m[o + 1] * x + m[o + 5] * y + m[o + 9] * z + m[o + 13];
            const wz = m[o + 2] * x + m[o + 6] * y + m[o + 10] * z + m[o + 14] + 8.8;
            if (posts.some(b => wx > b.min[0] && wx < b.max[0] && wy > b.min[1] && wy < b.max[1] && wz > b.min[2] && wz < b.max[2])) vertices++;
          }
          if (vertices) intersections.push({ id: body.id, vertices });
        }
      });
      return { part: 'L4', spawned: ids.length, posts: posts.length, intersections, layout: a.debug.corpseLayout() };
    }, posts));
    await shots('L4-registration-corpses');
  }
  if (parts.includes('l9')) {
    await s.page.evaluate(async tier => {
      const a = window.__SS__!; a.settings.set({ quality: tier, cameraShake: false });
      await a.loadLevel('L9', { seed: 1, progression: 'L9-default' }); a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true);
    }, tier);
    const stages = [{ name: 'smoke', x: -550, z: 0 }, { name: 'roadside-group', x: -310, z: -330 }, { name: 'convoy', x: 465, z: 0 }];
    for (const at of stages) {
      await s.page.evaluate(async ({ at }) => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, vehicles = g.world.vehicles!;
        const car = vehicles.cars.get(vehicles.active!)!;
        car.physics.body.setTranslation({ x: at.x, y: car.entity.transform.y, z: at.z }, true);
        car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        if (at.name === 'smoke') vehicles.damage(car.entity.id, car.entity.health.max * .8);
        await a.step(5); g.view.view.reset(g.world.entities.get(1)!.transform);
        a.resume(); await new Promise(resolve => setTimeout(resolve, 1600)); a.pause(); await a.screenshotReady();
        if (at.name !== 'smoke') {
          // Centre the inspection frame without a story pull (story pulls
          // intentionally neutralize player zoom and would falsify the matrix).
          g.view.view.reset({ x: at.name === 'convoy' ? 480 : -303, y: g.world.entities.get(1)!.transform.y, z: at.z });
        }
      }, { at });
      rows.push(await s.page.evaluate(name => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, v = g.world.entities.get(g.world.vehicles!.active!)!;
        return { part: `L9-${name}`, at: v.transform, health: v.health, stage: v.vehicle!.stage, effects: a.perf().effects,
          nearby: a.query({ within: { x: v.transform.x, z: v.transform.z, r: 35 } }).filter(e => e.infected).map(e => ({ id: e.id, archetype: e.archetype, at: e.transform })) };
      }, at.name));
      await shots(`L9-${at.name}`);
    }
  }
} finally { writeFileSync(`${out}/receipt-${backend}-${tier}.json`, JSON.stringify({ rows, errors: s.errors }, null, 2)); await s.close(); stopServer(); }
