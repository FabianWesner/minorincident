/** Exact-checkout campaign evidence. Run with node --import tsx from that checkout. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [destination, selection = 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10'] = process.argv.slice(2);
if (!destination) throw new Error('output directory required');
const root = process.cwd(), out = resolve(destination);
mkdirSync(out, { recursive: true });
const own = p => import(pathToFileURL(resolve(root, p)).href);
const { SimWorld } = await own('src/sim/world/SimWorld.ts');
const { InfectedSystem } = await own('src/sim/ai/InfectedSystem.ts');
const { runLevel } = await own('tools/sim-runner/levels.ts');
const { markerAnchor } = await own('src/sim/missions/markerAnchor.ts');
const data = new WeakMap();
function record(w) {
  let d = data.get(w);
  if (d) return d;
  d = { spawnCalls: 0, alphaSpawnCalls: 0, seen: new Set(), seenAlpha: new Set(), firstCourierAttack: null, courierAttacks: 0, courierDamage: 0, hits: {}, kills: {}, samples: [], objectives: [], markerProblems: [], markerPositions: new Map() };
  data.set(w, d);
  w.events.on('infected.attack', e => { if (e.targetId === 1) { d.firstCourierAttack ??= e.tick / 60; d.courierAttacks++; d.courierDamage += e.amount; } });
  for (const [event, key] of [['combat.hit', 'hits'], ['combat.kill', 'kills']]) w.events.on(event, e => { if (e.sourceId === 1) d[key][e.actionId] = (d[key][e.actionId] ?? 0) + 1; });
  w.events.on('objective.completed', e => d.objectives.push({ id: e.id, tick: e.tick, player: { ...w.entities.get(1)?.transform }, marker: w.missions?.state.marker, anchor: markerAnchor(w.missions), state: structuredClone(w.missions?.state) }));
  return d;
}
const spawn = InfectedSystem.prototype.spawn;
InfectedSystem.prototype.spawn = function (...args) {
  const id = spawn.apply(this, args), d = record(this.world);
  d.spawnCalls++; if (args[0] === 'infected.alpha') d.alphaSpawnCalls++;
  return id;
};
const load = SimWorld.prototype.loadComposition;
SimWorld.prototype.loadComposition = function (...args) {
  const result = load.apply(this, args);
  this.infected?.director.setTier('low'); this.npcs?.setQuality('low');
  return result;
};
const update = SimWorld.prototype.update;
SimWorld.prototype.update = function (...args) {
  const d = record(this); update.apply(this, args);
  if (this.tick % 60) return;
  const enemies = [...this.entities.iterate()].filter(e => e.infected);
  for (const e of enemies) { d.seen.add(e.id); if (e.archetype === 'infected.alpha') d.seenAlpha.add(e.id); }
  const living = enemies.filter(e => e.health.current > 0 && !e.hidden && !e.infected.hidden);
  if (this.tick % 600 === 0 || [34, 60].includes(this.tick / 60)) d.samples.push({ seconds: this.tick / 60, spawned: d.spawnCalls, sampledIdentities: d.seen.size, alphaSpawned: d.alphaSpawnCalls, alive: living.length, alphaAlive: living.filter(e => e.archetype === 'infected.alpha').length, courierAttacks: d.courierAttacks, courierDamage: d.courierDamage });
  const m = this.missions, marker = m?.state.marker, at = markerAnchor(m);
  if (marker && !at) d.markerProblems.push({ tick: this.tick, marker, kind: 'missing anchor' });
  if (marker && at) {
    const position = [at.x, at.y ?? 0, at.z], before = d.markerPositions.get(marker);
    if (before && before.some((v, i) => Math.abs(v - position[i]) > .001)) d.markerProblems.push({ tick: this.tick, marker, kind: 'anchor moved', before, after: position });
    d.markerPositions.set(marker, position);
  }
};
const rows = [];
for (const level of selection.split(',')) {
  let observed;
  const finish = world => { observed = data.get(world); };
  // Also retain an incomplete run; runLevel disposes its world before returning.
  const dispose = SimWorld.prototype.dispose;
  SimWorld.prototype.dispose = function () { if (this.scenario === level) observed = data.get(this); return dispose.call(this); };
  const started = Date.now();
  const report = await runLevel(level, 'complete', 1, level === 'L10' ? 3600 : 1200, 'auto', undefined, finish);
  SimWorld.prototype.dispose = dispose;
  const row = { level, quality: 'low', seed: 1, wallMs: Date.now() - started, report, observed: observed ? { ...observed, seen: [...observed.seen], seenAlpha: [...observed.seenAlpha], markerPositions: Object.fromEntries(observed.markerPositions) } : null };
  rows.push(row); writeFileSync(resolve(out, `${level}.json`), JSON.stringify(row, null, 2));
  writeFileSync(resolve(out, 'summary.json'), JSON.stringify(rows.map(r => ({ level: r.level, wallMs: r.wallMs, ...r.report, observed: { ...r.observed, objectives: r.observed?.objectives.map(o => ({ id: o.id, tick: o.tick })), seen: r.observed?.seen.length } })), null, 2));
  console.log(JSON.stringify({ level, outcome: report.outcome, time: report.time, wallMs: row.wallMs, spawned: observed?.spawnCalls, firstCourierAttack: observed?.firstCourierAttack, markerProblems: observed?.markerProblems.length }));
}
