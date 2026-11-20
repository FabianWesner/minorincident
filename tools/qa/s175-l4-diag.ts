/** Temporary s175 diagnostic: per-second L4 hold admission/attrition telemetry. Read-only. */
import { runLevel } from '../sim-runner/levels';
import { l4 } from '../../src/data/l4';

const tier = (process.argv[2] ?? 'low') as 'low' | 'high';
const seconds = Number(process.argv[3] ?? 250);
const rows: unknown[] = [];
const census: { firstBreach: number | null; aliveAtBreach: number | null; minPlaza: number | null; minAt: number | null; peakAlive: number; peakPlaza: number } = { firstBreach: null, aliveAtBreach: null, minPlaza: null, minAt: null, peakAlive: 0, peakPlaza: 0 };
const run = await runLevel('L4', 'complete', 1, seconds, 'auto', undefined, undefined, 0, {
  quality: tier, passive: true,
  beforeBegin: w => {
    let prev = { emerged: 0, kills: 0, downed: 0, tick: 0 };
    w.events.on('sim.tick', () => {
      const s = w.missions!.state.l4!;
      if (s.phase !== 'war' && s.phase !== 'collapse') return;
      const tick = w.tick;
      const living = w.infected!.active.filter(e => e.health.current > 0);
      const alive = living.filter(e => !e.hidden && !e.pendingAdmission);
      const pending = living.filter(e => !!e.pendingAdmission).length;
      const hiddenOnly = living.filter(e => e.hidden && !e.pendingAdmission).length;
      const corpses = [...w.entities.iterate()].filter(e => e.corpse && e.infected).length;
      const p = l4.map.plaza;
      const inPlaza = (e: { transform: { x: number; z: number } }) => e.transform.x > p.x0 && e.transform.x < p.x1 && e.transform.z > p.z0 && e.transform.z < p.z1;
      const plaza = alive.filter(inPlaza).length;
      const downed = w.infected!.active.filter(e => e.health.current <= 0 && (e.infected?.recoverAt ?? -1) >= 0).length;
      const deaths = s.kills.player + s.kills.soldiers + s.kills.armedCivilians + s.kills.unarmedCivilians + s.kills.heli + s.kills.tank + s.kills.other;
      const breaches = Object.entries(s.breaches ?? {}).map(([k, b]) => `${k}:${b?.openAt ?? 0}/${b?.arrivals ?? 0}`).join(',');
      if (census.firstBreach === null && Object.values(s.breaches ?? {}).some(b => b?.openAt)) { census.firstBreach = Math.min(...Object.values(s.breaches ?? {}).flatMap(b => b?.openAt ? [b.openAt] : [])); census.aliveAtBreach = alive.length; }
      census.peakAlive = Math.max(census.peakAlive, alive.length); census.peakPlaza = Math.max(census.peakPlaza, plaza);
      if (tick >= s.warAt + 45 * 60) {
        if (census.minPlaza === null || plaza < census.minPlaza) { census.minPlaza = plaza; census.minAt = tick; }
        census.minAt = census.minPlaza !== null && plaza <= (census.minPlaza ?? 0) ? tick : census.minAt;
      }
      if (tick % 60 === 0) rows.push({
        tick, t: +((tick - s.warAt) / 60).toFixed(2), phase: s.phase, alive: alive.length, plaza, downed, pending, hiddenOnly, corpses, living: living.length,
        count: w.infected!.director.count, reserved: w.infected!.director.reserved, pendingTurns: w.infected!.director.pendingTurns,
        cap: w.infected!.director.cap, alarmPending: s.alarmPending, alarmCursor: s.alarmCursor,
        wave: s.wave, pend: [...s.pend], perimeterPending: s.perimeterPending, perimeterAt: s.perimeterAt,
        breaches, emerged: s.emergedIds.length, dEmerged: s.emergedIds.length - prev.emerged,
        deaths, dDeaths: deaths - prev.kills, dDowned: downed - prev.downed,
        states: alive.reduce((m: Record<string, number>, e) => { const k = `${e.infected?.state ?? '?'}:${e.infected?.breachApproach ?? '-'}:${e.infected?.l1?.mode ?? '-'}`; m[k] = (m[k] ?? 0) + 1; return m; }, {}),
        ring: alive.filter(e => e.transform.x > l4.perimeter.x0 && e.transform.x < l4.perimeter.x1 && e.transform.z > l4.perimeter.z0 && e.transform.z < l4.perimeter.z1).length,
        outside: alive.filter(e => !(e.transform.x > p.x0 && e.transform.x < p.x1 && e.transform.z > p.z0 && e.transform.z < p.z1)).slice(0, 12).map(e => ({ id: e.id, x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1), st: e.infected?.state, ap: e.infected?.breachApproach, m: e.infected?.l1?.mode, pg: e.infected?.l1?.goalX !== undefined ? 1 : 0, gx: +(e.infected?.l1?.goalX ?? 0).toFixed(1), gz: +(e.infected?.l1?.goalZ ?? 0).toFixed(1), sp: +(e.infected!.speed).toFixed(2) })),
        humans: [...w.entities.iterate()].filter(e => (e.civilian || e.infected) && e.health.current > 0).length,
        soldiers: s.soldierIds.filter(id => (w.entities.get(id)?.health.current ?? 0) > 0).length,
      });
      prev = { emerged: s.emergedIds.length, kills: deaths, downed, tick };
    });
  },
  beforeDispose: () => {},
});
console.log(JSON.stringify({ tier, run: { outcome: run.outcome, time: run.time, kills: run.kills }, census }, null, 0));
for (const row of rows) console.log(JSON.stringify(row));
