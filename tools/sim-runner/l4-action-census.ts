import { writeFileSync, mkdirSync } from 'node:fs';
import { l4, l4Emergence } from '../../src/data/l4';
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
const spawns: { t: number; id: number; arch: string; x: number; z: number; dPlayer: number; inView: boolean; emerging: boolean; transformation: boolean; origin: number | null; inside: boolean }[] = [];
const seconds: { t: number; phase: string; alive: number; inside: number; near: number; wire: number; step: string | null; courier: { x: number; z: number } }[] = [];
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
  if (!s.turnAt) for (const e of w.entities.iterate()) if (e.civilian) originalPeople.add(e.id);
  for (const e of w.infected!.active) if (!seen.has(e.id) && !e.hidden && e.health.current > 0) {
    seen.add(e.id);
    const p = w.entities.get(1)!.transform;
    if (s.turnAt) spawns.push({ t: +((w.tick - s.turnAt) / 60).toFixed(1), id: e.id, arch: e.archetype, x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1), dPlayer: +Math.hypot(e.transform.x - p.x, e.transform.z - p.z).toFixed(1), inView: inView(e.transform) && !w.infected!.director.occluded(e.transform), emerging: !!e.emerging, transformation: originalPeople.has(e.id), origin: s.origin[e.id] ?? null, inside: inside(e.transform) });
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
    seconds.push({ t: (w.tick - s.turnAt) / 60, phase: s.phase, alive: live.length, inside: live.filter(e => inside(e.transform)).length, near: live.filter(e => Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 12).length, wire: live.filter(e => !inside(e.transform) && e.transform.x > per.x0 - 4 && e.transform.x < per.x1 + 4 && e.transform.z > per.z0 - 4 && e.transform.z < per.z1 + 4).length, step: mm.def.steps.find(d => mm.state.steps[d.id].status === 'active')?.id ?? null, courier: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } });
  }
  return false;
}, zoom: 1.5 });
mkdirSync('test-results/l4-storyline', { recursive: true });
const out = { seed, tier, profile, outcome: r.outcome, timeline: r.timeline, kills: r.kills_, breakAfterS: r.breakAfterS, seconds, spawns, alphaAudit: [...alphaAudit.values()], pressureSamples };
writeFileSync(`test-results/l4-storyline/census-${tier}-${seed}-${profile}.json`, JSON.stringify(out, null, 1));
// Per minute of the war (from the turn): infected inside the perimeter (mean), spawns in view, Alphas.
for (let min = 0; min < 6; min++) {
  const s = seconds.filter(x => x.t >= min * 60 && x.t < (min + 1) * 60); if (!s.length) break;
  const sp = spawns.filter(x => x.t >= min * 60 && x.t < (min + 1) * 60);
  console.log(`min ${min}: phase ${s.at(-1)!.phase} step ${s.at(-1)!.step} alive ${Math.round(s.reduce((a, b) => a + b.alive, 0) / s.length)} insideMean ${(s.reduce((a, b) => a + b.inside, 0) / s.length).toFixed(1)} insideMax ${Math.max(...s.map(x => x.inside))} nearMean ${(s.reduce((a, b) => a + b.near, 0) / s.length).toFixed(1)} wireMean ${(s.reduce((a, b) => a + b.wire, 0) / s.length).toFixed(1)} spawns ${sp.length} inView ${sp.filter(x => x.inView).length} insideSpawns ${sp.filter(x => x.inside).length}`);
}
for (const a of spawns.filter(x => x.arch === 'infected.alpha')) console.log('alpha', JSON.stringify(a));
const visible = spawns.filter(x => x.inView), transformations = visible.filter(x => x.transformation), popIns = visible.filter(x => !x.transformation && !x.emerging && (x.origin === null || x.origin < l4Emergence.length));
console.log('visible admissions', JSON.stringify({ all: visible.length, transformations: transformations.length, animatedDoor: visible.length - transformations.length - popIns.length, popIns: popIns.length }));
console.log('breaches', JSON.stringify(Object.fromEntries(Object.entries(m.state.l4!.breaches ?? {}).map(([k, v]) => [k, { announced: +((v!.announcedAt - m.state.l4!.turnAt) / 60).toFixed(1), open: v!.openAt ? +((v!.openAt - m.state.l4!.turnAt) / 60).toFixed(1) : null }]))));
console.log('timeline', JSON.stringify(r.timeline.map(x => `${x.type}@${x.t.toFixed(0)}`)));
w.dispose();
