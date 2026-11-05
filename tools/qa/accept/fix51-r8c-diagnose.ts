import { writeFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { provenance } from './probe';
import { observeAttackStarts } from '../threat/attackStarts';

const rows: unknown[] = [];
for (const [level, tier] of [['L3', 'low'], ['L8', 'low'], ['L8', 'high']] as const) {
  const campaign = preset(`${level}-default` as 'L3-default' | 'L8-default');
  campaign.settings.quality = tier;
  const samples: unknown[] = [], attacks: unknown[] = [];
  let fallbackAt: number | null = null, breachAt: number | null = null;
  const run = await runLevel(level, 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      world.events.on('l3.fallback', event => { if (event.type === 'l3.fallback') fallbackAt = event.tick; });
      observeAttackStarts(world, (sourceId, targetId, tick) => {
        if (targetId === 1) {
          const enemy = world.entities.get(sourceId);
          const player = world.entities.get(1)!;
          attacks.push({ tick, sourceId, enemy: enemy ? { x: enemy.transform.x, z: enemy.transform.z, archetype: enemy.archetype } : null,
            player: { x: player.transform.x, z: player.transform.z } });
        }
      });
      const update = world.update.bind(world);
      world.update = () => {
        update();
        const player = world.entities.get(1)!;
        if (level === 'L3' && fallbackAt !== null && world.tick % 15 === 0) {
          for (const id of [30, 31, 32, 33, 34]) {
            const e = world.entities.get(id);
            if (!e?.civilian?.ally) continue;
            const a = e.civilian.ally, v = e.locomotion;
            const nearest = world.infected!.active.filter(o => o.health.current > 0 && !o.hidden)
              .map(o => ({ id: o.id, d: Math.hypot(o.transform.x - e.transform.x, o.transform.z - e.transform.z) }))
              .sort((x, y) => x.d - y.d)[0];
            samples.push({ tick: world.tick, phase: world.missions!.state.l3?.phase, id, at: { x: e.transform.x, z: e.transform.z },
              player: { x: player.transform.x, z: player.transform.z }, velocity: { x: v?.vx ?? 0, z: v?.vz ?? 0 },
              speed: Math.hypot(v?.vx ?? 0, v?.vz ?? 0), distance: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z),
              follow: a.follow ? { ...a.follow } : null, engaged: a.engaged, targetId: a.targetId, nearest });
          }
        }
        if (level === 'L8' && world.missions!.l8!.state.breachedAt && breachAt === null) breachAt = world.tick;
        if (level === 'L8' && breachAt !== null && world.tick % 30 === 0 && world.missions!.state.steps.escape.status === 'active') {
          const near = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging)
            .map(e => ({ id: e.id, d: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z),
              target: e.infected?.pressureTarget, scripted: e.infected?.scripted ?? null, at: { x: e.transform.x, z: e.transform.z } }))
            .sort((x, y) => x.d - y.d).slice(0, 12);
          samples.push({ tick: world.tick, afterBreach: world.tick - breachAt, player: { x: player.transform.x, z: player.transform.z },
            vehicle: world.vehicles!.active, near });
        }
      };
    },
  });
  rows.push({ level, tier, fallbackAt, breachAt, run, attacks, samples });
  console.log(`${level}/${tier}: complete=${run.completed}; samples=${samples.length}; player windups=${attacks.length}`);
}
writeFileSync('docs/reports/fix51-r8c/gameplay-diagnosis.json', JSON.stringify({ ...provenance(), method: 'Read-only current-source native complete runs. L3 follows squad officers and nearest threats at 0.25-second intervals after fallback; L8 samples alive emerged infections near the actual courier throughout escape. No state, inputs or clocks are altered.', rows }, null, 2));
