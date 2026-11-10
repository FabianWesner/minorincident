// L5 first-survivor rescue pressure: node --import tsx/esm tools/qa/l5-rescue-measure.ts <profile c|n> <seed> [escortSeconds=90] [maxSeconds=420]
// Window: from the first survivor found until escortSeconds later (or that survivor sheltered). Counts are live, visible infected.
import { loadL5, runL5 } from '../sim-runner/l5Bots';
import { l5Survivors } from '../../src/data/l5';
import type { L5Profile } from '../../src/debug/bot/LevelFiveBot';

const profile = ({ c: 'complete', n: 'newbie' }[process.argv[2] ?? 'c'] ?? process.argv[2]) as L5Profile;
const seed = Number(process.argv[3] ?? 1), escort = Number(process.argv[4] ?? 90), max = Number(process.argv[5] ?? 420);
const { world, mission } = await loadL5(seed);
const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
let t0 = -1, tFound = -1, key = '', ring = { x: 0, z: 0 };
const eng = new Map<number, number>(); // id -> first engage tick
let n20s = 0, n40s = 0, n20c = 0, n40c = 0, samples = 0, maxN20s = 0, maxN20c = 0, hp0 = 0, hpMin = 1e9, atFound = { s20: 0, s40: 0, c20: 0, c40: 0 };
let deathsBefore = 0;
const r = runL5(world, mission, profile, { seed, maxSeconds: max, stopWhen: m => {
  const s = m.state.l5!;
  if (tFound < 0) {
    const f = s.survivors.find(x => x.status === 'following' || x.status === 'sheltered');
    if (f) { tFound = world.tick; key = f.key; const L = l5Survivors.find(x => x.key === key)!; ring = { x: L.ringAt[0], z: L.ringAt[1] }; deathsBefore = m.state.stats.deaths; hp0 = world.entities.get(1)!.health.current; }
  }
  return tFound >= 0 && ((world.tick - tFound) / 60 > escort || s.survivors.find(x => x.key === key)!.status === 'sheltered');
}, each: () => {
  if (t0 < 0) t0 = world.tick;
  const p = world.entities.get(1)!.transform;
  const alive = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infectionRise);
  for (const e of alive) {
    const b = e.infected!.l1, st = e.infected!;
    const on = e.archetype === 'infected.alpha' ? ['alerted', 'chase', 'attack'].includes(st.state) && st.heardTargetId === 1 : !!b && (b.mode === 'chase' || b.mode === 'bite') && b.targetId === 1;
    if (on && d(e.transform, p) < 40 && !eng.has(e.id)) eng.set(e.id, world.tick);
  }
  if (tFound < 0) return;
  const s20 = alive.filter(e => d(e.transform, ring) < 20).length, s40 = alive.filter(e => d(e.transform, ring) < 40).length;
  const c20 = alive.filter(e => d(e.transform, p) < 20).length, c40 = alive.filter(e => d(e.transform, p) < 40).length;
  if (samples === 0) atFound = { s20, s40, c20, c40 };
  n20s += s20; n40s += s40; n20c += c20; n40c += c40; samples++; maxN20s = Math.max(maxN20s, s20); maxN20c = Math.max(maxN20c, c20);
  hpMin = Math.min(hpMin, world.entities.get(1)!.health.current);
} });
const secs = (world.tick - t0) / 60, escSecs = tFound >= 0 ? (world.tick - tFound) / 60 : 0;
const engaged = [...eng.values()];
const out = {
  profile, seed, simSeconds: +secs.toFixed(0), firstKey: key, tFoundS: tFound < 0 ? null : +((tFound - t0) / 60).toFixed(0), found: r.found.map(f => `${f.key}@${f.t.toFixed(0)}`),
  atFound, avg: samples ? { s20: +(n20s / samples).toFixed(1), s40: +(n40s / samples).toFixed(1), c20: +(n20c / samples).toFixed(1), c40: +(n40c / samples).toFixed(1) } : null, maxN20s, maxN20c,
  engagedTotal: engaged.length, engagedPerMin: +(engaged.length / (secs / 60)).toFixed(1), engagedAfterFoundPerMin: escSecs ? +(engaged.filter(t => t >= tFound).length / (escSecs / 60)).toFixed(1) : null,
  hpLossWindow: tFound < 0 ? null : +(hp0 - hpMin).toFixed(0), deaths: r.deaths, deathsAt: r.deathsAt, deathsAfterFound: r.deaths - deathsBefore, firstFate: r.fates[key] ?? null, lost: r.lost,
};
console.log('RESULT ' + JSON.stringify(out));
