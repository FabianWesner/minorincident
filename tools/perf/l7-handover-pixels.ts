/** Fixed-tick L8 frame after the L7 loading path, with the original cast census. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';

const out = process.env.L7_HANDOVER_OUT ?? 'test-results/l7-perf/handover-pixels';
mkdirSync(out, { recursive: true });
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend, tier, phone: tier === 'low', seed: 29,
      viewport: tier === 'high' ? { width: 1600, height: 900 } : { width: 390, height: 844 } });
    try {
      await session.open();
      const state = await session.page.evaluate(async () => {
        const a = window.__SS__!;
        await a.loadLevel('L7', { seed: 29, progression: 'L7-default' }); a.pause();
        await a.loadLevel('L8', { seed: 29 }); a.missions.begin(); a.pause();
        await a.step(180); await a.screenshotReady();
        return { tick: a.tick(), perf: a.perf(), entities: a.query({}).map(e => ({ id: e.id, archetype: e.archetype, health: e.health, transform: e.transform, corpse: e.corpse })) };
      });
      const label = `L8-${backend}-${tier}`;
      await session.page.locator('canvas').screenshot({ path: `${out}/${label}.png` });
      writeFileSync(`${out}/${label}.json`, JSON.stringify(state));
      console.log(`${label}: tick ${state.tick}`);
      if (session.errors.length) throw Error(session.errors.join('\n'));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
