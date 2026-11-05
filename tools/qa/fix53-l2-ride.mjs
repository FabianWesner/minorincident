import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL2, runL2 } from '../sim-runner/l2Bots.ts';
import { provenance } from './accept/probe.ts';

const results = [];
for (const tier of ['low', 'high']) {
  const { world, mission } = await loadL2(1, tier);
  try {
    const roster = [1, ...mission.state.l2.crewIds], changes = [];
    let signature = '', rideSamples = 0, seatedSamples = 0, allOutTick = null, controlTick = null;
    world.events.on('sim.tick', () => {
      const state = mission.state.l2;
      const people = roster.map(id => { const e = world.entities.get(id); return { id, present: !!e, hidden: !!e?.hidden, hp: e?.health.current }; });
      if (state.phase === 'ride') { rideSamples++; if (people.every(e => e.present && e.hidden)) seatedSamples++; }
      if (!state.departAt) return;
      const key = JSON.stringify([people, !!world.storyLock]);
      if (key !== signature) { changes.push({ tick: world.tick, phase: state.phase, storyLock: world.storyLock, people }); signature = key; }
      if (state.arrivedAt && people.every(e => e.present && !e.hidden && e.hp > 0)) allOutTick ??= world.tick;
      if (state.arrivedAt && !world.entities.get(1).hidden && !world.storyLock) controlTick ??= world.tick;
    });
    runL2(world, mission, 'no-axe', { maxSeconds: 120, stopWhen: m => !!m.state.l2.arrivedAt && world.tick - m.state.l2.arrivedAt >= 241 });
    const state = mission.state.l2;
    const seconds = (state.arrivedAt - state.departAt) / 60;
    const allOutS = allOutTick === null ? null : (allOutTick - state.arrivedAt) / 60;
    const controlS = controlTick === null ? null : (controlTick - state.arrivedAt) / 60;
    results.push({ tier, roster, rideSamples, seatedSamples, seconds, allOutS, controlS, changes,
      pass: roster.length === 7 && rideSamples > 0 && seatedSamples === rideSamples && seconds >= 15 && seconds <= 25 && allOutS !== null && allOutS <= 4 && controlS !== null && controlS <= .5 });
  } finally { world.dispose(); }
}
mkdirSync('docs/reports/fix53-a', { recursive: true });
writeFileSync('docs/reports/fix53-a/L2-03-occupants.json', JSON.stringify({ ...provenance(), method: 'Unmodified native no-axe InputFrame route; per-tick roster/hidden/control observation through arrival+4s; no survival protection', results }, null, 2));
console.log(results.map(row => ({ tier: row.tier, seconds: row.seconds, allOutS: row.allOutS, controlS: row.controlS, pass: row.pass })));
process.exitCode = results.every(row => row.pass) ? 0 : 1;
