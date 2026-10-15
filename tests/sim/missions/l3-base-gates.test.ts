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
  expect(w.events.events().filter(e => e.type === 'l3.crossed')).toHaveLength(1);
  expect(m.state.marker).toBeNull();
  expect(s.barrierClosedAt).toBeGreaterThan(0);
  for (let i = 0; i < 59 * 60; i++) w.update();
  expect(s.doneAt).toBe(0);
  for (let i = 0; i < 2 * 60; i++) w.update();
  expect(s.doneAt - s.crossedAt).toBe(60 * 60);
  expect(w.events.events().filter(e => e.type === 'l3.crossed')).toHaveLength(1);
}, 120_000);
