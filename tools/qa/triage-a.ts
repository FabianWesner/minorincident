/** Focused, pooled headless captures for the triage-a fixes. No production state is saved. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { l2 } from '../../src/data/l2';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';

const mode = process.argv[2] ?? 'hud';
const out = resolve(`docs/reports/triage-a/${mode}`);
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low', query: { ui: '1' } });
try {
  await session.open();
  await session.page.evaluate(() => {
    document.documentElement.setAttribute('data-scene-hud', '');
    document.querySelectorAll('.hud,#hud').forEach(e => e.setAttribute('data-scene-hud', ''));
  });
  if (mode === 'hud') {
    const before = await session.page.evaluate(async () => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      await a.loadLevel('L4', { seed: 1, checkpoint: 'turn', progression: 'L4-default' });
      a.missions.begin(); a.cheats.god(true); g.ui.show(null); a.pause();
      const id = g.world.vehicles!.spawn('vehicle.sedan', { x: -34.6, z: 5 });
      a.teleport(1, { x: -34.25, z: 6.6 }); a.camera.follow();
      const hint = g.ui.hud.onboarding;
      hint.reset(); hint.update('mouse-keyboard', true);
      await a.screenshotReady();
      return { tick: a.tick(), vehicle: id, player: a.getEntity(1)!.transform, car: a.getEntity(id)!.transform, canInteract: g.world.vehicles!.canInteract(), hidden: hint.element.hidden, text: hint.element.textContent };
    });
    assert.equal(before.canInteract, true, JSON.stringify(before)); assert.equal(before.hidden, false, JSON.stringify(before));
    assert.match(before.text ?? '', /Stand by the door to enter/);
    await session.page.getByTestId('onboarding-prompt').waitFor({ state: 'visible' });
    await session.screenshot(`${out}/hint-visible.png`);
    const after = await session.page.evaluate(async () => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      await a.step(180); g.ui.hud.onboarding.update('mouse-keyboard', true);
      await a.screenshotReady();
      return { tick: a.tick(), canInteract: g.world.vehicles!.canInteract(), hidden: g.ui.hud.onboarding.element.hidden };
    });
    assert.equal(after.canInteract, true); assert.equal(after.hidden, true);
    await session.screenshot(`${out}/hint-retired.png`);
    writeFileSync(`${out}/evidence.json`, JSON.stringify({ before, after, errors: session.errors }, null, 2));
  } else if (mode === 'route') {
    const receipt = await session.page.evaluate(async homes => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      await a.loadLevel('L2', { seed: 1, checkpoint: 'doors', progression: 'L2-default' });
      a.settings.set({ quality: 'low' }); a.missions.begin(); a.pause(); a.cheats.god(true); g.ui.show(null); await a.step(120);
      const s = g.world.missions!.state.l2!;
      return { tier: g.world.infected!.director.tier, homes: homes.map(([x, z]) => ({ x, z, clear: g.world.solids!.clear({ x, y: 0, z }, .3) })),
        arrivals: s.pending.filter(p => p.door.startsWith('l2-route-edge-')).map(p => ({ ...p, entity: p.id ? a.getEntity(p.id) : null })) };
    }, l2.escape.scattered);
    assert.equal(receipt.tier, 'low');
    assert.equal(receipt.homes.length, 6); assert.ok(receipt.homes.every(p => p.clear), JSON.stringify(receipt.homes));
    assert.equal(receipt.arrivals.length, 6); assert.ok(receipt.arrivals.every(p => p.id > 0));
    for (const [name, x, z] of [['juniper', -30.2, 2], ['elm', 6, 30]] as const) {
      await session.page.evaluate(async ({ x, z }) => {
        const a = window.__SS__!; a.teleport(1, { x, z }); a.camera.follow(); a.camera.zoom(1.5); await a.screenshotReady();
      }, { x, z });
      await session.screenshot(`${out}/${name}.png`);
    }
    writeFileSync(`${out}/evidence.json`, JSON.stringify({ ...receipt, highCount: l2.escape.scattered.reduce((n, p) => n + p[2], 0), errors: session.errors }, null, 2));
  } else if (mode === 'boarding') {
    await session.page.evaluate(async () => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      await a.loadLevel('L8', { seed: 1, progression: 'L8-default' });
      a.pause(); a.missions.begin(); a.cheats.god(true); g.ui.show(null);
      const zoo = g.world.missions!.l8!;
      zoo.advance(); a.cheats.killAll(); zoo.state.nextWave = g.world.tick + 100000;
      const door = zoo.door(), ids = zoo.passengers();
      a.teleport(1, door);
      for (const id of ids) a.teleport(id, { x: door.x + 80, z: door.z + 20 });
      a.teleport(ids.at(-1)!, { x: door.x + 15, z: door.z });
    });
    await session.page.keyboard.down('KeyE');
    await session.page.evaluate(() => window.__SS__!.step(1));
    await session.page.keyboard.up('KeyE');
    await session.page.evaluate(async () => { await window.__SS__!.step(3); await window.__SS__!.screenshotReady(); });
    const receipt = await session.page.evaluate(() => {
      const objective = document.querySelector('[data-testid="objective-text"]')!;
      const cue = document.querySelector('[data-testid="sign-of-life"]')!;
      const pin = document.querySelector('[data-testid="minimap-cue"]')!;
      return { text: objective.parentElement!.textContent, objective: objective.textContent, cue: cue.textContent, pin: pin.getAttribute('aria-label'), id: pin.getAttribute('data-survivor') };
    });
    assert.equal(receipt.text?.match(/\d+\/\d+ aboard/g)?.length, 1, JSON.stringify(receipt));
    const name = receipt.pin?.replace(/^Find /, '');
    assert.ok(name && receipt.objective?.includes(name) && receipt.cue?.includes(name), JSON.stringify(receipt));
    await session.screenshot(`${out}/guidance.png`);
    writeFileSync(`${out}/evidence.json`, JSON.stringify({ ...receipt, errors: session.errors }, null, 2));
  } else throw new Error(`Unknown triage capture mode: ${mode}`);
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
