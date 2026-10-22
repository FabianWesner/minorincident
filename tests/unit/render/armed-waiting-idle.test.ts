import { expect, test } from 'vitest';
import { waitingIdle } from '../../../src/render/npc/waitingIdle';

// PO 2026-10-22 #115 (L4 plaza, "What are they doing?"): armed civilians cowered in a crouch with their guns.
test('T-PO115 armed waiting civilians stay alert, unarmed ones keep every waiting gesture @E19', () => {
  const armed = new Set<string>(), unarmed = new Set<string>();
  for (let id = 1; id < 400; id++) {
    for (const prop of ['pistol', 'crowbar', 'hunting-rifle', 'bat', 'pipe']) armed.add(waitingIdle(id, prop));
    unarmed.add(waitingIdle(id)); unarmed.add(waitingIdle(id, 'coffee'));
  }
  expect([...armed].sort()).toEqual(['npc-glance', 'npc-look-around']);
  expect([...unarmed].sort()).toEqual(['npc-cower', 'npc-glance', 'npc-hug', 'npc-look-around']);
});
