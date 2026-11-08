/** Deliberately stop at naturally reached checkpoints and let production enemies kill the courier.
 * No entity, position, health, inventory or mission writes. This is separate from the skilled pacing run. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadLevel } from '../sim-runner/levels';
import { followTenFrustum } from '../sim-runner/l10';
import { LevelTenBot } from '../../src/debug/bot/LevelTenBot';
import { emptyInput } from '../../src/input/InputFrame';
import { cure } from '../../src/levels/L10/district';

const out = process.argv.find((arg, i) => process.argv[i - 1] === '--out') ?? 'test-results/l10-pacing/recovery.json';
const results = [];
for (const quality of ['low', 'high'] as const) {
  const world = await loadLevel('L10', 42, undefined, 0, { quality }), mission = world.missions!, bot = new LevelTenBot(world);
  const attempts = new Set<number>(), receipts: Record<string, unknown>[] = [];
  const control: { pending: { region: number; checkpoint: ReturnType<typeof mission.saveResume>['checkpoint']; stoppedAt: number; died: boolean; restoredAt: number } | null } = { pending: null };
  const racks = (entity: ReturnType<typeof world.entities.get>) => entity?.weapons ? [...entity.weapons.LEFT.rack, ...entity.weapons.RIGHT.rack].map(s => s.id) : [];
  const off = [
    world.events.on('checkpoint.set', () => {
      const p = world.entities.get(1)!.transform;
      const region = cure.regions.reduce((found, r, i) => p.x >= r.envelope[0][0] ? i : found, 0);
      if (control.pending || attempts.has(region) || mission.state.states['cure-installed'] || mission.state.states['cure-released']) return;
      attempts.add(region);
      control.pending = { region, checkpoint: mission.saveResume(true).checkpoint, stoppedAt: world.tick, died: false, restoredAt: -1 };
      console.log(`[l10-recovery] ${quality} stop region ${region} at ${world.tick / 60}s (${p.x.toFixed(1)},${p.z.toFixed(1)})`);
    }),
    world.events.on('player.died', () => { if (control.pending) control.pending.died = true; }),
    world.events.on('checkpoint.restored', () => { if (control.pending?.died) control.pending.restoredAt = world.tick; }),
  ];
  try {
    for (let tick = 0; tick < 2400 * 60 && !['result', 'progression'].includes(mission.state.phase); tick++) {
      followTenFrustum(world);
      world.applyInput(control.pending ? emptyInput() : bot.sample(), 'keyboard'); world.update();
      const pending = control.pending;
      if (pending && pending.restoredAt >= 0 && world.tick > pending.restoredAt + 2) {
        const saved = pending.checkpoint, expected = saved.entities.find(e => e.id === 1)!, actual = world.entities.get(1)!;
        const expectedBoss = saved.entities.find(e => e.infected?.pursuit), actualBoss = world.megaPursuit?.entity();
        const expectedAt = expected.survivor!.checkpoint, distance = Math.hypot(actual.transform.x - expectedAt.x, actual.transform.z - expectedAt.z);
        const sameRack = JSON.stringify(racks(expected)) === JSON.stringify(racks(actual));
        const sameCure = ['cure-carried','cure-installed'].every(key => mission.state.states[key] === saved.state.states[key]);
        const sameBoss = expectedBoss ? actualBoss?.id === expectedBoss.id && actualBoss?.health.current === expectedBoss.health.current : !actualBoss;
        receipts.push({ region: cure.regions[pending.region].id, seconds: world.tick / 60, checkpoint: mission.state.checkpoint, x: actual.transform.x, z: actual.transform.z, expectedAt, distance, rack: racks(actual), sameRack, sameCure, sameBoss, pass: distance < 2 && sameRack && sameCure && sameBoss });
        console.log(`[l10-recovery] ${quality} restored ${cure.regions[pending.region].id}, distance ${distance.toFixed(2)}, rack=${sameRack}, cure=${sameCure}, boss=${sameBoss}`);
        control.pending = null;
      }
      if (pending && world.tick - pending.stoppedAt > 180 * 60) { receipts.push({ region: cure.regions[pending.region].id, pass: false, reason: 'Enemies did not produce a death in 180s of ordinary idle input' }); control.pending = null; }
    }
    results.push({ quality, seconds: world.tick / 60, completed: ['result','progression'].includes(mission.state.phase), receipts });
  } finally { off.forEach(stop => stop()); world.dispose(); }
}
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify({ method: 'Native input only, deliberate idle deaths after naturally reached checkpoints', results }, null, 2));
if (results.some(r => r.receipts.length !== 7 || r.receipts.some(row => !row.pass))) process.exitCode = 1;
