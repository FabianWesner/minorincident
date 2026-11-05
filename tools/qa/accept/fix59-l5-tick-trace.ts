/** Read-only per-tick L5 follower trace: controller request, combat state at
 * request time and resolved position, for locating calm formation gaps. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { followerInCombat } from '../../../src/sim/outbreak/Survivors';
import { L5FormationObserver } from './l5-formation';

const tier = process.argv[2] === 'high' ? 'high' : 'low';
const campaign = preset('L5-default'); campaign.settings.quality = tier;
const observer = new L5FormationObserver();
const rows: unknown[] = [];
const run = await runLevel('L5', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    const npc = world.npcs!, move = npc.move.bind(npc), requests = new Map<number, { goal: { x: number; z: number }; speed: number; combat: boolean; n: number }>();
    npc.move = (...args) => {
      const [e, goal, speed] = args;
      if (e.civilian?.survivor?.mode === 'follow') {
        const prev = requests.get(e.id);
        const caller = /at (?:\S+ \()?\S*\/src\/sim\/(\S+?):(\d+)/.exec(new Error().stack ?? '');
        requests.set(e.id, { goal: { x: goal.x, z: goal.z }, speed, combat: followerInCombat(world, e), n: prev && (prev as { tick?: number }).tick === world.tick ? prev.n + 1 : 1, tick: world.tick, caller: caller ? `${caller[1].split('/').pop()}:${caller[2]}` : '?' } as never);
      }
      return move(...args);
    };
    const update = world.update.bind(world);
    world.update = () => {
      const player = world.entities.get(1)!, before = { ...player.transform }, tick = world.tick;
      update(); if (world.tick === tick) return;
      observer.observe(world, before);
      const phase = world.missions?.state.l5?.phase;
      if (phase !== 'search' && phase !== 'metro') return;
      const v = player.survivor?.velocity ?? { x: 0, z: 0 };
      const snap = new Map(observer.snapshot().map(r => [r.id, r]));
      for (const e of world.entities.iterate()) {
        if (e.civilian?.survivor?.mode !== 'follow' || e.hidden || e.health.current <= 0) continue;
        const q = requests.get(e.id) as { tick?: number; goal: { x: number; z: number }; speed: number; combat: boolean } | undefined;
        const r = snap.get(e.id);
        rows.push([world.tick, e.id, +e.transform.x.toFixed(2), +e.transform.z.toFixed(2), +player.transform.x.toFixed(2), +player.transform.z.toFixed(2),
          +v.x.toFixed(2), +v.z.toFixed(2), q?.tick === world.tick - 1 || q?.tick === world.tick ? [+q.goal.x.toFixed(2), +q.goal.z.toFixed(2), +q.speed.toFixed(2), q.combat ? 1 : 0, (q as unknown as { caller: string }).caller] : null,
          followerInCombat(world, e) ? 1 : 0, e.civilian.survivor.cover ? 1 : 0, e.civilian.state, r?.badRun ?? 0, +(e.motion?.speed ?? 0).toFixed(2)]);
      }
    };
  },
});
const output = `${process.env.OUT ?? 'docs/reports/fix59-b'}/L5-${tier}-tick-trace.json.gz`;
writeFileSync(output, gzipSync(JSON.stringify({ tier, run, formation: observer.snapshot(), columns: ['tick', 'id', 'x', 'z', 'px', 'pz', 'vx', 'vz', 'request[gx,gz,speed,combat]', 'combat', 'cover', 'state', 'badRun', 'speed'], rows })));
console.log(output, run.outcome);
