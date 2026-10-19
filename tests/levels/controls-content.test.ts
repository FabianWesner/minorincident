import { afterEach, expect, test, vi } from 'vitest';
import { l4, l4Inside } from '../../src/data/l4';
import { L4Collapse } from '../../src/sim/missions/L4Collapse';
import { L4Spectacle, spawnSetPiece } from '../../src/sim/missions/L4Spectacle';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import type { SimWorld } from '../../src/sim/world/SimWorld';
let world: SimWorld;
afterEach(() => world?.dispose());
for (const tier of ['high', 'low'] as const) test(`@E22 @E22-AC07 machine gun pickup starts alarm and attack on the same tick (${tier})`, async () => {
  const l = await loadL4(1, tier); world = l.world;
  const m = l.mission, s = m.state.l4!;
  m.completeObjective('ride'); world.update();
  // Waiting never starts an attack before the pickup.
  world.tick += 101 * 60; world.update();
  expect(s.phase).toBe('plaza'); expect(s.turnAt).toBe(0); expect(m.state.checkpoint).toBe('arrival');
  const events: { type: string; tick: number }[] = [];
  world.events.on('pickup.collected', e => { if ('actionId' in e && e.actionId === 'weapon.army-mg') events.push(e); });
  world.events.on('l4.firstTurn', e => events.push(e));
  const waves: number[] = []; world.events.on('l4.wave', e => waves.push(e.tick));
  m.completeObjective('quartermaster');
  expect(m.state.checkpoint).toBe('turn'); expect(s.phase).toBe('war'); expect(s.turnAt).toBe(s.gunAt); expect(s.warAt).toBe(world.tick);
  expect(events.map(e => [e.type, e.tick])).toEqual([['pickup.collected', world.tick], ['l4.firstTurn', world.tick]]);
  expect(waves).toEqual([world.tick]);
  world.update(); expect(waves).toHaveLength(1);
}, 120_000);

test('@E22 @E22-AC11 tank aims at a safe fallback during cooldown and fires on schedule after the immediate alarm', async () => {
  const l = await loadL4(1); world = l.world;
  const s = l.mission.state.l4!, tank = spawnSetPiece(world, 'veh.tank', { x: -19, z: 20, yaw: 0 });
  s.tankId = tank.id; s.tankPhase = 'hold'; s.tankFireAt = 600;
  const spectacle = new L4Spectacle(world, () => s, () => []);
  world.tick = 600 - Math.ceil(Math.PI / l4.tank.turnRate * 60);
  const yaw = tank.transform.yaw;
  for (let i = 0; i < 10; i++) { spectacle.updateTank(); world.tick++; }
  expect(tank.transform.yaw).not.toBe(yaw);
  expect(world.events.events().some(e => e.type === 'l4.tankFire')).toBe(false);
  for (; world.tick <= 600; world.tick++) spectacle.updateTank();
  const shots = world.events.events().filter(e => e.type === 'l4.tankFire');
  expect(shots).toHaveLength(1); expect(shots[0].tick).toBe(600);
}, 120_000);

test('@E22 @E22-AC13 first-line pressure can use concealed camp exits after the immediate pickup alarm', async () => {
  const l = await loadL4(2); world = l.world; const m = l.mission, s = m.state.l4!;
  m.completeObjective('ride'); world.update(); m.completeObjective('quartermaster');
  Object.assign(world.entities.get(1)!.transform, { x: -21, z: -8 });
  const exit = l4Inside.find(([x, z]) => Math.hypot(x + 21, z + 8) >= 12)!;
  vi.spyOn(world.infected!.director, 'offscreen').mockReturnValue(false);
  vi.spyOn(world.infected!.director, 'occluded').mockImplementation(p => p.x === exit[0] && p.z === exit[1]);
  const spawned: { x: number; z: number }[] = [];
  const director = new L4Collapse({ mission: m, s: () => s, low: () => false, snap: p => p,
    emerge: p => { spawned.push(p); return 0; }, human: e => !!e?.civilian && e.health.current > 0,
    insideRing: () => true, doors: () => [], fallBack: () => {} });
  world.tick = Math.ceil((s.turnAt + l4.director.lines[0].pushS * 60) / 10) * 10;
  director.update();
  expect(spawned).toEqual([{ x: exit[0] - .9, z: exit[1] }]);
}, 120_000);
