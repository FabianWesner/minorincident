import { expect, test } from 'vitest';
import { loadL4 } from '../../../tools/sim-runner/l4Bots';

for (const kind of ['crawler', 'riot', 'firefighter', 'hazmat']) test(`L4 retreat assigns native ${kind} pressure to a surviving soldier`, async () => {
  const { world, mission } = await loadL4(2);
  try {
    const ai = world.infected!, state = mission.state.l4!;
    for (const e of [...ai.active]) ai.release(e);
    const id = ai.spawn(`infected.${kind}`, { x: -46, z: 21 });
    const e = world.entities.get(id)!; e.infected!.heardTargetId = 1;
    state.phase = 'collapse'; world.tick = 60 + id % 60;
    (mission.l4 as unknown as { followBreachHorde(): void }).followBreachHorde();
    expect(state.soldierIds).toContain(e.infected!.heardTargetId);
    expect(e.infected!.l4FlankTarget).toBe(e.infected!.heardTargetId);
    expect(e.infected!.scripted).toBeDefined();
    expect(e.archetype).toBe(`infected.${kind}`);
  } finally { world.dispose(); }
});
