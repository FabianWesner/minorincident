import { afterEach, expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { l5Survivors } from '../../src/data/l5';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL5, runL5 } from '../../tools/sim-runner/l5Bots';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test('PO #21 @E23 @E23-AC08 @E23-AC09 survivor-2 restore: walking to the sound reveals survivors 3, 4 and 5, then reaches the ending', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const { mission } = loaded, w = world;
  runL5(w, mission, 'complete', { stopWhen: m => m.state.checkpoint === 'survivor-2' });
  expect(mission.state.checkpoint).toBe('survivor-2');
  mission.restore('survivor-2');
  const cues = new Map<string, { x: number; z: number }>();
  w.events.on('l5.cue', e => { if (e.type === 'l5.cue') cues.set(e.key, e.position); });
  // Follow the emitted position with the ordinary navigation input; no ring-coordinate shortcut.
  // The protector bot handles threats and the trip between hearing ranges.
  for (const count of [3, 4, 5]) {
    const result = runL5(w, mission, 'complete', { maxSeconds: 240, stopWhen: m => m.state.l5!.found >= count || [...cues.keys()].some(key => m.state.l5!.survivors.find(r => r.key === key)?.status === 'hidden') });
    void result;
    const hidden = mission.state.l5!.survivors.find(r => r.status === 'hidden' && cues.has(r.key));
    expect(hidden, `heard survivor ${count}`).toBeDefined();
    const sound = cues.get(hidden!.key)!;
    const ring = mission.def.anchors[`l5-ring-${hidden!.key}`];
    expect(sound).toEqual({ x: ring.x, z: ring.z });
    for (let tick = 0; tick < 60 * 60 && mission.state.l5!.found < count; tick++) {
      w.applyInput({ ...emptyInput(), moveTarget: sound, interact: true }, 'keyboard'); w.update();
    }
    expect(mission.state.l5!.found, `find ${count} by walking to ${hidden!.key}'s sound`).toBe(count);
    const survivor = w.entities.get(hidden!.id)!;
    expect(survivor.hidden).toBe(false);
    expect(survivor.civilian!.survivor!.mode).toBe('follow');
    expect(distance(survivor.transform, sound)).toBeLessThanOrEqual(2.5);
  }
  const end = runL5(w, mission, 'complete', { maxSeconds: 300 });
  expect(end.outcome).toBe('complete');
}, 1_800_000);

test('PO #21 @E23 @E23-AC09 discovery is available from every reachable side within 2.5 m of each sound', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const { mission } = loaded, w = world;
  mission.completeObjective('emerge'); for (let i = 0; i < 661; i++) w.update();
  for (const e of [...w.infected!.active]) w.infected!.release(e);
  mission.checkpoint('outside');
  for (const def of l5Survivors) {
    let sides = 0;
    for (let angle = 0; angle < 8; angle++) {
      mission.restore('outside');
      const ring = mission.def.anchors[`l5-ring-${def.key}`];
      const p = { x: ring.x + 2.4 * Math.cos(angle * Math.PI / 4), z: ring.z + 2.4 * Math.sin(angle * Math.PI / 4) };
      if (!w.trapRescue!.reachable(p.x, p.z) || !w.infected!.nav.clear(p.x, p.z, .4)) continue;
      sides++;
      const player = w.entities.get(1)!; Object.assign(player.transform, p); Object.assign(w.previousPlayer!, player.transform);
      w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform); w.spatial.set(1, p.x, p.z);
      for (let tick = 0; tick < 61; tick++) w.update();
      expect(mission.state.l5!.survivors.find(r => r.key === def.key)!.status, `${def.key} side ${angle}`).toBe('following');
    }
    expect(sides, `${def.key} reachable sides`).toBeGreaterThan(0);
  }
}, 300_000);
