/** Mortal campaign-default L9 completion and its three distant pre-bridge sightings. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const out = process.argv[2] ?? 'docs/reports/p1-l8rework/native-l9.json';
const identity = provenance(), signals: { tick: number; name: string }[] = [], lines: { tick: number; id: string }[] = [];
const hurt: unknown[] = [];
let sightings: number[] = [], final: unknown;
const run = await runLevel('L9', 'complete', 1, Number(process.env.L9_PROBE_SECONDS ?? 600), 'auto', undefined, undefined, 0, {
  beforeBegin: w => {
    w.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.targetId === 1) hurt.push({ tick: e.tick, action: e.actionId, source: e.sourceId, amount: e.amount }); });
    w.events.on('mission.signal', e => { if (e.type === 'mission.signal' && e.name.startsWith('l9.')) signals.push({ tick: e.tick, name: e.name }); });
    w.events.on('dialogue.line', e => { if (e.type === 'dialogue.line' && e.id.startsWith('L9.')) lines.push({ tick: e.tick, id: e.id }); });
  },
  beforeDispose: w => {
    const s = w.missions!.l9!.state; sightings = s.driving?.megaSightings ?? [];
    final = { phase: s.phase, finished: s.finished, sightings, evacuated: s.driving?.evacuated, driving: s.driving, cast: [...w.entities.iterate()].filter(e => e.id === 1 || e.companion || s.driving?.roster.includes(e.id)).map(e => ({ id: e.id, at: e.transform, hp: e.health.current, hidden: e.hidden, passengerOf: e.passengerOf, civilian: e.civilian, companion: e.companion })), passengers: w.entities.get(s.carId)?.vehicle?.passengers, playerWeapons: w.entities.get(1)?.weapons };
  },
});
const pass = run.completed && sightings.join(',') === '0,1,2';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ ...identity, pass, run, final, signals, lines, hurt }, null, 2) + '\n');
console.log(JSON.stringify({ out, pass, seconds: run.time, deaths: run.deaths, sightings }));
if (!pass) process.exitCode = 1;
