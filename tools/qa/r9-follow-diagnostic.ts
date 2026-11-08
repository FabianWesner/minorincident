import { writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { ThreatObserver } from './threat/observer';
import type { EntitySnapshot } from '../../src/sim/world/types';

const seed = Number(process.argv[2] ?? 1), campaign = preset('L7-default');
campaign.seed = seed; campaign.settings.quality = 'low';
const snapshots: unknown[] = [];
const goals = new Map<number, { x: number; z: number; clear: boolean }>();
let observer: ThreatObserver | undefined;
const run = await runLevel('L7', 'complete', seed, undefined, 'auto', campaign, undefined, 0, {
  quality: 'low', beforeBegin: world => {
    observer = new ThreatObserver(world, 'L7', { paths: false, followersOnly: true });
    const encounters = world.l7Encounters! as unknown as { formationGoal: (p: EntitySnapshot['transform'], v: { x: number; z: number }, slot: number) => { x: number; z: number } };
    const formationGoal = encounters.formationGoal.bind(encounters);
    encounters.formationGoal = (p, v, slot) => {
      const point = formationGoal(p, v, slot);
      goals.set(slot, { ...point, clear: world.infected!.nav.clear(point.x, point.z, .35) });
      return point;
    };
    const update = world.update.bind(world);
    world.update = (...args) => {
      const result = update(...args);
      if (world.tick % 30 === 0 && world.missions?.state.steps.departure?.status === 'active') {
        const p = world.entities.get(1)!;
        snapshots.push({ tick: world.tick, player: { position: { ...p.transform }, velocity: { ...p.survivor!.velocity } },
          boarding: world.l7Departure?.state.phase,
          followers: [...world.entities.iterate()].filter(e => e.civilian?.survivor?.mode === 'follow').map(e => ({
            id: e.id, position: { ...e.transform }, motion: structuredClone(e.motion), locomotion: structuredClone(e.locomotion),
            hidden: e.hidden, passengerOf: e.passengerOf, slot: e.civilian!.survivor!.slot,
            goal: e.civilian!.goal, pathIndex: e.civilian!.pathIndex, path: [...e.civilian!.path],
            target: e.civilian!.l1?.target,
            formation: goals.get(e.civilian!.survivor!.slot),
          })) });
      }
      return result;
    };
  },
});
const observation = observer!.finish();
const output = `/tmp/r9-follow-${seed}.json`;
writeFileSync(output, JSON.stringify({ seed, run, observation, snapshots }, null, 2)+'\n');
console.log(JSON.stringify({ seed, output, flags: observation.phases.flatMap(p => p.flags), snapshots: snapshots.length }));
