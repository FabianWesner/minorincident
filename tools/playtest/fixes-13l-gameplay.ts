import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { Object3D } from 'three';
import type { Game } from '../../src/Game';
import type { ProgressionPreset } from '../../src/sim/progression/Campaign';

export const gameplayProofDir = 'test-results/playtest/fixes-13l-gameplay';
export async function loadGameplayProof(page: Page, level: 'L5' | 'L6' | 'L8' | 'L9' | 'L10') {
  mkdirSync(gameplayProofDir, { recursive: true });
  await page.evaluate(async level => {
    const a = window.__SS__!;
    await a.loadLevel(level, { seed: 1, progression: (level === 'L9' ? 'L8-default' : `${level}-default`) as ProgressionPreset });
    a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow();
  }, level);
}

/** Fixture placement ends before the physical W press; the ordinary drive trigger owns the entire fall. */
export async function collapseProof(page: Page) {
  await loadGameplayProof(page, 'L9');
  await page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    const anchor = g.world.missions!.def.anchors['crash-approach'];
    a.teleport(g.world.missions!.l9!.state.carId, { x: anchor.x - 12, z: anchor.z });
    g.world.vehicles!.rebuild(); await a.step(1);
  });
  await page.keyboard.down('KeyW');
  try {
    for (let i = 0; i < 600; i++) {
      const phase = await page.evaluate(async () => { await window.__SS__!.step(1); return (window.__SCENE__ as unknown as { game: Game }).game.world.missions!.l9!.state.phase; });
      if (phase === 'fall') break;
    }
  } finally { await page.keyboard.up('KeyW'); }
  const samples = [];
  for (const [index, ticks] of [36, 36, 48].entries()) {
    const batch = await page.evaluate(async ticks => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, rows = [];
      for (let frame = 0; frame < ticks; frame++) {
        const s = w.missions!.l9!.state; g.view.update(1);
        const car = w.vehicles!.cars.get(s.carId)!;
        const view = g.view.labProbes().vehicles as unknown as { records: Map<number, { parent: Object3D; model: Object3D; wheels: { node: Object3D; y: number }[] }> };
        const r = view.records.get(s.carId)!;
        rows.push({ tick: w.tick, phase: s.phase, simY: car.physics.transform.y, drawnY: r.parent.position.y, meshes: r.model.children.length,
          wheels: r.wheels.map((wheel, i) => ({ name: wheel.node.name, y: wheel.node.position.y, expected: wheel.y + car.physics.def.suspension - car.physics.wheels[i < 4 ? i : i - 2].suspension })) });
        await window.__SS__!.step(1);
      }
      return rows;
    }, ticks);
    samples.push(...batch);
    await page.screenshot({ path: `${gameplayProofDir}/Q-136-fall-${index + 1}.png` });
  }
  writeFileSync(`${gameplayProofDir}/Q-136.json`, JSON.stringify(samples, null, 2));
  return samples;
}

/** Physical throttle frames include every initial companion boarding frame. */
export async function companionBoardingProof(page: Page) {
  await loadGameplayProof(page, 'L9');
  const samples = [];
  await page.keyboard.down('KeyW');
  try {
    for (let tick = 0; tick <= 60; tick++) {
      samples.push(await page.evaluate(() => {
        const a = window.__SS__!, dog = a.query({}).find(e => e.companion)!;
        return { tick: a.tick(), hidden: !!dog.hidden, aboard: dog.passengerOf, transform: dog.transform };
      }));
      if ([0, 6, 30].includes(tick)) await page.screenshot({ path: `${gameplayProofDir}/Q-137-${tick}.png` });
      await page.evaluate(() => window.__SS__!.step(1));
    }
  } finally { await page.keyboard.up('KeyW'); }
  writeFileSync(`${gameplayProofDir}/Q-137.json`, JSON.stringify(samples, null, 2));
  return samples;
}

/** Walk away without E, then return and collect with the physical E key. */
export async function headlampProof(page: Page) {
  await loadGameplayProof(page, 'L6');
  const lamp = await page.evaluate(() => {
    const a = window.__SS__!, lamp = a.query({}).find(e => e.archetype === 'pickup.headlamp')!;
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.teleport(1, { x: lamp.transform.x + 2, z: lamp.transform.z });
    const dog = g.world.entities.values().find(e => e.companion)!;
    // A checkpoint with an already selected fetch target must revalidate eligibility too.
    Object.assign(dog.transform, lamp.transform); dog.companion!.state = 'fetch'; dog.companion!.pickup = lamp.id;
    return { id: lamp.id, x: lamp.transform.x, z: lamp.transform.z };
  });
  await page.keyboard.down('KeyD'); await page.evaluate(() => window.__SS__!.step(90)); await page.keyboard.up('KeyD');
  await page.evaluate(() => window.__SS__!.step(600));
  const away = await page.evaluate(id => {
    const a = window.__SS__!, lamp = a.getEntity(id)!;
    return { lamp: lamp.transform, player: a.getEntity(1)!.transform, fetched: a.query({}).find(e => e.companion)!.companion!.pickup, item: a.missions.state()!.items.includes('headlamp') };
  }, lamp.id);
  await page.screenshot({ path: `${gameplayProofDir}/Q-138-lamp-left-behind.png` });
  await page.evaluate(lamp => window.__SS__!.teleport(1, { x: lamp.x + .7, z: lamp.z }), lamp);
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(24)); await page.keyboard.up('KeyE');
  const collected = await page.evaluate(() => window.__SS__!.missions.state()!.items.includes('headlamp'));
  const proof = { lamp, away, collected }; writeFileSync(`${gameplayProofDir}/Q-138.json`, JSON.stringify(proof, null, 2));
  return proof;
}

