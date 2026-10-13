import { afterEach, expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { respawnAtCheckpoint, respawnRule } from '../../src/sim/missions/Respawn';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const HEAVY = 1_800_000;

function die(w: SimWorld): void {
  const player = w.entities.get(1)!;
  w.clearInput();
  w.player!.damage(player.health.current, w.tick, true);
  expect(player.health.current).toBe(0);
  for (let i = 0; i < 400 && player.health.current <= 0; i++) w.update();
  expect(player.health.current).toBeGreaterThan(0);
  const cp = player.survivor!.checkpoint;
  expect(Math.hypot(player.transform.x - cp.x, player.transform.z - cp.z)).toBeLessThanOrEqual(respawnRule.snapM);
  expect(player.survivor!.invulnerableUntil - w.tick).toBeLessThanOrEqual(120);
  expect(player.survivor!.invulnerableUntil - w.tick).toBeGreaterThan(0);
}

test('L4 @E22 @E22-AC17 three deaths after Fall back still reach the cellar from the escape checkpoint', async () => {
  const l = await loadL4(2); world = l.world;
  runL4(world, l.mission, 'complete', { stopWhen: m => m.state.checkpoint === 'line-break' });
  expect(l.mission.state.checkpoint).toBe('line-break');
  const [x, z] = l4.director.escape.checkpoint;
  const cp = world.entities.get(1)!.survivor!.checkpoint;
  expect(Math.hypot(cp.x - x, cp.z - z)).toBeLessThanOrEqual(respawnRule.snapM);
  const collapse = l.mission.state.l4!, lineBreakAt = collapse.lineBreakAt;
  for (let n = 0; n < 3; n++) {
    die(world);
    expect(l.mission.state.l4).toBe(collapse);
    expect(collapse.lineBreakAt).toBe(lineBreakAt);
    expect(l.mission.state.checkpoint).toBe('line-break');
    expect(l.mission.state.l4!.phase).toBe('collapse');
    expect(l.mission.state.l4!.director.lines.filter(line => line.brokeAt)).toHaveLength(3);
    // Move and fight through real bot inputs between deaths; infected remain active.
    if (n < 2) runL4(world, l.mission, 'complete', { maxSeconds: 3 });
  }
  const result = runL4(world, l.mission, 'complete', { maxSeconds: 180 });
  expect(result.outcome).toBe('complete');
  expect(l.mission.state.l4!.descendAt).toBeGreaterThan(0);
  expect(l.mission.state.stats.deaths).toBeGreaterThanOrEqual(3);
}, HEAVY);

test('L4 @E22 @E22-AC17 a mid-war death keeps lost lines, soldiers, and the collapse clock', async () => {
  const l = await loadL4(2); world = l.world;
  runL4(world, l.mission, 'complete', { stopWhen: m => m.state.checkpoint === 'line-1' });
  expect(l.mission.state.checkpoint).toBe('line-1');
  const s = l.mission.state.l4!, turnAt = s.turnAt;
  const lost = s.director.lines.map(line => line.brokeAt);
  expect(lost.filter(Boolean)).toHaveLength(1);
  const dead = s.soldierIds.filter(id => { const e = world!.entities.get(id); return !e || e.health.current <= 0 || e.infection; });
  die(world);
  expect(l.mission.state.l4).toBe(s);
  expect(s.turnAt).toBe(turnAt);
  expect(s.director.lines.map(line => line.brokeAt)).toEqual(lost);
  for (const id of dead) { const e = world.entities.get(id); expect(!e || e.health.current <= 0 || !!e.infection).toBe(true); }
  runL4(world, l.mission, 'complete', { stopWhen: m => m.state.checkpoint === 'line-break' });
  expect(l.mission.state.checkpoint).toBe('line-break');
  expect((s.lineBreakAt - turnAt) / 60).toBeLessThanOrEqual(l4.lineBreak.defenseS);
}, HEAVY);


test('L4 @E22 @E22-AC17 director goals respect the shared respawn pause and resume when it expires', async () => {
  const l = await loadL4(4); world = l.world;
  l.mission.completeObjective('ride');
  const anchor = { ...world.entities.get(1)!.transform }, ai = world.infected!;
  const id = ai.spawn('infected.runner', { x: anchor.x - 1.25, z: anchor.z });
  const e = world.entities.get(id)!, brain = e.infected!.l1!;
  brain.mode = 'wander'; brain.targetId = 0; e.infected!.state = 'wander';
  const downedId = ai.spawn('infected.runner', { x: anchor.x - 2, z: anchor.z });
  const downed = world.entities.get(downedId)!;
  downed.health.current = 0; downed.infected!.recoverAt = world.tick + 180;
  const recoverAt = downed.infected!.recoverAt;
  respawnAtCheckpoint(world, anchor);
  expect(Math.hypot(downed.transform.x - anchor.x, downed.transform.z - anchor.z)).toBeGreaterThanOrEqual(respawnRule.clearM);
  expect(downed.infected!.recoverAt).toBe(recoverAt);
  expect(brain.pauseUntil).toBe(world.tick + respawnRule.delayS * 60);
  expect(ai.rush(id, anchor, world.tick + 600)).toBe(false);
  expect(brain.looking).toBe(true);
  world.tick = brain.pauseUntil;
  expect(ai.rush(id, anchor, world.tick + 600)).toBe(true);
  expect(brain.mode).toBe('attracted');
});
