/** Read-only traces for the remaining L6/L7 gate counterexamples. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels.ts';
import { preset } from '../../../src/sim/progression/Campaign.ts';
import { stateHash } from '../../../src/sim/world/stateHash.ts';
import { ThreatObserver } from '../threat/observer.ts';
import { provenance } from './probe.ts';

const level = process.argv[2], tier = process.argv[3] ?? 'low';
if (!['L6', 'L7'].includes(level) || !['low', 'high'].includes(tier)) throw new Error('Expected L6|L7 low|high');
const passive = process.env.FIX68_G_SKILLED !== '1', calls = [], samples = [], errors = [];
const campaign = () => { const c = preset(`${level}-default`); c.settings.quality = tier; return c; };
const identity = provenance();
let observation, observedHash, controlHash;
const seconds = level === 'L6' && passive ? 110 : undefined;
const run = await runLevel(level, 'complete', 1, seconds, 'auto', campaign(), undefined, 0, {
  quality: tier, passive, beforeBegin: w => {
    const observer = new ThreatObserver(w, level);
    w.events.on('sim.tick', () => { observation = observer.finish(); }, 9);
    if (level === 'L6') {
      const mission = w.missions.l6, spawn = mission.spawn.bind(mission);
      mission.spawn = (...args) => {
        const s = w.missions.state.l6, ai = w.infected, start = s.spawnLog.length;
        const before = { count: ai.director.count, cap: ai.director.cap, reserved: ai.director.reserved,
          turns: ai.director.pendingTurns, pool: ai.pool.length, arrivals: structuredClone(s.arrivals), refusals: { ...s.spawnRefusals } };
        const result = spawn(...args);
        calls.push({ tick: w.tick, args, result, before, refusals: { ...s.spawnRefusals }, admitted: s.spawnLog.slice(start).map(q => ({ ...q,
          infected: !!w.entities.get(q.id)?.infected, hp: w.entities.get(q.id)?.health.current })) });
        return result;
      };
      const spawnActor = w.infected.spawn.bind(w.infected);
      w.infected.spawn = (...args) => {
        try { return spawnActor(...args); }
        catch (error) { errors.push({ tick: w.tick, args, message: String(error) }); throw error; }
      };
    } else {
      let previous = { ...w.entities.get(1).transform };
      w.events.on('sim.tick', () => {
        const player = w.entities.get(1), controller = w.l7Encounters;
        const leaderSpeed = Math.hypot(player.transform.x - previous.x, player.transform.z - previous.z) * 60;
        previous = { ...player.transform };
        if (w.tick % 30) return;
        samples.push({ tick: w.tick, player: { ...player.transform }, leaderSpeed, requestedMove: { ...w.inputFrame.move },
          followers: controller.state.roster.map(r => {
            const e = w.entities.get(r.id);
            return { id: r.id, status: r.status, position: e ? { ...e.transform } : null, hp: e?.health.current,
              speed: e?.motion?.speed, response: structuredClone(e?.locomotion), state: e?.civilian?.state,
              knockedUntil: e?.civilian?.knockedUntil, staggerUntil: e?.combat?.staggerUntil,
              statuses: structuredClone(e?.combat?.statuses), attachedTo: e?.attachedTo,
              slot: e?.civilian?.survivor?.slot, path: e?.civilian?.path?.slice(0, 4), goal: e?.civilian?.goal,
              target: structuredClone(e?.civilian?.l1?.target), approach: structuredClone(controller.approaches.get(r.id)),
              pocket: structuredClone(controller.pocketRoutes.get(r.id)), blocker: w.solids.blockingBody(r.id)?.id };
          }) });
      }, 9);
    }
  }, beforeDispose: w => { observedHash = stateHash(w.getState()); },
});
const control = await runLevel(level, 'complete', 1, seconds, 'auto', campaign(), undefined, 0, {
  quality: tier, passive, beforeDispose: w => { controlHash = stateHash(w.getState()); },
});
const result = { ...identity, level, tier, passive, method: 'Read-only production wrappers; original methods called exactly once. Native policy, no relocation/event injection. Compared with an unobserved control.',
  identical: observedHash === controlHash, observedHash, controlHash, run, control, observation, calls, samples, errors };
const path = process.env.FIX68_G_GATE_OUT ?? `docs/reports/fix68-g/${level}-${tier}-gate-trace.json.gz`;
writeFileSync(path, gzipSync(JSON.stringify(result)));
console.log(JSON.stringify({ path, identical: result.identical, flags: observation?.phases.flatMap(p => p.flags.map(f => `${p.key}:${f}`)), waves: observation?.waves, errors }));
process.exitCode = result.identical ? 0 : 1;
