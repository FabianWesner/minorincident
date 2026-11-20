import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, origin, stopServer } from './session';

const spec = JSON.parse(readFileSync('specs/scenes/catalog/s183-flame-fight.json', 'utf8')) as SceneSpec;
spec.script = [
  { frame: 0, actor: 'courier', do: { select: 'LEFT' } },
  { frame: 0, actor: 'courier', do: { aim: 'target', seconds: 10 } },
  { frame: 30, actor: 'courier', do: { attack: 'target', seconds: 8, move: [0, 0] } },
];
const session = new SceneSession({ backend: 'webgl2' });
try {
  await session.open();
  for (const tier of ['high', 'low'] as const) {
    session.options.tier = tier;
    if (tier === 'low') {
      await session.page.goto(`${origin}/?test=1&scenelab=1&renderer=webgl&profile=1&dpr=1&quality=low&audio=muted&seed=1`);
      await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
      await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    }
    await session.load(structuredClone(spec));
    await session.page.evaluate(() => { window.__SS__!.cheats.infiniteCharges(true); window.__SS__!.cheats.god(true); });
    let maxParticles = 0, maxFlames = 0, maxDraws = 0, attacks = 0, active = 0;
    for (let i = 0; i < 72; i++) {
      await session.step(5);
      const sample = await session.page.evaluate(() => {
        const api = window.__SS__!, v = api.getState().render.vfx!;
        return { particles: v.particles, cap: v.particleCap, flames: v.blasts.flames, jet: !!v.blasts.flameJet, draws: api.perf().drawCalls, attacks: api.events(0).filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.flamethrower').length };
      });
      maxParticles = Math.max(maxParticles, sample.particles); maxFlames = Math.max(maxFlames, sample.flames); maxDraws = Math.max(maxDraws, sample.draws); attacks = sample.attacks; if (sample.jet) active++;
      assert(sample.particles <= sample.cap && sample.flames <= 128);
    }
    assert(attacks > 5 && active > 50, `sustained fire absent on ${tier}`);
    console.log(JSON.stringify({ tier, samples: 72, active, attacks, maxParticles, maxFlames, maxDraws }));
  }
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
