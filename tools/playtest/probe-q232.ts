/** Q-232: real-input hold at the recorded five-survivor Metro ingress pose. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const out = process.argv[2] ?? 'test-results/q232-corgi/metro-before';
const runs = Number(process.argv[3] ?? 5);
mkdirSync(out, { recursive: true });
try {
  for (let run = 1; run <= runs; run++) {
    const session = new SceneSession({ backend: 'webgl2', tier: 'low', viewport: { width: 1280, height: 720 } });
    try {
      await session.open();
      const spec = JSON.parse(readFileSync('tests/scenes/catalog/l5-po-metro-ingress.json', 'utf8')) as SceneSpec;
      spec.camera = { mode: 'follow', actor: 'courier', zoom: 1.5 };
      await session.load(spec); await session.ready();
      const page = session.page;
      await page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, m = w.missions!, s = m.state.l5!;
        const log: unknown[] = [], inputs: unknown[] = [];
        Object.assign(window, { __q232: { log, inputs } });
        const tap = g.input.tap;
        g.input.tap = (frame, scheme) => { tap?.(frame, scheme); if (frame.moveTarget || frame.move.x || frame.move.z) inputs.push({ tick: w.tick, scheme, frame: structuredClone(frame) }); };
        w.events.on('sim.tick', () => {
          if (w.missions !== m) return;
          const door = m.def.anchors['l5-metro-shutter'];
          log.push({ tick: w.tick, metroAt: s.metroAt, shutterAt: s.shutterAt, doneAt: s.doneAt, phase: s.phase, gateOpen: m.state.gates['l5-metro-shutter'],
            player: { ...w.entities.get(1)!.transform }, companion: [...w.entities.iterate()].filter(e => e.companion).map(e => ({ transform: { ...e.transform }, hidden: e.hidden, state: structuredClone(e.companion), locomotion: structuredClone(e.locomotion) })),
            survivors: s.survivors.map(r => { const e = w.entities.get(r.id)!; return { key: r.key, status: r.status, transform: { ...e.transform }, inside: m.l5!.insideStation(e.transform) && e.transform.z < door.z - 1 }; }) });
        }, 100);
        g.ui.show(null); g.view.unfreeze();
      });
      const target = await page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        return window.__SS__!.input.project(g.world.entities.get(1)!.transform, 'player');
      });
      await page.mouse.click(target.x, target.y);
      await page.evaluate(() => window.__SS__!.resume());
      let error: string | undefined;
      try { await page.waitForFunction(() => (window.__SCENE__ as unknown as { game: Game }).game.world.missions?.state.l5?.doneAt, null, { timeout: 60_000 }); }
      catch (e) { error = String(e); }
      await page.screenshot({ path: `${out}/run-${run}.png` });
      const audit = await page.evaluate('window.__q232') as { log: unknown[]; inputs: unknown[] };
      writeFileSync(`${out}/run-${run}.json`, JSON.stringify({ run, setup: 'recorded L5 production five-survivor stationary ingress fixture', input: 'one real ground click at the courier pose; normal real-time simulation, no stepping or gameplay mutation after setup', target, error, errors: session.errors, ...audit }));
      console.log(JSON.stringify({ run, samples: audit.log.length, error, errors: session.errors }));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
