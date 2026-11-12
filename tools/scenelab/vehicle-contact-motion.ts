/** Vehicle-contact motion diagnostic. Run under e2e-lock with SCENE_PORT=49xx. */
import { mkdirSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import type { Game } from '../../src/Game';
const out = 'test-results/s83-vehicleslide/native-contact';
mkdirSync(out, { recursive: true });
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier });
    try {
      await session.open();
      for (const name of ['ram', 'surrounded']) {
        await session.load(readSpec(`tests/scenes/l9-apc/${name}.json`));
        await session.ready();
        // Match the production vehicle AI path; Scene Lab's L1 search controller
        // otherwise walks away from a hidden driver instead of pursuing the hull.
        await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          for (const e of w.infected!.active) { delete e.infected!.l1; e.infected!.state = 'chase'; }
        });
        const cells: { frame: number; jpeg: Buffer }[] = [];
        for (let frame = 1; frame <= 300; frame++) {
          await session.step(1);
          if (tier === 'high' && name === 'surrounded' && frame >= 140 && frame <= 145) cells.push({ frame, jpeg: await session.snapshot() });
        }
        if (cells.length) await session.makeSheet(cells, `${out}/apc-consecutive.jpg`, 480);
        const metrics = await session.metrics();
        const events = await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          return w.events.events().filter(e => e.type.startsWith('vehicle.') || e.type === 'combat.hit');
        });
        const actors = Object.entries(metrics.actors).filter(([id]) => id.startsWith('infected'));
        const checks = actors.map(([id, actor]) => ({ actor: id, contacts: actor.motion.contacts,
          p95Cm: actor.motion.slideP95Cm, maxCm: actor.motion.slideMaxCm,
          pass: actor.motion.contacts >= 5 && actor.motion.slideP95Cm !== null && actor.motion.slideP95Cm <= 5 && actor.motion.slideMaxCm <= 15 }));
        const contactProven = name === 'ram' ? events.filter(e => e.type === 'combat.hit').length >= 6
          : events.filter(e => e.type === 'vehicle.attack-windup').length >= 4 && events.some(e => e.type === 'vehicle.durability-hit');
        const pass = contactProven && checks.every(check => check.pass) && session.errors.length === 0;
        if (!pass) process.exitCode = 1;
        writeJson(`${out}/${tier}-${name}.json`, { pass, contactProven, checks, metrics, events });
        console.log(JSON.stringify({ tier, name, events: events.length, actors: Object.fromEntries(Object.entries(metrics.actors).filter(([id]) => id.startsWith('infected')).map(([id, actor]) => [id, actor.motion])) }));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
