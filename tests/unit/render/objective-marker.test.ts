import { expect, test } from 'vitest';
import { ObjectiveMarker } from '../../../src/render/ObjectiveMarker';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

test('@E02 objective ring and arrow hide during every scripted story/departure camera', () => {
  const world = { missions: { state: { phase: 'playing', marker: 'exit' }, def: { anchors: { exit: { x: 1, z: 2 } } } }, storyLock: null, l7Departure: { cinematic: false } } as unknown as SimWorld;
  const marker = new ObjectiveMarker(world);
  marker.update(); expect(marker.visible).toBe(true);
  marker.update(true); expect(marker.visible).toBe(false);
  marker.update(); expect(marker.visible).toBe(true);
  world.l7Departure!.state = { phase: 'departing' } as never;
  Object.assign(world.l7Departure!, { cinematic: true });
  marker.update(); expect(marker.visible).toBe(false);
  Object.assign(world.l7Departure!, { cinematic: false });
  world.storyLock = { scripted: null, skip: false };
  marker.update(); expect(marker.visible).toBe(false);
  world.storyLock = null; world.missions!.state.phase = 'cinematic';
  marker.update(); expect(marker.visible).toBe(false);
  world.missions!.state.phase = 'playing';
  marker.update(); expect(marker.visible).toBe(true);
  marker.dispose();
});
