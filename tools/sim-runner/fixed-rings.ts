import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runLevel, runnerLevels } from './levels';
import { markerAnchor } from '../../src/sim/missions/markerAnchor';
import { newCampaign, preset, type ProgressionPreset } from '../../src/sim/progression/Campaign';

const requested = process.env.FIXED_RING_LEVELS?.split(',') as (typeof runnerLevels[number])[] | undefined;
const levels = requested ?? runnerLevels.filter(level => level !== 'L8');
const result: Record<string, unknown> = {};
for (const level of levels) {
  const rows = new Map<string, { id: string; first: number; last: number; ticks: number; maxDelta: number; movingTicks: number }>();
  const campaign = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as ProgressionPreset);
  campaign.seed = 1; campaign.settings.quality = 'low';
  const run = await runLevel(level, 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: 'low',
    onTick(world) {
      const mission = world.missions;
      if (!mission || mission.state.phase !== 'playing') return;
      const step = mission.def.steps.find(candidate => mission.state.steps[candidate.id].status === 'active');
      let objective = step?.id ?? mission.state.marker ?? '(none)';
      const anchor = markerAnchor(mission);
      if (!anchor) return;
      const named = Object.entries(mission.def.anchors).find(([, target]) => target === anchor);
      if (named) objective += `:${named[0]}`;
      if (mission.def.id === 'L9' && mission.l9?.state.phase === 'driving') objective += mission.l9.driving.state.evacuationDone ? ':bridge-stage' : ':evacuation-stage';
      const key = `${objective}:${mission.state.marker ?? ''}`;
      const row = rows.get(key);
      if (!row) rows.set(key, { id: key, first: world.tick, last: world.tick, ticks: 1, maxDelta: 0, movingTicks: 0 });
      else {
        const previous = (row as typeof row & { x?: number; z?: number });
        const dx = anchor.x - (previous.x ?? anchor.x), dz = anchor.z - (previous.z ?? anchor.z), delta = Math.hypot(dx, dz);
        row.last = world.tick; row.ticks++; row.maxDelta = Math.max(row.maxDelta, delta); if (delta > .05) row.movingTicks++;
        previous.x = anchor.x; previous.z = anchor.z;
      }
      const stored = rows.get(key)! as typeof row & { x?: number; z?: number };
      stored.x = anchor.x; stored.z = anchor.z;
    },
  });
  result[level] = { completed: run.completed, outcome: run.outcome, furthestObjective: run.furthestObjective, blocker: run.blocker,
    rows: [...rows.values()].map(({ id, first, last, ticks, maxDelta, movingTicks }) => ({ id, first, last, ticks, maxDelta: +maxDelta.toFixed(3), movingTicks })) };
  console.log(`${level}: ${run.outcome}; ${rows.size} objective marker states`);
}
await mkdir('test-results/s230-fixedrings', { recursive: true });
const path = 'test-results/s230-fixedrings/native-trace.json';
let prior: Record<string, unknown> = {};
try { prior = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>; } catch { /* first run */ }
await writeFile(path, JSON.stringify({ ...prior, ...result }, null, 2) + '\n');
