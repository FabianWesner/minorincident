/** Scratch (r2-l5): per-tick along-heading loss decomposition for calm L5 followers.
 * loss = courier advance - follower advance, split into request (controller asked for less),
 * response (own move fell short of the request) and contact (separation/limiter after the move). */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { followerInCombat } from '../../../src/sim/outbreak/Survivors';
import { L5FormationObserver } from './l5-formation';

const tier = process.argv[2] === 'high' ? 'high' : 'low', seed = Number(process.argv[3] ?? 1);
const campaign = preset('L5-default'); campaign.settings.quality = tier;
const observer = new L5FormationObserver();
const rows: unknown[] = [];
const run = await runLevel('L5', 'complete', seed, undefined, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: world => {
  const npc = world.npcs!, move = npc.move.bind(npc);
  const req = new Map<number, { goal: { x: number; z: number }; speed: number; before: { x: number; z: number }; after: { x: number; z: number }; line: string }>();
  npc.move = (...args) => {
    const [e, goal, speed] = args;
    if (e.civilian?.survivor?.mode !== 'follow') return move(...args);
    const before = { x: e.transform.x, z: e.transform.z }, result = move(...args);
    const caller = /at (?:\S+ \()?\S*\/src\/sim\/(\S+?):(\d+)/.exec(new Error().stack ?? '');
    req.set(e.id, { goal: { x: goal.x, z: goal.z }, speed, before, after: { x: e.transform.x, z: e.transform.z }, line: caller ? `${caller[1].split('/').pop()}:${caller[2]}` : '?' });
    return result;
  };
  const update = world.update.bind(world);
  world.update = () => {
    const p = world.entities.get(1)!, pb = { x: p.transform.x, z: p.transform.z }, tick = world.tick;
    const start = new Map<number, { x: number; z: number }>();
    for (const e of world.entities.iterate()) if (e.civilian?.survivor?.mode === 'follow') start.set(e.id, { x: e.transform.x, z: e.transform.z });
    req.clear(); update(); if (world.tick === tick) return;
    observer.observe(world, pb);
    const phase = world.missions?.state.l5?.phase; if (phase !== 'search' && phase !== 'metro') return;
    const vx = (p.transform.x - pb.x) * 60, vz = (p.transform.z - pb.z) * 60, s = Math.hypot(vx, vz);
    if (s < .2) return;
    const hx = vx / s, hz = vz / s, snap = new Map(observer.snapshot().map(r => [r.id, r]));
    for (const e of world.entities.iterate()) {
      if (e.civilian?.survivor?.mode !== 'follow' || e.hidden || e.health.current <= 0) continue;
      const b = start.get(e.id); if (!b) continue;
      const q = req.get(e.id);
      const along = (a: { x: number; z: number }, c: { x: number; z: number }) => ((c.x - a.x) * hx + (c.z - a.z) * hz) * 60;
      let nearest = 9;
      for (const o of world.entities.iterate()) if (o !== e && o.civilian?.survivor?.mode === 'follow' && !o.hidden) nearest = Math.min(nearest, Math.hypot(o.transform.x - e.transform.x, o.transform.z - e.transform.z));
      const behind = ((p.transform.x - e.transform.x) * hx + (p.transform.z - e.transform.z) * hz);
      // requested velocity along heading: direction to goal times requested speed
      let reqAlong = 0;
      if (q) { const gx = q.goal.x - q.before.x, gz = q.goal.z - q.before.z, gl = Math.hypot(gx, gz) || 1; reqAlong = (gx * hx + gz * hz) / gl * q.speed; }
      const r = snap.get(e.id);
      rows.push([world.tick, e.id, e.civilian.survivor.slot, +s.toFixed(3), +behind.toFixed(3), q ? +reqAlong.toFixed(3) : null, q ? +along(q.before, q.after).toFixed(3) : 0, +along(b, e.transform).toFixed(3),
        q ? +(along(b, e.transform) - along(q.before, q.after)).toFixed(3) : 0, q?.line ?? null, followerInCombat(world, e) ? 1 : 0, +nearest.toFixed(2), r?.badRun ?? 0, r?.straightTicks ?? 0,
        e.civilian.survivor.cover ? 1 : 0, e.civilian.state]);
    }
  };
} });
const out = `test-results/r2-l5/loss-${tier}-s${seed}-${process.env.TAG ?? 'b'}.json.gz`;
writeFileSync(out, gzipSync(JSON.stringify({ run, formation: observer.snapshot(), columns: ['tick', 'id', 'slot', 'courierSpeed', 'behind', 'reqAlong', 'ownAlong', 'finalAlong', 'postMove', 'caller', 'combat', 'nearest', 'badRun', 'straight', 'cover', 'state'], rows })));
console.log(out, run.outcome);
