import { SceneSession, readSpec, stopServer } from './session';
import type { Game } from '../../src/Game';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'test-results/s232-vehicle-squash'; mkdirSync(out, { recursive: true });
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier });
    try {
      await session.open();
      const spec = readSpec('tests/scenes/l9-apc/ram.json');
      spec.camera!.zoom = 1; delete spec.expect;
      await session.load(spec);
      await session.page.evaluate(() => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        for (const e of w.infected!.active) { delete e.infected!.l1; e.infected!.state = 'chase'; }
        const events: { tick: number; targetId: number; runOver: boolean }[] = [];
        w.events.on('vehicle.infected-hit', e => { if (e.type === 'vehicle.infected-hit') events.push({ tick: e.tick, targetId: e.targetId, runOver: e.runOver }); });
        (window as unknown as { s232Events: typeof events }).s232Events = events;
      });
      const cells: { frame: number; jpeg: Buffer }[] = [];
      for (let frame = 0; frame <= 230; frame++) {
        if (frame) await session.step(1);
        if (frame % 10 === 0 && frame >= 70) { await session.ready(); cells.push({ frame, jpeg: await session.snapshot() }); }
      }
      await session.makeSheet(cells, `${out}/${tier}-apc.jpg`, 320);
      const evidence = await session.page.evaluate(() => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        return { events: (window as unknown as { s232Events: unknown[] }).s232Events, corpses: [...w.entities.iterate()].filter(e => e.squashed).map(e => ({ id: e.id, transform: e.transform, corpse: e.corpse })) };
      });
      writeFileSync(`${out}/${tier}-apc.json`, JSON.stringify(evidence, null, 2));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
