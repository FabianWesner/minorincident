import { afterEach, expect, test } from 'vitest';
import { loadL2, runL2 } from '../../../tools/sim-runner/l2Bots';
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


test('@E20 after the alarm every playing tick has objective text and destinations have markers, including the doors checkpoint', async () => {
  const l = await loadL2(1); world = l.world;
  let checked = 0, doorsBeforeRadio = 0, restored = false;
  const report = runL2(world, l.mission, 'complete', { maxSeconds: 600, stopWhen: m => {
    if (!m.state.l2!.alarmAt || m.state.phase !== 'playing') return false;
    const active = m.def.steps.filter(s => m.state.steps[s.id].status === 'active');
    // PO 2026-10-13: combat continues for five seconds after the final objective.
    if (m.state.runOutUntil !== undefined) {
      expect(active).toHaveLength(0);
      expect(m.def.steps.every(s => m.state.steps[s.id].status === 'completed')).toBe(true);
      expect(world!.tick).toBeLessThanOrEqual(m.state.runOutUntil);
      return false;
    }
    expect(active.length, `tick ${world!.tick}, phase ${m.state.l2!.phase}`).toBeGreaterThan(0);
    expect(active[0].text).not.toBe('');
    expect(m.state.marker).toBe(active[0].waypoint === false ? null : active[0].anchor);
    if (m.state.marker) expect(m.def.anchors[m.state.marker]).toBeDefined();
    checked++;
    if (m.state.checkpoint === 'doors' && !m.state.l2!.radioAt) {
      doorsBeforeRadio++;
      expect(active[0].id).toBe('bridge');
      expect(m.state.marker).toBe('l2-gate-inside');
      if (!restored) { m.restore('doors'); restored = true; expect(m.state.steps.bridge.status).toBe('active'); expect(m.state.marker).toBe('l2-gate-inside'); }
    }
    return false;
  } });
  expect(report.outcome).toBe('complete');
  expect(checked).toBeGreaterThan(0);
  expect(doorsBeforeRadio).toBeGreaterThan(0);
  expect(restored).toBe(true);
}, 180_000);
