import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { levelTenMission } from '../../../src/levels/L10/mission';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset, nextLevelAfter } from '../../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../../src/sim/progression/carryover';
import { decodeSave } from '../../../src/sim/progression/Save';
import { epilogueTicks, epiloguePull, pulloutTicks, titleTicks, creditsTicks } from '../../../src/sim/missions/LevelTenEpilogue';

async function ready(tier: 'high' | 'low' = 'high') {
  const w = new SimWorld(); await w.init(); w.loadScenario('mega-course'); applyCampaign(w, preset('L10-default'));
  w.infected!.director.setTier(tier);
  const anchors: Record<string, { x: number; z: number }> = {
    'epilogue-survivors': { x: 8, z: 8 }, 'epilogue-walk': { x: 0, z: 8 }, 'dispersal-horizon': { x: 36, z: 0 },
  };
  const m = w.loadMission(levelTenMission(name => ({ ...(anchors[name] ?? { x: 0, z: 0 }), radius: 2 })));
  m.begin(); m.loadCheckpoint('cure-disperse-ready');
  Object.assign(w.entities.get(1)!.transform, { x: 0, z: 0 }); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true);
  Object.assign(m.state.states, { 'charge-active': true, 'charge-ready': true, 'mega-dead': true });
  m.state.counters['charge-ticks'] = 3600; m.state.steps.hold.status = 'completed'; m.state.steps.release.status = 'active';
  w.events.on('level.completed', e => { if (e.type === 'level.completed') completeCampaignLevel(w.progression!.campaign!, 10, e.result, w); });
  const counts = { releases: 0, completions: 0, attacks: 0 };
  w.events.on('mission.signal', e => { if (e.type === 'mission.signal' && e.name === 'cure-released') counts.releases++; });
  w.events.on('level.completed', () => counts.completions++);
  w.events.on('combat.attack', () => counts.attacks++);
  w.setInput({ interact: true }); w.update(); w.clearInput();
  return { w, m, counts };
}
function step(w: SimWorld, ticks: number) { for (let i = 0; i < ticks; i++) w.update(); }
function elapsed(m: ReturnType<SimWorld['loadMission']>, ticks: number) { m.state.cureFront!.elapsed = ticks; m.state.cureFront!.radius = ticks / 6; }

test('T-E32-25/26-S9 @E32-AC25 @E32-AC26 150 s playable reversal, last 36 s eased pull retains walk/run; title then credits and once-only victory', async () => {
  const { w, m, counts } = await ready();
  try {
    const hp = w.entities.get(1)!.health.current;
    step(w, epilogueTicks - pulloutTicks - 1);
    expect(m.state.epilogue!.phase).toBe('playable'); expect(epiloguePull(m.state.counters['epilogue-ticks'])).toBe(0);
    expect(m.state.epilogue!.survivors).toHaveLength(6);
    expect(m.state.epilogue!.approaching.length).toBeGreaterThan(0); expect(m.state.epilogue!.approaching.length).toBeLessThanOrEqual(6);
    for (const id of m.state.epilogue!.approaching) { expect(w.entities.get(id)!.corpse).toBe(true); expect(w.entities.get(id)!.health.current).toBe(0); }
    const x = w.entities.get(1)!.transform.x;
    w.setInput({ move: { x: 1, z: 0 }, walk: true }); step(w, 60); w.clearInput();
    expect(w.entities.get(1)!.transform.x).toBeGreaterThan(x); expect(epiloguePull(m.state.counters['epilogue-ticks'])).toBeGreaterThan(0);
    const walking = w.entities.get(1)!.transform.x - x;
    const runningAt = w.entities.get(1)!.transform.x;
    w.setInput({ move: { x: 1, z: 0 } }); step(w, 60); w.clearInput();
    expect(w.entities.get(1)!.transform.x - runningAt).toBeGreaterThan(walking);
    step(w, pulloutTicks - 120);
    expect(m.state.epilogue!.phase).toBe('playable'); expect(m.state.counters['epilogue-ticks']).toBe(8999);
    w.update(); expect(m.state.epilogue!.phase).toBe('title'); expect(m.state.counters['epilogue-ticks']).toBe(9000); expect(epiloguePull(9000)).toBe(1);
    expect(w.entities.get(1)!.health.current).toBe(hp); expect(w.events.events().some(e => e.type === 'combat.attack')).toBe(false);
    step(w, titleTicks - 1); expect(m.state.epilogue!.phase).toBe('title'); w.update(); expect(m.state.epilogue!.phase).toBe('credits');
    step(w, creditsTicks); expect(m.state.phase).toBe('progression'); expect(m.state.epilogue!.phase).toBe('done');
    expect(m.state.result!.time).toBeCloseTo(150, 1);
    expect(w.progression!.campaign!.completedLevels).toBe(10); expect(nextLevelAfter(10)).toBeNull();
    step(w, 120); expect(counts.completions).toBe(1); expect(counts.releases).toBe(1); expect(counts.attacks).toBe(0);
  } finally { w.dispose(); }
});

