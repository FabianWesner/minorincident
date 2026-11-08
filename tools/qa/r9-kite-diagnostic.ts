import { writeFileSync } from 'node:fs';
import { LevelRunStopped, runLevel, type RunnerLevel } from '../sim-runner/levels';
import { preset, type ProgressionPreset } from '../../src/sim/progression/Campaign';
import { finishKitingReceipt, installKitingPolicy, type KitingReceipt } from './threat/kiting';

const level = (process.argv[2] ?? 'L5') as RunnerLevel;
const seed = Number(process.argv[3] ?? 1);
const output = process.argv[4] ?? `/tmp/r9-${level}-${seed}.json`;
const campaign = preset(`${level}-default` as ProgressionPreset);
campaign.seed = seed; campaign.settings.quality = 'low';
const receipt: KitingReceipt = { kitingSeconds: 0, attacks: 0, attacksPerMinute: 0, samples: 0 };
const snapshots: unknown[] = [], events: unknown[] = [];
let complete = () => false, lastSnapshot = -1;
try {
  await runLevel(level, 'complete', seed, undefined, 'auto', campaign, undefined, 0, {
    quality: 'low',
    beforeBegin: world => {
      complete = installKitingPolicy(world, receipt, level);
      for (const type of ['combat.attack', 'combat.hit', 'combat.kill', 'telegraph'] as const) world.events.on(type, event => {
        if (receipt.samples > 0 && !complete()) events.push(structuredClone(event));
      });
      const update = world.update.bind(world);
      world.update = (...args) => {
        const result = update(...args);
        if (receipt.samples > 0 && (lastSnapshot < 0 || world.tick - lastSnapshot >= 30)) {
          lastSnapshot = world.tick;
          const player = world.entities.get(1)!;
          snapshots.push({ tick: world.tick, player: { position: { ...player.transform }, velocity: structuredClone(player.survivor?.velocity),
            action: world.combat!.runner.loadout.current(player.weapons!.selectedSide).id },
          infected: world.infected!.active.map(e => ({ id: e.id, archetype: e.archetype, position: { ...e.transform },
            distance: Math.hypot(e.transform.x-player.transform.x,e.transform.z-player.transform.z), hp: e.health.current,
            state: e.infected!.state, speed: e.infected!.speed, heard: e.infected!.heardTargetId,
            brain: e.infected!.l1 ? structuredClone(e.infected!.l1) : undefined,
            reaction: structuredClone(e.combat?.reaction), statuses: structuredClone(e.combat?.statuses), visible: world.combat!.query.visible(e.transform,player.transform)
          })).filter(e => e.distance <= 40).sort((a,b)=>a.distance-b.distance) });
        }
        return result;
      };
    },
    stopWhen: () => complete(),
  });
} catch (error) { if (!(error instanceof LevelRunStopped)) throw error; }
const result = { level, seed, receipt: finishKitingReceipt(receipt), snapshots, events };
writeFileSync(output, JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify({ level, seed, receipt: result.receipt, snapshots: snapshots.length, events: events.length, output }));
