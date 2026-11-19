/** s170-followers: read-only diagnosis of the rear follower's calm-escort branch, band and pace. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { L5FormationObserver } from './l5-formation';
import { provenance } from './probe';
import { ThreatObserver } from '../threat/observer';
import { followerInCombat } from '../../../src/sim/outbreak/Survivors';
import { looseSlotOffset, swayOffset } from '../../../src/sim/outbreak/groupNature';
import { SimPhase } from '../../../src/core/EventBus';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';

const level = process.argv[2] === 'L6' ? 'L6' : 'L5';
const tier = process.argv[3] === 'high' ? 'high' : 'low';
const seed = Number(process.argv[4] ?? 1);
const out = process.argv[5] ?? `/private/var/folders/0d/d1pz5009603g0jcd5r3j353c0000gn/T/opencode/s170-trace-${level}-${tier}-${seed}.json.gz`;

const campaign = preset(`${level}-default`); campaign.seed = seed; campaign.settings.quality = tier;
const formation = new L5FormationObserver();
const rows: unknown[] = [];
let threat: ReturnType<ThreatObserver['finish']> | undefined;
let finalHash = '';
const identity = provenance();

interface Candidate { x: number; z: number; clear: boolean; visible: boolean }
interface Diag { paceSpeed: number; back: number; side: number; candidates: Candidate[] }

/** Replicate the calm-escort slot-candidate decision read-only (Survivors.ts math, no state writes). */
function calmCandidates(world: SimWorld, e: EntitySnapshot): Diag | { paceSpeed: number } {
  const player = world.entities.get(1)!, p = player.transform, v = player.survivor?.velocity ?? { x: 0, z: 0 }, tick = world.tick;
  const s = e.civilian!.survivor!, last = s.pace, paceEase = 1 / 36;
  // courierPace easing without writing s.pace (a second real call would perturb the perceived pace).
  const pace = !last || tick - last.tick > 1 || Math.hypot(v.x, v.z) >= Math.hypot(last.x, last.z) * (1 - paceEase)
    ? { x: v.x, z: v.z }
    : { x: last.x + (v.x - last.x) * paceEase, z: last.z + (v.z - last.z) * paceEase };
  const paceSpeed = Math.hypot(pace.x, pace.z);
  if (paceSpeed <= .8) return { paceSpeed };
  const nav = world.infected!.nav, slot = Math.max(0, s.slot);
  const row = Math.floor(slot / 3), back = 2.7 + row * .7;
  const side = (row ? [-.6, .6, 0][slot % 3] : (slot % 3 - 1) * 1.2) + looseSlotOffset(slot).side * .4 + swayOffset(e.id, tick, .12);
  const heading = { x: pace.x / paceSpeed, z: pace.z / paceSpeed };
  const candidates = [{ x: p.x - heading.x * back - heading.z * side, z: p.z - heading.z * back + heading.x * side },
    { x: p.x - heading.x * back, z: p.z - heading.z * back }]
    .map(t => ({ x: Math.round(t.x * 100) / 100, z: Math.round(t.z * 100) / 100, clear: nav.clear(t.x, t.z, .35), visible: nav.visible(t, p, .35) }));
  return { paceSpeed: Math.round(paceSpeed * 100) / 100, back, side: Math.round(side * 100) / 100, candidates };
}