test('T-E32-26-resume-S9 @E32-AC26 fresh-clock save/load at mid-pull, title, credits and completed ending never replays combat or victory', async () => {
  const { w, m } = await ready('low');
  try {
    step(w, 1800); expect(m.state.epilogue!.survivors).toHaveLength(3);
    expect(m.state.epilogue!.approaching.length).toBeLessThanOrEqual(3);
    for (const phase of ['playable', 'title', 'credits', 'done'] as const) {
      if (phase === 'playable') { elapsed(m, 8000); w.update(); }
      if (phase === 'title') { elapsed(m, 8999); w.update(); }
      if (phase === 'credits') step(w, titleTicks);
      if (phase === 'done') { m.l10!.epilogue.skip(); w.update(); }
      const save = structuredClone(w.progression!.campaign!); save.cureResume = m.saveResume();
      const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
      if (decoded.status !== 'ok') throw new Error('Invalid epilogue save');
      const fresh = new SimWorld(); await fresh.init(); fresh.loadScenario('mega-course'); applyCampaign(fresh, decoded.save);
      fresh.infected!.director.setTier('low');
      const loaded = fresh.loadMission(m.def); loaded.begin(); loaded.loadResume(decoded.save.cureResume!);
      try {
        expect(loaded.state.epilogue).toEqual(m.state.epilogue); expect(loaded.state.counters['epilogue-ticks']).toBe(m.state.counters['epilogue-ticks']);
        const ids = [...loaded.state.epilogue!.survivors, ...loaded.state.epilogue!.approaching];
        fresh.update(); expect([...loaded.state.epilogue!.survivors, ...loaded.state.epilogue!.approaching]).toEqual(ids);
        expect(fresh.events.events().some(e => e.type === 'combat.attack' || e.type === 'level.completed' || e.type === 'mission.signal' && e.name === 'cure-released')).toBe(false);
        if (phase === 'playable') {
          const at = fresh.entities.get(1)!.transform.x; fresh.setInput({ move: { x: 1, z: 0 } }); step(fresh, 30);
          expect(fresh.entities.get(1)!.transform.x).toBeGreaterThan(at);
        }
      } finally { fresh.dispose(); }
    }
  } finally { w.dispose(); }
});

test('T-E32-25-cast-S9 @nightly @E32-AC25 @E32-AC31 production safe anchors emerge and bounded approaches collapse on both E18 tiers', async () => {
  const { loadLevel } = await import('../../../tools/sim-runner/levels');
  for (const tier of ['high', 'low'] as const) {
    const w = await loadLevel('L10', 32);
    try {
      w.npcs!.setQuality(tier); w.chunks!.setQuality(tier);
      const m = w.missions!; m.loadCheckpoint('cure-disperse-ready');
      const at = { x: 4002, z: -27 };
      Object.assign(w.entities.get(1)!.transform, at); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.chunks!.update([at.x, at.z]);
      const id = w.megaPursuit!.introduce(at); w.combat!.damage.cure(w.entities.get(id)!); w.megaPursuit!.state.mode = 'dead';
      Object.assign(m.state.states, { 'charge-active': true, 'charge-ready': true, 'mega-dead': true });
      m.state.counters['charge-ticks'] = 3600; m.state.steps.hold.status = 'completed'; m.state.steps.release.status = 'active';
      w.setInput({ interact: true }); w.update(); w.clearInput();
      const hp = w.entities.get(1)!.health.current; let peak = 0;
      for (let i = 0; i < 45 * 60; i++) { w.update(); peak = Math.max(peak, w.infected!.director.count); }
      expect(m.state.epilogue!.survivors).toHaveLength(tier === 'low' ? 3 : 6);
      expect(m.state.epilogue!.approaching.length).toBeGreaterThan(0); expect(m.state.epilogue!.approaching.length).toBeLessThanOrEqual(tier === 'low' ? 3 : 6);
      for (const id of m.state.epilogue!.approaching) { const e = w.entities.get(id)!; expect(e.corpse).toBe(true); expect(e.infected!.recoverAt).toBe(-1); }
      expect(w.entities.get(1)!.health.current).toBe(hp); expect(peak).toBeLessThanOrEqual(tier === 'low' ? 100 : 200);
      expect(w.chunks!.stats().resident).toBeLessThanOrEqual(tier === 'low' ? 9 : 25);
    } finally { w.dispose(); }
  }
});
