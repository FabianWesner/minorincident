/** Read-only announced-cohort lifetime audit; compare against an unobserved control. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels.ts';
import { preset } from '../../../src/sim/progression/Campaign.ts';
import { stateHash } from '../../../src/sim/world/stateHash.ts';
import { provenance } from './probe.ts';

const identity = provenance(), admissions = new Map(), removals = [], lifecycle = [];
let observedHash, controlHash;
const campaign = () => { const c = preset('L3-default'); c.settings.quality = 'low'; return c; };
await runLevel('L3', 'complete', 1, 90, 'auto', campaign(), undefined, 0, {
  quality: 'low', beforeBegin: w => {
    const rush = w.infected.rush.bind(w.infected);
    w.infected.rush = (id, ...args) => {
      const q = w.missions.state.l3.waves.find(q => q.id === id);
      if (q && !admissions.has(id)) admissions.set(id, w.tick);
      return rush(id, ...args);
    };
    const remove = w.entities.delete.bind(w.entities);
    w.entities.delete = id => {
      const s = w.missions.state.l3, q = s.waves.find(q => q.id === id), e = w.entities.get(id);
      if (q) removals.push({ tick: w.tick, id, wave: q.wave, scheduled: q.at,
        admittedAt: admissions.get(id), ageTicks: w.tick - (admissions.get(id) ?? w.tick),
        furthest: s.furthest, position: e ? { ...e.transform } : null, hp: e?.health.current,
        mode: e?.infected?.l1?.mode, stack: new Error('cohort removal').stack });
      return remove(id);
    };
    w.events.on('sim.tick', () => {
      for (const [id, at] of admissions) if ([0, 1, 30].includes(w.tick - at)) {
        const e = w.entities.get(id);
        lifecycle.push({ tick: w.tick, id, ageTicks: w.tick - at, present: !!e, hp: e?.health.current,
          hasMotion: !!e?.motion, updatedAt: e?.locomotion?.updatedAt, hidden: !!e?.hidden,
          pending: !!e?.pendingAdmission, position: e ? { ...e.transform } : null });
      }
    }, 9);
  }, beforeDispose: w => { observedHash = stateHash(w.getState()); },
});
await runLevel('L3', 'complete', 1, 90, 'auto', campaign(), undefined, 0, {
  quality: 'low', beforeDispose: w => { controlHash = stateHash(w.getState()); },
});
const result = { ...identity, method: 'Read-only wrappers call production rush/delete exactly once. Ordinary low-tier complete prefix,90seconds, no actor relocation/event injection. Exact unobserved control comparison.',
  observedHash, controlHash, identical: observedHash === controlHash, admissions: [...admissions], removals, lifecycle };
writeFileSync(process.env.FIX68_G_RETIREMENT_OUT ?? 'docs/reports/fix68-g/L3-02-retirement-trace.json.gz', gzipSync(JSON.stringify(result)));
console.log(JSON.stringify({ identical: result.identical, missingActors: removals.filter(e => [226, 240].includes(e.id)), removals: removals.length }));
process.exitCode = result.identical ? 0 : 1;
