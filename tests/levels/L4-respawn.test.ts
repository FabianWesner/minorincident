import { afterEach, expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { NavGrid } from '../../src/sim/ai/NavGrid';
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

test('L4 @E22 @E22-AC17 respawn clears live and recovering infected when cover blocks the outward ray', async () => {
  const l = await loadL4(4); world = l.world;
  l.mission.completeObjective('ride');
  const anchor = { x: -20, z: -38.2 }, ai = world.infected!;
  const ids = [1.25, 2].map(dx => ai.spawn('infected.runner', { x: anchor.x + dx, z: anchor.z }));
  const downed = world.entities.get(ids[1])!;
  downed.health.current = 0; downed.infected!.recoverAt = world.tick + 180;
  ai.nav.setBlocker(900_999, { x: anchor.x + 12, y: 1, z: anchor.z, halfX: 4, halfY: 1, halfZ: 2 }, true);
  for (let m = respawnRule.clearM; m <= respawnRule.clearM + 6; m++) expect(ai.nav.clear(anchor.x + m, anchor.z, .45)).toBe(false);
  respawnAtCheckpoint(world, anchor);
  for (const id of ids) {
    const e = world.entities.get(id)!;
    expect(Math.hypot(e.transform.x - anchor.x, e.transform.z - anchor.z)).toBeGreaterThanOrEqual(respawnRule.clearM - .001);
    expect(ai.nav.clear(e.transform.x, e.transform.z, .45)).toBe(true);
    expect(e.infected!.l1!.pauseUntil).toBe(world.tick + respawnRule.delayS * 60);
  }
});

test('L4 @E22 @E22-AC17 a falling line anchors at the nearest safe camp post rather than an overrun post', async () => {
  const l = await loadL4(4); world = l.world;
  l.mission.completeObjective('ride');
  const [x, z] = l4.director.checkpoints[2][1], player = world.entities.get(1)!;
  Object.assign(player.transform, { x, z }); world.physics.playerBody!.setTranslation(player.transform, true); world.spatial.set(1, x, z);
  world.infected!.spawn('infected.runner', { x: x + 1, z });
  l.mission.l4!.campCheckpoint('nests', 2);
  world.update();
  const cp = player.survivor!.checkpoint, [safeX, safeZ] = l4.director.checkpoints[2][2];
  expect(l.mission.state.checkpoint).toBe('nests');
  expect(Math.hypot(cp.x - safeX, cp.z - safeZ)).toBeLessThanOrEqual(respawnRule.snapM);
  expect(Math.hypot(player.transform.x - x, player.transform.z - z)).toBeLessThan(.5);
});


test('L4 @E22 @E22-AC17 camp perimeter constrains player retreat routes until the gate opens, without blocking infected', () => {
  const nav = new NavGrid({ width: 30, depth: 30 }, []), route = { path: [] as number[], goal: -1, pathIndex: 0 }, waypoint = { x: 0, z: 0 };
  nav.setPlayerBounds({ x0: -5, x1: 5, z0: -5, z1: 5 });
  const path: number[] = [];
  expect(nav.reachPath(nav.cell(0, 0), { x: 9, z: 0 }, path)).toBe(true);
  expect(path.length).toBeGreaterThan(0);
  for (const cell of path) { expect(Math.abs(nav.x(cell))).toBeLessThanOrEqual(5 - nav.clearance); expect(Math.abs(nav.z(cell))).toBeLessThanOrEqual(5 - nav.clearance); }
  expect(nav.steer({ x: 0, z: 0 }, { x: 9, z: 0 }, route, .45, waypoint, Infinity, true)).toBe(true);
  expect(waypoint.x).toBeLessThanOrEqual(5 - nav.clearance);
  expect(nav.steer({ x: 0, z: 0 }, { x: 9, z: 0 }, route, .45, waypoint)).toBe(true);
  expect(waypoint.x).toBe(9);
  nav.setPlayerBounds(null);
  expect(nav.steer({ x: 0, z: 0 }, { x: 9, z: 0 }, route, .45, waypoint, Infinity, true)).toBe(true);
  expect(waypoint.x).toBe(9);
});
