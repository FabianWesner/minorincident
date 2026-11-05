import type { SimWorld } from '../../src/sim/world/SimWorld';
import { SceneSession, readSpec, stopServer, writeJson } from './session';

const session = new SceneSession({ backend: 'webgpu', tier: 'high', viewport: { width: 960, height: 540 } });
try {
  await session.open();
  await session.load(readSpec('tests/scenes/catalog/l5-po-metro-ingress.json'));
  const samples = [];
  for (let frame = 0; frame <= 600; frame += 15) {
    if (frame) await session.step(15);
    samples.push(await session.page.evaluate(frame => {
      const w = (window.__SCENE__ as unknown as { world: SimWorld }).world, s = w.missions!.state.l5!;
      return { frame, tick: w.tick, metroAt: s.metroAt, shutterAt: s.shutterAt, doneAt: s.doneAt, phase: s.phase,
        player: w.entities.get(1)!.transform,
        followers: s.survivors.map(r => ({ key: r.key, status: r.status, at: w.entities.get(r.id)?.transform })),
        companion: [...w.entities.iterate()].filter(e => e.companion).map(e => e.transform) };
    }, frame));
  }
  writeJson(`test-results/n28-followups/metro-${process.argv[2] ?? 'timing'}.json`, samples);
  console.log(JSON.stringify(samples.at(-1)));
} finally { await session.close(); stopServer(); }
