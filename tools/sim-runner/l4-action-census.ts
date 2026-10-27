import { writeFileSync, mkdirSync } from 'node:fs';
import { l4, l4Emergence, l4TentEntrances } from '../../src/data/l4';
import { PerspectiveCamera, Vector3 } from 'three';
import { loadL4, runL4 } from './l4Bots';

/**
 * L4 storyline census (PO 10-23 "L4 is still no action"): per second of the war, infected alive, inside the military perimeter,
 * within 12 m of the courier, plus every infected spawn position (in view of the courier's camera or not) and every Alpha's entry.
 *   npx tsx tools/sim-runner/l4-action-census.ts [seed] [high|low] [profile]
 */
const seed = Number(process.argv[2] ?? 3), tier = (process.argv[3] ?? 'low') as 'high' | 'low', profile = (process.argv[4] ?? 'complete') as 'complete' | 'idle';
const { world: w, mission: m } = await loadL4(seed, tier);
const per = l4.perimeter, inside = (p: { x: number; z: number }) => p.x > per.x0 && p.x < per.x1 && p.z > per.z0 && p.z < per.z1;
const seen = new Set<number>();
const alphaAudit = new Map<number, { id: number; entered: number | null; downed: number | null; finished: number | null }>();
const pressureSamples: unknown[] = [];
const originalPeople = new Set<number>();
const spawns: { t: number; id: number; arch: string; model: string; source: string; x: number; z: number; dPlayer: number; inView: boolean; emerging: boolean; transformation: boolean; origin: number | null; inside: boolean }[] = [];
const seconds: { t: number; phase: string; alive: number; inside: number; near: number; insideActive: number; nearActive: number; archetypes: Record<string, number>; models: Record<string, number>; corpses14: number; corpseBands: number[]; wire: number; step: string | null; courier: { x: number; z: number } }[] = [];
const inWallEntries: { t: number; id: number; archetype: string; source: string }[] = [];
const previousInside = new Map<number, boolean>(); let wallBaseline = false;
// Game camera view at zoom 1: radius 19, polar 0.3π → the frame covers roughly ±17 m by ±11 m around the courier on the ground.
// The game camera at the PO zoom 1.5 (radius 19 x 1.5, polar 0.3 pi, azimuth 45 deg), any part of a standing body on screen.
const cam = new PerspectiveCamera(25, 16 / 9, .1, 600), off = new Vector3(), pt = new Vector3();
const inView = (p: { x: number; z: number }) => {
  const q = w.entities.get(1)!.transform; off.setFromSphericalCoords(19 * 1.5, Math.PI * .3, Math.PI / 4);
  cam.position.set(q.x + off.x, off.y, q.z + off.z); cam.lookAt(q.x, 0, q.z); cam.updateMatrixWorld(true);
  for (const y of [0, .9, 1.8]) { pt.set(p.x, y, p.z).project(cam); if (Math.abs(pt.x) < 1 && Math.abs(pt.y) < 1 && pt.z < 1) return true; }
  return false;
};
const r = runL4(w, m, profile, { seed, god: true, maxSeconds: 520, stopWhen: mm => {
  const s = mm.state.l4!;
  if (s.turnAt && !wallBaseline) { wallBaseline = true; for (const e of w.infected!.active) previousInside.set(e.id, inside(e.transform)); }
  if (wallBaseline) for (const e of w.infected!.active) {
    const now = inside(e.transform), before = previousInside.get(e.id) ?? false;
    if (now && !before && e.health.current > 0) {
      const origin = s.origin[e.id], source = origin === undefined ? 'other' : origin < l4Emergence.length ? l4Emergence[origin]?.door ? 'street-door' : 'street-mouth' : 'wire/breach';
      inWallEntries.push({ t: +((w.tick - s.turnAt) / 60).toFixed(1), id: e.id, archetype: e.archetype ?? 'unknown', source });
    }
    previousInside.set(e.id, now);
  }
  if (!s.turnAt) for (const e of w.entities.iterate()) if (e.civilian) originalPeople.add(e.id);
  for (const e of w.infected!.active) if (!seen.has(e.id) && !e.hidden && e.health.current > 0) {
    seen.add(e.id);
    const p = w.entities.get(1)!.transform;
    const origin = s.origin[e.id], transformed = originalPeople.has(e.id), internal = inside(e.transform);
    const tent = internal && l4TentEntrances.some(t => Math.hypot(e.transform.x - t.at[0], e.transform.z - t.at[1]) < 3);
    const source = transformed ? 'bite-conversion' : internal ? tent ? 'tent' : 'illegal-internal' : origin === undefined ? e.archetype === 'infected.alpha' ? 'alpha-street' : 'exterior-flank' : origin >= l4Emergence.length ? 'wire/breach' : l4Emergence[origin].door ? 'street-door' : 'street-mouth';
    if (s.turnAt) spawns.push({ t: +((w.tick - s.turnAt) / 60).toFixed(1), id: e.id, arch: e.archetype, model: e.infected!.model ?? e.infected!.variant, source, x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1), dPlayer: +Math.hypot(e.transform.x - p.x, e.transform.z - p.z).toFixed(1), inView: inView(e.transform) && !w.infected!.director.occluded(e.transform), emerging: !!e.emerging, transformation: transformed, origin: origin ?? null, inside: internal });
  }
  if (s.turnAt) for (const e of w.infected!.active) if (e.archetype === 'infected.alpha') {
    let row = alphaAudit.get(e.id);
    if (!row) { row = { id: e.id, entered: null, downed: null, finished: null }; alphaAudit.set(e.id, row); }
    const t = (w.tick - s.turnAt) / 60;
    if (inside(e.transform) && row.entered === null) row.entered = t;
    if (e.health.current <= 0 && row.downed === null) row.downed = t;
    if (e.health.current <= 0 && e.infected!.recoverAt < 0 && row.finished === null) row.finished = t;
  }
  if (s.turnAt && (w.tick - s.turnAt) % (20 * 60) === 0 && s.phase === 'war') pressureSamples.push({ t: (w.tick - s.turnAt) / 60, infected: w.infected!.active.filter(e => e.health.current > 0 && inside(e.transform)).map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z, emerging: e.emerging, origin: s.origin[e.id], brain: e.infected!.l1 && { mode: e.infected!.l1.mode, focus: e.infected!.l1.focusId, target: e.infected!.l1.targetId, x: e.infected!.l1.goalX, z: e.infected!.l1.goalZ } })) });
  if (s.turnAt && (w.tick - s.turnAt) % 60 === 0) {
    const live = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden), p = w.entities.get(1)!.transform;
    const bodies = [...w.entities.iterate()].filter(e => e.faction === 'infected' && e.health.current <= 0 && !e.hidden);
    const corpseBands = [6, 8, 10, 14].map(r => bodies.filter(e => Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= r).length);
    const archetypes: Record<string, number> = {};
    const models: Record<string, number> = {};
    for (const e of live) archetypes[e.archetype ?? 'unknown'] = (archetypes[e.archetype ?? 'unknown'] ?? 0) + 1;
    for (const e of live) { const model = e.infected!.model ?? e.infected!.variant; models[model] = (models[model] ?? 0) + 1; }
    seconds.push({ t: (w.tick - s.turnAt) / 60, phase: s.phase, alive: live.length, inside: live.filter(e => inside(e.transform)).length, insideActive: live.filter(e => !e.emerging && inside(e.transform)).length, nearActive: live.filter(e => !e.emerging && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 12).length, near: live.filter(e => Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 12).length, archetypes, models, corpses14: corpseBands[3], corpseBands, wire: live.filter(e => !inside(e.transform) && e.transform.x > per.x0 - 4 && e.transform.x < per.x1 + 4 && e.transform.z > per.z0 - 4 && e.transform.z < per.z1 + 4).length, step: mm.def.steps.find(d => mm.state.steps[d.id].status === 'active')?.id ?? null, courier: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } });
  }
  return process.env.L4_CENSUS_HOLD_ONLY === '1' && !!s.turnAt && s.phase !== 'war' && w.tick > s.turnAt + 60;
}, zoom: Number(process.env.L4_CENSUS_ZOOM ?? 1.5) });
const outDir = process.env.L4_CENSUS_OUT ?? 'test-results/l4-storyline';
mkdirSync(outDir, { recursive: true });
const archetypeAt = (time: number) => seconds.find(row => row.t === time)?.archetypes ?? {};
const inWallByMinute = Object.fromEntries([0, 1, 2, 3].map(minute => [minute, inWallEntries.filter(e => e.t >= minute * 60 && e.t < (minute + 1) * 60).length]));
const sourceCounts = Object.fromEntries(['street-mouth', 'street-door', 'wire/breach', 'other'].map(source => [source, inWallEntries.filter(e => e.source === source).length]));
const spawnSourceCounts = Object.fromEntries(['tent', 'illegal-internal', 'street-mouth', 'street-door', 'wire/breach', 'alpha-street', 'exterior-flank', 'bite-conversion'].map(source => [source, spawns.filter(e => e.source === source).length]));
const out = { seed, tier, profile, outcome: r.outcome, timeline: r.timeline, kills: r.kills_, breakAfterS: r.breakAfterS, seconds, spawns, spawnSourceCounts, inWallEntries, inWallByMinute, sourceCounts, archetypesAt60: archetypeAt(60), archetypesAt150: archetypeAt(150), alphaAudit: [...alphaAudit.values()], pressureSamples };
writeFileSync(`${outDir}/census-${tier}-${seed}-${profile}.json`, JSON.stringify(out, null, 1));
// Per minute of the war (from the turn): infected inside the perimeter (mean), spawns in view, Alphas.
for (let min = 0; min < 6; min++) {
  const s = seconds.filter(x => x.t >= min * 60 && x.t < (min + 1) * 60); if (!s.length) break;
  const sp = spawns.filter(x => x.t >= min * 60 && x.t < (min + 1) * 60);
  console.log(`min ${min}: phase ${s.at(-1)!.phase} step ${s.at(-1)!.step} alive ${Math.round(s.reduce((a, b) => a + b.alive, 0) / s.length)} insideMean ${(s.reduce((a, b) => a + b.inside, 0) / s.length).toFixed(1)} insideMax ${Math.max(...s.map(x => x.inside))} nearMean ${(s.reduce((a, b) => a + b.near, 0) / s.length).toFixed(1)} wireMean ${(s.reduce((a, b) => a + b.wire, 0) / s.length).toFixed(1)} spawns ${sp.length} inView ${sp.filter(x => x.inView).length} insideSpawns ${sp.filter(x => x.inside).length}`);
}
for (const a of spawns.filter(x => x.arch === 'infected.alpha')) console.log('alpha', JSON.stringify(a));
const visible = spawns.filter(x => x.inView), transformations = visible.filter(x => x.transformation), popIns = visible.filter(x => !x.transformation && !x.emerging && (x.origin === null || x.origin < l4Emergence.length));
console.log('visible admissions', JSON.stringify({ all: visible.length, transformations: transformations.length, animatedDoor: visible.length - transformations.length - popIns.length, popIns: popIns.length }));
const hold = seconds.filter(s => s.phase === 'war' && s.step === 'hold');
console.log('hold contact', JSON.stringify({ contact: hold.filter(s => s.nearActive > 0).length, seconds: hold.length, percent: 100 * hold.filter(s => s.nearActive > 0).length / hold.length, corpses14: Object.fromEntries([20, 60, 150].map(t => [t, seconds.find(s => s.t === t)?.corpses14])) }));
console.log('in-wall entries/min', JSON.stringify(inWallByMinute), 'source types', JSON.stringify(sourceCounts));
console.log('spawns by source', JSON.stringify(spawnSourceCounts));
for (const [t, mix] of [[60, archetypeAt(60)], [150, archetypeAt(150)]] as const) { const total = Object.values(mix).reduce((a, b) => a + b, 0); console.log(`living archetypes @${t}s`, JSON.stringify({ total, mix: Object.fromEntries(Object.entries(mix).map(([id, n]) => [id, { count: n, percent: total ? +(100 * n / total).toFixed(1) : 0 }])) })); }
console.log('breaches', JSON.stringify(Object.fromEntries(Object.entries(m.state.l4!.breaches ?? {}).map(([k, v]) => [k, { announced: +((v!.announcedAt - m.state.l4!.turnAt) / 60).toFixed(1), open: v!.openAt ? +((v!.openAt - m.state.l4!.turnAt) / 60).toFixed(1) : null }]))));
console.log('timeline', JSON.stringify(r.timeline.map(x => `${x.type}@${x.t.toFixed(0)}`)));
w.dispose();
