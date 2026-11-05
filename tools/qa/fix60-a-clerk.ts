/** Native-input clerk continuity and the former story-lock / automatic mount race. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadLevel } from '../sim-runner/levels';
import { runL1 } from '../sim-runner/l1Bots';
import { emptyInput } from '../../src/input/InputFrame';
import { provenance } from './accept/probe';

const runs = [];
for (const tier of ['low', 'high'] as const) for (const legacy of [false, true]) {
  const world = await loadLevel('L1', 1, undefined, 0, { quality: tier });
  try {
    const bike = world.vehicles!.bicycle, filter = bike.filter.bind(bike);
    if (legacy) bike.filter = frame => {
      const lock = world.storyLock;
      world.storyLock = null;
      try { return filter(frame); } finally { world.storyLock = lock; }
    };
    const setInput = world.setInput.bind(world);
    world.setInput = frame => setInput(world.storyLock ? emptyInput() : frame);
    const frames: unknown[] = [];
    let samples = 0, hidden = 0, hiddenTransfer = 0, lockedMounts = 0, carryingLocked = 0;
    const report = runL1(world, world.missions!, 'complete', {
      maxSeconds: 180,
      stopWhen: m => !!m.state.l1?.beatsDone?.includes('pickup') && !m.state.l1?.clerkId,
      onTick: () => {
        const l1 = world.missions!.state.l1!, e = world.entities.get(l1.clerkId ?? 0);
        if (!e || !l1.beat || l1.beat.id !== 'pickup') return;
        samples++;
        if (e.hidden) hidden++;
        if (e.hidden && ['npc-give', 'npc-wave'].includes(e.civilian?.story?.clip ?? '')) hiddenTransfer++;
        if (world.storyLock && bike.riding) lockedMounts++;
        if (world.storyLock && l1.carrying) carryingLocked++;
        frames.push({ tick: world.tick, carrying: l1.carrying, lock: !!world.storyLock, riding: bike.riding,
          player: { ...world.entities.get(1)!.transform }, clerk: { id: e.id, hidden: !!e.hidden,
            pending: e.pendingAdmission, at: { ...e.transform }, story: e.civilian?.story } });
      },
    });
    const completed = !!world.missions!.state.l1?.beatsDone?.includes('pickup');
    const result = { tier, legacy, samples, hidden, hiddenTransfer, lockedMounts, carryingLocked, completed, report, frames };
    runs.push(result);
    console.log(JSON.stringify({ tier, legacy, samples, hidden, hiddenTransfer, lockedMounts, carryingLocked, completed }));
  } finally { world.dispose(); }
}
writeFileSync('docs/reports/fix60-a/L1-03-native.json.gz', gzipSync(JSON.stringify({ ...provenance(), runs })));
for (const run of runs.filter(run => !run.legacy)) {
  assert(run.completed && run.samples > 0 && run.carryingLocked > 0);
  assert.equal(run.lockedMounts, 0);
  assert.equal(run.hiddenTransfer, 0);
}
assert(runs.some(run => run.legacy && run.lockedMounts > 0), 'The legacy control must expose automatic mounting during the story lock');
