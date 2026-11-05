/** Q-285: search existing L4 café geometry for a visible head with a culled bar. No prop placements change. */
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { Ray as PhysicsRay } from '@dimforge/rapier3d-compat';
const session = new SceneSession({ backend: 'webgl2', tier: 'high', query: { ui: '1', test: '1' } });
const fixed = process.env.UAT_OCCLUSION_FIXED !== '0';
try {
  await session.open(); const page = session.page;
  if (!fixed) {
    // Reproduce the former torso-center ray with identical current assets and
    // geometry; this request override never changes production files.
    await page.route('**/src/render/HealthBars.ts*', async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace('this.center.y = Math.max(this.center.y, this.bounds.max.y - 0.05);', '');
      await route.fulfill({ response, body });
    });
    await page.reload(); await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__, null, { timeout: 120_000 });
    await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  }
  await page.evaluate('window.__name = fn => fn');
  const result = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L4', { seed: 1, progression: 'L4-default', checkpoint: 'line-break' }); a.pause();
    const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    for (const e of w.entities.iterate()) if (e.civilian) e.hidden = true;
    document.documentElement.setAttribute('data-scene-hud', ''); document.querySelectorAll('#hud,.hud').forEach(e => e.setAttribute('data-scene-hud', ''));
    const threeUrl = '/node_modules/three/build/three.webgpu.js', bodyUrl = '/src/render/characters/PickBodies.ts';
    const { Box3 } = await import(threeUrl) as typeof import('three/webgpu');
    const { pickBodies } = await import(bodyUrl) as typeof import('../../src/render/characters/PickBodies');
    const id = a.spawn('infected.riot', { x: -61, z: 51.5 }, { yaw: 0, state: 'idle' }); a.camera.follow(); a.camera.zoom(1);
    const box = new Box3(), center = g.view.camera.position.clone(), head = center.clone();
    const solid = (c: import('@dimforge/rapier3d-compat').Collider) => !c.isSensor() && c.shapeType() === 1;
    const rayHit = (target: typeof center) => {
      const c = g.view.camera.position, direction = target.clone().sub(c), distance = direction.length(); direction.normalize();
      const ray: PhysicsRay = { origin: c, dir: direction, pointAt: t => c.clone().addScaledVector(direction, t) };
      return w.physics.world!.castRay(ray, distance - .01, true, undefined, undefined, undefined, undefined, solid);
    };
    const probes = [];
    for (const x of [-61.5, -61.3, -61.1, -60.9, -60.7]) for (const z of [51.3, 51.5, 51.7, 51.9, 52.1]) {
      if (!w.infected!.nav.clear(x, z, .4)) continue;
      a.teleport(1, { x: x + 3, z }); a.teleport(id, { x, z }); await a.screenshotReady();
      if (!pickBodies.bounds(id, box)) continue; box.getCenter(center); head.copy(center); head.y = box.max.y - .05;
      const bodyHit = rayHit(center), headHit = rayHit(head), bars = g.view.getState().healthBars!;
      const rect = bars.bars.find(b => b.id === id);
      const probe = { actor: { ...w.entities.get(id)!.transform }, player: { ...w.entities.get(1)!.transform }, camera: g.view.camera.position.toArray(), bounds: { min: box.min.toArray(), max: box.max.toArray() }, bar: !!rect, rect, bodyHit: bodyHit?.collider.translation(), headHit: headHit?.collider.translation() };
      probes.push(probe);
      if (bodyHit && !headHit) return { reproduced: true, selected: probe, probes };
    }
    return { reproduced: false, probes };
  });
  const path = `test-results/uat-l4-infected/cafe-occlusion-${fixed ? 'fixed' : 'before'}`;
  const capture = await session.screenshot(`${path}.png`);
  let fillPixels = 0;
  if (fixed) {
    const rect = result.selected?.rect; assert.ok(rect);
    const png = PNG.sync.read(capture);
    for (let y = Math.floor(rect.y - rect.height / 2); y < rect.y + rect.height / 2; y++) for (let x = Math.floor(rect.x - rect.width / 2); x < rect.x + rect.width / 2; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] > 160 && png.data[i + 1] < 160 && png.data[i + 2] < 160 && Math.abs(png.data[i + 1] - png.data[i + 2]) < 15) fillPixels++;
    }
    assert.ok(fillPixels >= rect.width * rect.height * .8, 'the emitted bar is visibly filled in the player camera');
  }
  writeFileSync(`${path}.json`, JSON.stringify({ ...result, fillPixels, errors: session.errors }, null, 2));
  console.log(JSON.stringify(result));
  assert.ok(result.reproduced, 'the existing lamp must cover the torso but leave the head clear');
  assert.equal(result.selected!.bar, fixed, 'the fixed bar remains visible over partial cover');
  if (fixed) {
    const street = await page.evaluate(async () => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
      const { l4InfectedArchetypes } = await import('/src/data/l4.ts' as string) as typeof import('../../src/data/l4');
      const checks = [];
      for (const e of [...w.infected!.active]) w.infected!.release(e);
      // All regular emergence paths share InfectedSystem.spawn; arrivals add a
      // scripted goal. Exercise both states at the actual hydrant street pose.
      for (const archetype of [...l4InfectedArchetypes, 'infected.alpha']) for (const scripted of [false, true]) {
        const id = a.spawn(archetype, { x: -61.5, z: 51.5 }, { yaw: 0, state: 'idle' }), e = w.entities.get(id)!;
        if (scripted) e.infected!.scripted = { x: -62, z: 52 };
        await a.screenshotReady();
        const bar = g.view.getState().healthBars!.bars.some(b => b.id === id);
        const health = e.health.current;
        const damage = w.combat!.damage.apply({ attackId: id + w.tick, actionId: 'weapon.army-mg', sourceId: 1, targetId: id,
          origin: { x: -64.5, z: 51.5 }, shotOrigin: { x: -64.5, z: 51.5 }, direction: { x: 1, z: 0 }, base: 1, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
        checks.push({ archetype, scripted, health, bar, damage }); w.infected!.release(e);
      }
      a.teleport(1, { x: -60.6, z: 51.5 }); w.npcs!.companion.respawnNear();
      const id = a.spawn('infected.riot', { x: -61.5, z: 51.5 }, { yaw: 0, state: 'chase' });
      await a.step(12); await a.screenshotReady();
      const e = w.entities.get(id)!, p = w.entities.get(1)!;
      return { checks, melee: { id, actor: { ...e.transform }, player: { ...p.transform }, distance: Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z),
        bar: g.view.getState().healthBars!.bars.find(b => b.id === id), state: e.infected!.state, attacking: e.combat!.attacking,
        hp: e.health.current, playerHP: p.health.current, gear: p.survivor!.gearTier, dog: [...w.entities.iterate()].find(e => e.companion)?.id } };
    });
    await session.screenshot('test-results/uat-l4-infected/hydrant-melee.png');
    writeFileSync('test-results/uat-l4-infected/hydrant-melee.json', JSON.stringify(street, null, 2));
    assert.equal(street.checks.length, 14);
    assert.ok(street.checks.every(c => c.health > 0 && c.bar && c.damage > 0), JSON.stringify(street.checks));
    assert.ok(street.melee.distance < 1.2 && street.melee.bar && street.melee.attacking, JSON.stringify(street.melee));
    console.log(JSON.stringify(street));
  }
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
