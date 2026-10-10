import { afterEach, expect, test } from 'vitest';
import { loadL2 } from '../../../tools/sim-runner/l2Bots';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

test('@E20 required axe: 120 s idle stays calm; pickup equips and rings the alarm in the same tick', async () => {
  const l = await loadL2(1); world = l.world;
  const alarms: number[] = [], pickups: number[] = [];
  world.events.on('l2.alarm', e => alarms.push(e.tick));
  world.events.on('pickup.collected', e => pickups.push(e.tick));
  expect(l.mission.state.marker).toBe('l2-axe-rack');
  for (let i = 0; i < 120 * 60; i++) world.update();
  expect(l.mission.state.l2).toMatchObject({ phase: 'calm', alarmAt: 0, axe: false, departAt: 0 });
  expect(alarms).toEqual([]);
  expect(world.infected!.active).toHaveLength(0);
  const rack = l.mission.def.anchors['l2-axe-rack'];
  world.entities.get(1)!.transform.x = rack.x; world.entities.get(1)!.transform.z = rack.z;
  for (let i = 0; i < 60 && !l.mission.state.l2!.axe; i++) { world.setInput({ interact: true }); world.update(); }
  expect(l.mission.state.l2).toMatchObject({ phase: 'alarm', axe: true });
  expect(alarms).toEqual(pickups);
  expect(alarms).toHaveLength(1);
  expect(world.tick - alarms[0]).toBeLessThanOrEqual(1);
  expect(world.combat!.runner.loadout.state.selectedSide).toBe('LEFT');
  expect(world.combat!.runner.loadout.current('LEFT').id).toBe('weapon.fire-axe');
  world.clearInput();
  for (let i = 0; i < 60; i++) world.update();
  expect(alarms).toHaveLength(1);
  expect(l.mission.state.steps.board.status).toBe('active');
}, 120_000);
