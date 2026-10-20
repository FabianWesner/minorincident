import { expect, test } from 'vitest';
import { SurvivorRings } from '../../../src/render/SurvivorRings';
import { l5Survivors } from '../../../src/data/l5';

test('survivor ring count tracks the unfound survivors during the look step', () => {
  const anchors: Record<string, unknown> = {};
  l5Survivors.forEach((s, i) => { anchors[`l5-ring-${s.key}`] = { x: i * 30, z: 5, radius: 2.5 }; });
  const l5 = { phase: 'search', accountedAt: 0, survivors: l5Survivors.map(s => ({ key: s.key, status: 'hidden' as string })) };
  const world = { tick: 3, missions: { state: { l5 }, def: { anchors } } };
  const rings = new SurvivorRings(world as never);
  try {
    expect(rings.children).toHaveLength(5);
    rings.update(); expect(rings.visibleCount()).toBe(5);
    l5.survivors[1].status = 'following'; rings.update(); expect(rings.visibleCount()).toBe(4);
    l5.survivors[3].status = 'dead'; rings.update(); expect(rings.visibleCount()).toBe(3);
    l5.phase = 'emerged'; rings.update(); expect(rings.visibleCount()).toBe(0);
    l5.phase = 'metro'; rings.update(); expect(rings.visibleCount()).toBe(0);
  } finally { rings.dispose(); }
});
