import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import type { GameEvent } from '../../src/sim/world/types';

const output = process.env.S157_OUTPUT ?? '/private/tmp/s157-current.json';
mkdirSync(output.slice(0, output.lastIndexOf('/')), { recursive: true });
const rows: unknown[] = [];
for (const quality of ['high', 'low'] as const) for (const policy of ['skilled', 'walk'] as const) for (const seed of [1, 2, 3]) {
  const events: unknown[] = [];
  const lastGrab = new Map<number, unknown>();
  const lastMovement = new Map<number, { x: number; z: number; tick: number }>();
  let final: unknown;
  let survivors: unknown[] = [];
  const run = await runLevel('L6', 'complete', seed, 700, 'auto', undefined,
    (_world, result) => { final = result; }, 0, {
      quality,
      beforeBegin(world) {
        const apply = world.applyInput.bind(world);
        if (policy === 'walk') world.applyInput = (frame, scheme) => apply({ ...frame, walk: true }, scheme);
        const update = world.update.bind(world);
        world.update = (...args: Parameters<typeof world.update>) => {
          const result = update(...args);
          for (const row of world.missions?.state.l6?.survivors ?? []) {
            const e = world.entities.get(row.id); if (!e) continue;
            const previous = lastMovement.get(row.id);
            if (!previous || Math.hypot(e.transform.x - previous.x, e.transform.z - previous.z) >= .01)
              lastMovement.set(row.id, { x: e.transform.x, z: e.transform.z, tick: world.tick });
          }
          return result;
        };
        world.events.on('civilian.grabbed', event => {
          const raw = event as Extract<GameEvent, { type: 'civilian.grabbed' }>;
          const victim = world.entities.get(raw.targetId), attacker = world.entities.get(raw.sourceId);
          lastGrab.set(raw.targetId, { tick: raw.tick, id: raw.targetId, infectedId: raw.sourceId,
            infected: attacker?.archetype, infectedPosition: attacker && { x: attacker.transform.x, z: attacker.transform.z },
            x: victim?.transform.x, z: victim?.transform.z, phase: world.missions!.state.l6!.phase });
        });
        world.events.on('civilian.turned', event => {
          const raw = event as Extract<GameEvent, { type: 'civilian.turned' }>;
          const attacker = world.entities.get(raw.infectedId), victim = world.entities.get(raw.id), state = world.missions!.state.l6!;
          events.push({ kind: 'turned', tick: raw.tick, id: raw.id, infectedId: raw.infectedId, infected: attacker?.archetype,
            infectedPosition: attacker && { x: attacker.transform.x, z: attacker.transform.z }, ...lastGrab.get(raw.id) as object,
            phase: state.phase, x: raw.position.x, z: raw.position.z, courierX: world.entities.get(1)?.transform.x,
            leaderX: state.leaderX, speed: victim?.motion?.speed,
            stationarySeconds: +((raw.tick - (lastMovement.get(raw.id)?.tick ?? raw.tick)) / 60).toFixed(2),
            gates: state.gates.map(g => ({ x: g.x, closed: !!g.closedAt })) });
        });
        world.events.on('civilian.finished', event => {
          const raw = event as unknown as { tick: number; id: number; type: string };
          const victim = world.entities.get(raw.id), state = world.missions!.state.l6!;
          if (victim?.health.current === 0) events.push({ kind: 'dead', tick: raw.tick, id: raw.id, ...lastGrab.get(raw.id) as object,
            phase: state.phase, x: victim.transform.x, z: victim.transform.z, courierX: world.entities.get(1)?.transform.x,
            leaderX: state.leaderX, speed: victim.motion?.speed,
            stationarySeconds: +((raw.tick - (lastMovement.get(raw.id)?.tick ?? raw.tick)) / 60).toFixed(2),
            gates: state.gates.map(g => ({ x: g.x, closed: !!g.closedAt })) });
        });
      },
      beforeDispose(world) {
        const s = world.missions!.state.l6!;
        survivors = s.survivors.map(r => { const e = world.entities.get(r.id); return { id: r.id, key: r.key, injured: r.injured, status: r.status,
          position: e && { x: e.transform.x, z: e.transform.z }, health: e?.health.current, infection: !!e?.infection, state: e?.civilian?.state }; });
      },
    });
  const result = final as { rescued?: number; survivorsLost?: number; survivorsIn?: number } | undefined;
  const row = { quality, policy, seed, completed: run.completed, outcome: run.outcome, deaths: run.deaths, time: run.time,
    rescued: result?.rescued, survivorsLost: result?.survivorsLost, survivorsIn: result?.survivorsIn, survivors, events };
  rows.push(row);
  writeFileSync(output, JSON.stringify(rows));
  console.log(JSON.stringify({ quality, policy, seed, outcome: run.outcome, deaths: run.deaths, saved: result?.rescued, total: survivors.length, time: run.time }));
  if (!run.completed) console.log(JSON.stringify({ quality, policy, seed, blocker: run.blocker }));
}
