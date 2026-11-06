/** Controlled counter check: production L6 hatch fronts, then normal unpaused mouse/keyboard combat. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { l6Entries } from '../../src/data/l6';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const tier = process.argv[2] === 'low' ? 'low' : 'high';
const out = `test-results/fix73-g/L6-counter-${tier}`; mkdirSync(out, { recursive: true });
const socket = createServer(); await new Promise<void>(done => socket.listen(0, '127.0.0.1', done));
const port = socket.address(); assert(port && typeof port === 'object');
process.env.SCENE_PORT = String(port.port); process.env.SCENE_SERVER = 'preview';
await new Promise<void>(done => socket.close(() => done()));
const { SceneSession, stopServer } = await import('../scenelab/session');
const session = new SceneSession({ tier, backend: 'webgl2', viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
const rows: unknown[] = [];
try {
  await session.open();
  const initial = await session.page.evaluate(async ({ tier, doors }) => {
    const a = window.__SS__!; await a.loadLevel('L6', { seed: 1, progression: 'L6-default' });
    a.pause(); a.missions.begin(); a.cheats.god(true); a.settings.set({ quality: tier as 'low' | 'high' }); a.camera.follow(); a.camera.zoom(1.5);
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    const controller = w.missions!.l6 as unknown as { spawn(n: number, doors: number[], wave: number): number };
    const ids = doors.map(door => {
      if (controller.spawn(1, [door], 4) !== 1) throw new Error('Production hatch admission refused');
      return w.missions!.state.l6!.spawnLog.at(-1)!.id;
    });
    // Setup only: bring the two real hatch fronts to one isolated tunnel
    // counter fixture. No actors are removed, frozen or edited after resume.
    a.teleport(1, { x: 80, z: 15 });
    for (const [i, id] of ids.entries()) {
      a.teleport(id, { x: 88, z: 15 + i * 4 });
      w.entities.get(id)!.transform.yaw = Math.PI; w.infected!.pursueTarget(id, 1);
    }
    return ids.map(id => { const e = w.entities.get(id)!; return { id, archetype: e.archetype, hp: e.health.max, shield: e.combat!.shield, radius: e.combat!.radius, speed: e.infected!.speed }; });
  }, { tier, doors: l6Entries.slice(0, 2).map(entry => entry.door) });
  assert(initial.every(e => e.archetype === 'infected.riot' && e.hp === 600 && e.shield && e.radius === .5 && e.speed === 4.5));
  rows.push({ initial });
  await session.page.evaluate(() => window.__SS__!.resume());
  await session.page.keyboard.press('Digit5');
  for (const actor of initial) {
    const deadline = Date.now() + 20000; let photographed = false, last: unknown;
    await session.page.waitForFunction(id => { const a = window.__SS__!, p = a.input.project(a.getEntity(id)!.transform); return p.x > 10 && p.x < innerWidth - 10 && p.y > 60 && p.y < innerHeight - 60; }, actor.id);
    const aim = await session.page.evaluate(id => window.__SS__!.input.project(window.__SS__!.getEntity(id)!.transform), actor.id);
    await session.page.mouse.move(aim.x, aim.y); await session.page.keyboard.down('Shift'); await session.page.mouse.down();
    while (Date.now() < deadline) {
      const sample = await session.page.evaluate(id => {
        const a = window.__SS__!, e = a.getEntity(id)!;
        const hits = a.events().filter(event => event.type === 'combat.hit' && event.sourceId === 1 && event.targetId === id);
        const breaks = hits.filter(event => event.type === 'combat.hit' && event.shieldBreak);
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        return { tick: a.tick(), hp: e.health.current, breaks, hits, at: a.input.project(e.transform, 'destination'), brokenUntil: e.combat?.shieldBrokenUntil,
          paused: g.clock.paused, player: { ...g.world.entities.get(1)!.transform }, weapons: g.world.entities.get(1)!.weapons,
          input: g.world.inputFrame, attacks: a.events().filter(event => event.type === 'combat.attack' && event.sourceId === 1).length };
      }, actor.id);
      last = sample;
      await session.page.mouse.move(sample.at.x, sample.at.y);
      if (sample.breaks.length && !photographed) {
        assert.equal(sample.brokenUntil! - sample.breaks.at(-1)!.tick, 90, 'Shield opening must last 90 ticks (1.5 seconds)');
        await session.page.screenshot({ path: `${out}/shield-break-${actor.id}.jpg`, type: 'jpeg', quality: 90 });
        rows.push({ actor, breakTick: sample.breaks[0].tick, windowTicks: sample.brokenUntil! - sample.breaks.at(-1)!.tick, sample }); photographed = true;
      }
      if (sample.hp <= 0) { rows.push({ downed: actor.id, tick: sample.tick, hp: sample.hp }); break; }
      await session.page.waitForTimeout(50);
    }
    await session.page.mouse.up(); await session.page.keyboard.up('Shift');
    rows.push({ last });
    assert(photographed, `Actual frontal input must break hatch shield ${actor.id}`);
    assert(await session.page.evaluate(id => window.__SS__!.getEntity(id)!.health.current <= 0, actor.id), '600-HP front must be resolvable by normal fire');
  }
  await session.page.screenshot({ path: `${out}/resolved.jpg`, type: 'jpeg', quality: 90 });
  assert.deepEqual(session.errors, []);
} finally {
  if (session.isOpen) await session.page.screenshot({ path: `${out}/diagnostic-final.jpg`, type: 'jpeg', quality: 90 });
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), tier, rows, errors: session.errors,
    method: 'Controlled fixture, not a whole-route or survival proof. Production L6 hatch spawn creates two shield fronts at 600 HP. Setup relocates them and courier before resume; then only ordinary unpaused keyboard/mouse. Courier protection disclosed. No actor removals, freezing, HP edits, manual steps or performance timing.' }, null, 2));
  await session.close(); stopServer();
}
