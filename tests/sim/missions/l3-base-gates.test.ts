import { l3EvacuationText } from '../../../src/sim/missions/LevelThreeCollapse';
import { eventCues } from '../../../src/data/audioCues';
import { afterEach, expect, test } from 'vitest';
import { l3, l3Anchors } from '../../../src/data/l3';
import { loadL3 } from '../../../tools/sim-runner/l3Bots';
import { missionControls } from '../../../src/sim/missions/controls';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
let world: SimWorld | undefined;
afterEach(() => world?.dispose());

test('PO-10b @E21 @E21-AC17 ring acknowledges arrival immediately and preserves the evacuation minute', async () => {
  const { world: w, mission: m } = await loadL3(1); world = w;
  m.completeObjective('armory'); m.completeObjective('defend');
  const api = missionControls(w), s = m.state.l3!;
  for (const id of s.officerIds) api.teleport(id, { x: l3.map.zoneX + 3, z: 3 });
  for (const e of w.entities.iterate()) if (e.companion) api.teleport(e.id, { x: l3.map.zoneX + 4, z: 2 });
  api.teleport('player', { x: l3Anchors['l3-zone'][0], z: 0 });
  w.update();
  expect(s.crossedAt).toBe(w.tick);
  expect(l3EvacuationText(m)).toContain('Evacuation in 60 s');
  expect(eventCues['l3.crossed']).toBe('stinger.objective');
  expect(w.events.events().filter(e => e.type === 'l3.crossed')).toHaveLength(1);
  expect(m.state.marker).toBeNull();
  expect(s.barrierClosedAt).toBeGreaterThan(0);
  for (let i = 0; i < 59 * 60; i++) w.update();
  expect(s.doneAt).toBe(0);
  expect(l3EvacuationText(m)).toContain('Evacuation in 1 s');
  for (let i = 0; i < 2 * 60; i++) w.update();
  expect(s.doneAt - s.crossedAt).toBe(60 * 60);
  expect(w.events.events().filter(e => e.type === 'l3.crossed')).toHaveLength(1);
}, 120_000);

test('PO-11 @E21 @E21-AC17 full horde attacks the base for 120 s without entering the perimeter', async () => {
  const { world: w, mission: m } = await loadL3(1); world = w;
  m.completeObjective('armory'); m.completeObjective('defend');
  const s = m.state.l3!, api = missionControls(w), ai = w.infected!;
  s.pending = []; s.waves = []; s.populated = [true, true, true];
  s.finalePacks = l3.finale.packs.map(p => p[1]);
  api.teleport('player', { x: l3Anchors['l3-zone'][0] - 3, z: 0 });
  for (const id of s.officerIds) api.teleport(id, { x: l3.map.zoneX + 3, z: 3 });
  for (const e of w.entities.iterate()) if (e.companion) api.teleport(e.id, { x: l3.map.zoneX + 3, z: 2 });
  // Full concurrency at the actual gate, including its guard-hut flanks. Preserve soldier fire and real crowd steering.
  let spawned = 0;
  for (let x = l3.finale.barrierX - .8; x > l3.finale.barrierX - 30 && spawned < 200; x -= .8) {
    for (let z = -9; z <= 9 && spawned < 200; z += .8) {
      if (!ai.infectedNav.clear(x, z, .35)) continue;
      const e = ai.spawn('infected.runner', { x, z });
      ai.rush(e, { x: l3.finale.barrierX + 2, z: 0 }, w.tick + 121 * 60); spawned++;
    }
  }
  expect(spawned).toBe(200);
  expect(ai.nav.clear(l3.finale.barrierX, 0, .35)).toBe(true);
  let shots = 0;
  w.events.on('ally.attack', () => shots++);
  for (let tick = 0; tick < 120 * 60; tick++) {
    w.update();
    const inside = ai.active.filter(e => e.health.current > 0 && (e.transform.x > l3.finale.barrierX || e.transform.x > 212 && Math.abs(e.transform.z) > 4.4) && e.transform.x < 247.4 && Math.abs(e.transform.z) < 45.6);
    expect(inside.map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z })), `base breach at ${tick / 60} s`).toEqual([]);
  }
  expect(shots).toBeGreaterThan(0);
  expect(ai.infectedNav.clear(l3.finale.barrierX, 0, .35)).toBe(false);
}, 120_000);
