import { SceneSession, readSpec, stopServer, writeJson } from '../scenelab/session';

const phase = process.argv[2] ?? 'after';
const tier = process.argv[3] === 'low' ? 'low' : 'high';
const session = new SceneSession({ tier, viewport: tier === 'low' ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
try {
  await session.open();
  for (const name of process.argv[4] ? [process.argv[4]] : ['focus', 'block', 'gap', 'prone']) {
    const spec = readSpec(`tests/scenes/l4-systems/${name}.json`);
    if (tier === 'low') spec.camera = { mode: 'game', target: name === 'focus' ? [2, 3] : [0, 0], zoom: (name === 'focus' ? 1.7 : name === 'gap' ? 1.5 : 1.15) * 2.2 };
    await session.load(spec);
    const actors = (await session.describe()).actors;
    const samples = [];
    for (const frame of spec.shots!) {
      await session.step(frame - await session.page.evaluate(() => window.__SCENE__!.frame));
      await session.screenshot(`docs/reports/l4-systems/${phase}/${spec.name}-${tier}/shot-${String(frame).padStart(4, '0')}.png`);
      samples.push(await session.page.evaluate(actors => {
        const api = window.__SS__!;
        const perf = api.perf();
        return { frame: window.__SCENE__!.frame, perf: { drawCalls: perf.drawCalls, triangles: perf.triangles, awakeProps: perf.awakeProps, backend: perf.backend }, actors: actors.map(a => {
          const e = api.getEntity(a.entity)!;
          return { name: a.id, entity: { id: e.id, archetype: e.archetype, health: e.health, transform: e.transform,
            state: e.civilian?.state ?? e.infected?.state, ally: e.civilian?.ally, knockedUntil: e.civilian?.knockedUntil, special: e.infected?.specialAttack } };
        }),
          barricades: api.barricades.slots(), events: api.events().filter(e => ['civilian.state', 'ally.attack', 'combat.hit', 'barricade.damaged', 'barricade.broken', 'infected.special'].includes(e.type)) };
      }, actors));
    }
    writeJson(`docs/reports/l4-systems/${phase}/${spec.name}-${tier}/proof.json`, { phase, tier, samples, errors: session.errors });
    console.log(JSON.stringify({ phase, tier, name, errors: session.errors, samples: samples.map(s => ({ frame: s.frame, draws: s.perf.drawCalls, triangles: s.perf.triangles, events: s.events.length })) }));
  }
} finally { await session.close(); stopServer(); }