const run = await runLevel(level, 'complete', seed, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    const threats = new ThreatObserver(world, level, { paths: false });
    world.events.on('level.completed', () => { threat = threats.finish(); });
    const npc = world.npcs!;
    const move = npc.move.bind(npc);
    const requests = new Map<number, { goal: { x: number; z: number }; speed: number; stop: number; result: boolean }[]>();
    npc.move = (...args) => {
      const [e, goal, speed, , stop = .1] = args, result = move(...args);
      if (e.civilian?.survivor?.mode === 'follow') (requests.get(e.id) ?? requests.set(e.id, []).get(e.id)!).push({ goal: { x: goal.x, z: goal.z }, speed, stop, result });
      return result;
    };
    // Snapshot the exact branch inputs after the player's intent resolves and before the ai phase runs.
    let diag = new Map<number, Diag | { paceSpeed: number }>();
    world.events.on('sim.tick', () => {
      diag = new Map();
      for (const [, list] of requests) list.length = 0;
      if (level !== 'L5') return;
      for (const e of world.entities.iterate()) if (e.civilian?.survivor?.mode === 'follow' && !e.hidden && e.health.current > 0) diag.set(e.id, calmCandidates(world, e));
    }, SimPhase.intent + .5);
    const update = world.update.bind(world);
    world.update = () => {
      const player = world.entities.get(1)!, before = { ...player.transform }, tick = world.tick;
      const l6Before = world.missions!.state.l6 ? { x: world.missions!.state.l6.leaderX, z: world.missions!.state.l6.leaderZ } : null;
      update();
      if (world.tick === tick) return;
      if (level === 'L5') formation.observe(world, before);
      const after = world.entities.get(1)!.transform;
      const leaderSpeed = Math.hypot(after.x - before.x, after.z - before.z) * 60 / (world.tick - tick);
      const phase = world.missions!.state.l5?.phase ?? world.missions!.state.l6?.phase ?? '';
      const l6Leader = world.missions!.state.l6;
      for (const e of world.entities.iterate()) {
        if (e.civilian?.survivor?.mode !== 'follow' || e.hidden || e.health.current <= 0) continue;
        const c = e.civilian!, s = c.survivor!, me = e.transform;
        const d = Math.hypot(me.x - after.x, me.z - after.z);
        const vx = after.x - before.x, vz = after.z - before.z, len = Math.hypot(vx, vz);
        const behind = len > .01 ? ((after.x - me.x) * vx + (after.z - me.z) * vz) / len : 0;
        rows.push({
          tick: world.tick, id: e.id, slot: Math.max(0, s.slot), phase, state: c.state, cover: !!s.cover,
          inCombat: followerInCombat(world, e), brisk: s.briskAt === world.tick,
          ally: c.ally ? { actionId: c.ally.actionId, engaged: c.ally.engaged, targetId: c.ally.targetId, strike: !!c.ally.strikeAt, run: !!c.ally.run, runSpeed: c.ally.runSpeed ?? null } : null,
          danger: c.dangerUntil ?? 0, story: c.story?.clip ?? null, hp: Math.round(e.health.current / e.health.max * 100) / 100,
          restAt: s.restAt, stirAt: s.stirAt, ingress: !!world.missions?.l5?.ingress(e),
          d: Math.round(d * 100) / 100, behind: Math.round(behind * 100) / 100,
          me: { x: Math.round(me.x * 10) / 10, z: Math.round(me.z * 10) / 10 }, p: { x: Math.round(after.x * 10) / 10, z: Math.round(after.z * 10) / 10 },
          loco: e.locomotion ? Math.round(Math.hypot(e.locomotion.vx, e.locomotion.vz) * 100) / 100 : null,
          blocker: world.solids.blockingBody(e.id)?.id ?? null,
          leaderSpeed: Math.round(leaderSpeed * 100) / 100, motion: e.motion ? Math.round(e.motion.speed * 100) / 100 : null,
          l6Gap: l6Leader && l6Before ? Math.round(Math.hypot(me.x - l6Leader.leaderX, me.z - l6Leader.leaderZ) * 100) / 100 : null,
          requests: (requests.get(e.id) ?? []).map(r => ({ ...r, goal: { x: Math.round(r.goal.x * 10) / 10, z: Math.round(r.goal.z * 10) / 10 }, speed: Math.round(r.speed * 100) / 100 })),
          diag: diag.get(e.id) ?? null,
        });
      }
    };
  },
  beforeDispose: world => { finalHash = stateHash(world.getState()); },
});

// Compact classification of the calm-escort fall-out per follower.
const buckets = new Map<string, number>();
for (const row of rows as { state: string; cover: boolean; inCombat: boolean; leaderSpeed: number; requests: unknown[]; diag: { paceSpeed: number; candidates?: { clear: boolean; visible: boolean }[] } | null }[]) {
  if (row.state !== 'calm' || row.cover || row.inCombat || row.leaderSpeed <= .8) continue;
  const pace = row.diag?.paceSpeed ?? 0;
  let key: string;
  if (pace <= .8) key = 'pace<=0.8 (perceived stop)';
  else if (!row.diag?.candidates?.some(t => t.clear && t.visible)) key = 'no slot candidate clear+visible';
  else if (row.requests.length > 1) key = 'calm request then generic fallback request';
  else if (!row.requests.length) key = 'no move request at all (reacting/ingress?)';
  else key = 'calm branch owned the tick';
  buckets.set(key, (buckets.get(key) ?? 0) + 1);
}
writeFileSync(out, gzipSync(JSON.stringify({ ...identity, level, tier, seed, method: 'read-only wrappers around world.update and npcs.move; no gameplay state changed', run, finalHash, threat, formation: level === 'L5' ? formation.snapshot() : [], buckets: [...buckets], rows })));
console.log(out, run.outcome, 'rows', rows.length, 'calm-classification', [...buckets]);
if (threat) for (const phase of threat.phases) {
  if (!phase.key.startsWith('step/')) continue;
  const speeds = phase.followerSpeeds.filter(f => f.samples >= 10).map(f => f.median).sort((a, b) => a - b);
  const group = speeds.length % 2 ? speeds[(speeds.length - 1) / 2] : (speeds[speeds.length / 2 - 1] + speeds[speeds.length / 2]) / 2;
  console.log(phase.key, phase.followerSpeeds.map(f => `${f.id}:${f.samples}s${Math.round(f.median * 100) / 100}${group ? `=${Math.round(f.median / group * 1000) / 1000}` : ''}`).join(' '));
}
