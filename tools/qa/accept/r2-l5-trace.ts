/** Read-only per-tick L5 follower trace: controller request, combat state at
 * request time and resolved position, for locating calm formation gaps.
 * r2-l5: `node --import tsx/esm tools/qa/accept/r2-l5-trace.ts <low|high> <seed>` (TAG env names the output);
 * extra columns: slot, health, observer straight ticks, calm target kind (0 side slot, 1 courier line,
 * -1 none) and the body that rejected the last contact step. Output: test-results/r2-l5/. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { followerInCombat } from '../../../src/sim/outbreak/Survivors';
import { L5FormationObserver } from './l5-formation';
import type { EntitySnapshot } from '../../../src/sim/world/types';

const tier = process.argv[2] === 'high' ? 'high' : 'low';
const campaign = preset('L5-default'); campaign.settings.quality = tier;
const observer = new L5FormationObserver();
const rows: unknown[] = [];
const run = await runLevel('L5', 'complete', Number(process.argv[3] ?? 1), undefined, 'auto', campaign, undefined, 0, {
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
    const kind = (e: EntitySnapshot) => {
      const sv = e.civilian!.survivor!, pace = sv.pace, p = world.entities.get(1)!.transform, nav = world.infected!.nav;
      if (!pace) return -1; const ps = Math.hypot(pace.x, pace.z); if (ps <= .8) return -1;
      const heading = { x: pace.x / ps, z: pace.z / ps }, slot = Math.max(0, sv.slot);
      const row = Math.floor(slot / 3), back = 2.7 + row * .7, side = row ? [-.6, .6, 0][slot % 3] : (slot % 3 - 1) * 1.2;
      return [{ x: p.x - heading.x * back - heading.z * side, z: p.z - heading.z * back + heading.x * side }, { x: p.x - heading.x * back, z: p.z - heading.z * back }]
        .findIndex(t => nav.clear(t.x, t.z, .35) && nav.visible(t, p, .35));
    };
    const blk = (e: EntitySnapshot) => { const b = world.solids.blockingBody(e.id); if (!b) return null;
      return [b.id, b.corpse ? 'corpse' : b.infected ? 'inf' : b.companion ? 'dog' : b.civilian?.survivor ? 'surv' : b.civilian ? 'civ' : b.id === 1 ? 'player' : b.vehicle ? 'veh' : 'other', +b.transform.x.toFixed(2), +b.transform.z.toFixed(2), b.health.current, !!b.hidden, !!b.corpse, b.infected?.state ?? null, !!b.infected?.hidden, !!b.infectionRise, !!b.infected?.perched, Math.hypot(b.transform.x - e.transform.x, b.transform.z - e.transform.z).toFixed(2)]; };
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
          followerInCombat(world, e) ? 1 : 0, e.civilian.survivor.cover ? 1 : 0, e.civilian.state, r?.badRun ?? 0, +(e.motion?.speed ?? 0).toFixed(2), e.civilian.survivor.slot, +e.health.current.toFixed(1), r?.straightTicks ?? 0, kind(e), blk(e)]);
      }
    };
  },
});
const output = `test-results/r2-l5/L5-${tier}-s${process.argv[3] ?? 1}-${process.env.TAG ?? 'base'}.json.gz`;
writeFileSync(output, gzipSync(JSON.stringify({ tier, run, formation: observer.snapshot(), columns: ['tick', 'id', 'x', 'z', 'px', 'pz', 'vx', 'vz', 'request[gx,gz,speed,combat]', 'combat', 'cover', 'state', 'badRun', 'speed'], rows })));
console.log(output, run.outcome);