/** The physical destination click and E hold use the same ring whose visible pixels are measured. */
export async function busSearchProof(page: Page) {
  await loadGameplayProof(page, 'L5');
  await page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.cheats.completeObjective('emerge'); await a.step(661); a.cheats.killAll();
    const ring = g.world.missions!.def.anchors['l5-ring-sam'];
    a.teleport(1, { x: ring.x + 2, z: ring.z + 3 });
    g.view.view.zoom(Math.log(1.5 / g.view.view.getState().targetZoom), true);
    a.camera.follow(); await a.step(1); await a.screenshotReady();
  });
  const destination = await page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game, a = g.world.missions!.def.anchors['l5-ring-sam'];
    return window.__SS__!.input.project({ x: a.x, z: a.z });
  });
  await page.mouse.click(destination.x, destination.y); await page.evaluate(() => window.__SS__!.step(20));
  const draw = async (mode: 'actual' | 'hidden' | 'full') => {
    await page.evaluate(async mode => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const ring = g.view.scene.getObjectByName('survivor-ring-sam') as unknown as { visible: boolean; material: { depthTest: boolean; needsUpdate: boolean } };
      ring.visible = mode !== 'hidden'; ring.material.depthTest = mode !== 'full'; ring.material.needsUpdate = true;
      g.view.update(1); await window.__SS__!.screenshotReady();
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, mode);
    return page.screenshot({ path: `${gameplayProofDir}/Q-140-${mode}.png` });
  };
  const actual = await draw('actual'), hidden = await draw('hidden'), full = await draw('full');
  await draw('actual');
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(100)); await page.keyboard.up('KeyE');
  const state = await page.evaluate(() => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    return { status: a.missions.state()!.l5!.survivors.find(r => r.key === 'sam')!.status,
      ring: g.world.missions!.def.anchors['l5-ring-sam'], player: a.getEntity(1)!.transform, zoom: g.view.view.getState().targetZoom };
  });
  return { actual, hidden, full, state };
}

/** Activate the real hold console, then aim/fire via mouse and Space against a nearby ordinary infected. */
export async function consoleDamageProof(page: Page) {
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L10', { seed: 1, checkpoint: 'cure-complex', progression: 'L10-default' });
    a.pause(); a.missions.begin(); a.cheats.god(true);
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.teleport(1, g.world.missions!.def.anchors['cure-install']);
  });
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(40)); await page.keyboard.up('KeyE');
  await page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    window.__SS__!.teleport(1, g.world.missions!.def.anchors['cure-console']);
  });
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('KeyE');
  const samples = [];
  for (const key of ['3', '4', '5', '6']) {
    const fixture = await page.evaluate(async () => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
      a.cheats.killAll();
      const c = w.missions!.def.anchors['cure-console'];
      let at: { x: number; z: number; tx: number; tz: number } | undefined;
      for (let r = 3; r <= 8 && !at; r++) for (let i = 0; i < 16 && !at; i++) {
        const dx = Math.cos(i * Math.PI / 8), dz = Math.sin(i * Math.PI / 8), x = c.x + r * dx, z = c.z + r * dz, tx = x + 1.1 * dx, tz = z + 1.1 * dz;
        if (w.infected!.nav.clear(tx, tz, .4) && w.solids.clear({ x, y: .7, z }, .4, 1, false)) at = { x, z, tx, tz };
      }
      if (!at) throw new Error('No clear console duel position');
      a.teleport(1, at); a.camera.follow(); g.view.view.reset(w.entities.get(1)!.transform, true);
      const id = w.infected!.spawn('infected.runner', { x: at.tx, z: at.tz });
      w.entities.get(id)!.combat!.staggerUntil = w.tick + 1000;
      await a.step(1); await a.screenshotReady();
      return { id, initial: a.getEntity(id)!.health.current, distance: 1.1, aim: a.input.project({ x: at.tx, z: at.tz }) };
    });
    await page.keyboard.press(key); await page.evaluate(() => window.__SS__!.step(1));
    await page.mouse.move(fixture.aim.x, fixture.aim.y);
    await page.keyboard.down('Space'); await page.evaluate(() => window.__SS__!.step(480)); await page.keyboard.up('Space');
    const after = await page.evaluate(id => {
      const a = window.__SS__!, p = a.getEntity(1)!, s = a.missions.state()!, rack = p.weapons![p.weapons!.selectedSide];
      return { hp: a.getEntity(id)!.health.current, action: rack.rack[rack.index].id, hold: s.steps.hold.status, charge: s.counters['charge-ticks'] };
    }, fixture.id);
    samples.push({ key, ...fixture, ...after });
    await page.screenshot({ path: `${gameplayProofDir}/Q-149-weapon-${key}.png` });
  }
  writeFileSync(`${gameplayProofDir}/Q-149.json`, JSON.stringify(samples, null, 2)); return samples;
}

/** Re-enter the reported off-road stop pose, then use only physical forward input. */
export async function mergeClearanceProof(page: Page) {
  await loadGameplayProof(page, 'L9');
  await page.evaluate(async () => {
    const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    a.teleport(w.missions!.l9!.state.carId, { x: 402, z: -16.8 }); w.vehicles!.rebuild(); await a.step(1);
  });
  const samples = [];
  await page.keyboard.down('KeyW');
  try {
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.__SS__!.step(60));
      const pose = await page.evaluate(() => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        return { tick: w.tick, ...w.entities.get(w.missions!.l9!.state.carId)!.transform };
      });
      samples.push(pose); if (pose.x > 447) break;
    }
  } finally { await page.keyboard.up('KeyW'); }
  writeFileSync(`${gameplayProofDir}/Q-139.json`, JSON.stringify(samples, null, 2));
  await page.screenshot({ path: `${gameplayProofDir}/Q-139-forward.png` }); return samples;
}
