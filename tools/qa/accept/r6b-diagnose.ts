import { writeFileSync } from 'node:fs';
import { runLevel, type RunnerLevel } from '../../sim-runner/levels';
import { newCampaign, preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { ThreatObserver } from '../threat/observer';
import { observeAttackStarts } from '../threat/attackStarts';
import { provenance } from './probe';

const level = process.argv[2] as RunnerLevel, tier = (process.argv[3] ?? 'low') as 'low' | 'high';
const campaign = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as ProgressionPreset);
campaign.settings.quality = tier;
const identity = provenance();
const snapshots: unknown[] = [], timeline: unknown[] = [], attacks: unknown[] = [];
let observer: ThreatObserver, result: ReturnType<ThreatObserver['finish']>;
const report = await runLevel(level, 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    observer = new ThreatObserver(world, level);
    observeAttackStarts(world, (sourceId, targetId, tick) => {
      if (targetId === 1) attacks.push({ tick, sourceId, targetId, source: structuredClone(world.entities.get(sourceId)), player: structuredClone(world.entities.get(1)) });
    });
    const update = world.update.bind(world);
    const minima = new Map<string, number>();
    world.update = () => {
      update();
      const player = world.entities.get(1)!;
      const rows = (observer as unknown as { rows: Map<string, { boundedPaths?: { minimumPercent: number; worstTick: number; blockedIds: number[] } }> }).rows;
      for (const [key, row] of rows) {
        const bp = row.boundedPaths;
        if (!key.startsWith('phase/') || !bp || bp.minimumPercent >= (minima.get(key) ?? 100)) continue;
        minima.set(key, bp.minimumPercent);
        const nav = world.infected!.navigation.grid(player.transform);
        snapshots.push({ key, tick: world.tick, bounded: { ...bp }, player: structuredClone(player),
          actors: world.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= 30).map(e => structuredClone(e)),
          navigation: { ground: nav.ground, walls: nav.walls, clearance: nav.clearance, center: nav.center, cellSize: nav.cellSize, blockers: [...(nav as unknown as { blockers: Map<number, unknown> }).blockers] },
          mission: structuredClone(world.missions!.state),
        });
      }
      if (level === 'L8' && world.tick % 60 === 0 && world.missions!.l8!.state.breachedAt) timeline.push({ tick: world.tick, player: { ...player.transform }, phase: world.missions!.state.steps,
        outlets: structuredClone(world.missions!.l8!.state.outlets),
        actors: world.infected!.active.filter(e => e.health.current > 0).map(e => ({ id: e.id, at: { ...e.transform }, emerging: e.emerging, l1: e.infected!.l1, state: e.infected!.state, scripted: e.infected!.scripted, pressure: e.infected!.pressureTarget })),
      });
    };
  },
  beforeDispose: () => { result = observer.finish(); },
});
writeFileSync(`docs/reports/fix51-r6b/${level}-${tier}-diagnosis.json`, JSON.stringify({ ...identity, report, threat: result!, snapshots, timeline, attacks }));
console.log(JSON.stringify({ level, tier, report, phases: result!.phases.map(p => ({ key: p.key, seconds: p.seconds, attacks: p.attacks, bounded: p.boundedPaths })) }));
