import { expect, test } from 'vitest';
import { l2 } from '../../../src/data/l2';
import { loadL2 } from '../../../tools/sim-runner/l2Bots';

test('@E20 phone arrival reservations survive checkpoint restore without accumulating or owning other reservations', async () => {
  const { world, mission } = await loadL2(1, 'low');
  try {
    const director = world.infected!.director;
    const expected = Math.ceil(l2.cluster.count * l2.escape.lowScale) + l2.escape.groups.slice(0, 2).reduce((n, g) => n + Math.ceil(g[2] * l2.escape.lowScale), 0);
    expect(director.cap).toBe(30);
    expect(director.reserved).toBe(expected);
    director.reserved += 2;
    for (let i = 0; i < 10; i++) world.update();
    expect(director.reserved).toBe(expected + 2);
    mission.restore('start');
    expect(director.reserved).toBe(expected + 2);
    mission.l2!.dispose(); mission.l2!.dispose();
    expect(director.reserved).toBe(2);
  } finally { world.dispose(); }
});

test('@E20 restored phone quota includes only pending cluster and first two street beats', async () => {
  const { world, mission } = await loadL2(1, 'low');
  try {
    const s = mission.state.l2!, director = world.infected!.director;
    const request = (id: number, home: readonly number[]) => ({ id, door: 'refuge-door-1', at: 0, home: { x: home[0], z: home[1] } });
    s.escapeSpawned = true;
    s.pending = [request(-2, l2.cluster.home), request(0, l2.escape.groups[0]), request(123, l2.escape.groups[1]), request(-1, l2.cluster.home), request(0, l2.escape.groups[2])];
    director.reserved += 2;
    mission.l2!.restore(0);
    expect(director.reserved).toBe(4);
    director.setTier('high');
    mission.l2!.restore(0);
    expect(director.reserved).toBe(2);
  } finally { world.dispose(); }
});
