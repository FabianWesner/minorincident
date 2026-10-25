import { expect, test } from 'vitest';
import { waitingIdle } from '../../../src/render/npc/waitingIdle';

// PO 2026-10-22 #115 (L4 plaza, "What are they doing?"): armed civilians cowered in a crouch with their guns.
test('T-PO115 armed waiting civilians stay alert, unarmed ones keep every waiting gesture @E19', () => {
  const armed = new Set<string>(), unarmed = new Set<string>(), calm = new Set<string>();
  for (let id = 1; id < 400; id++) {
    for (const prop of ['pistol', 'crowbar', 'hunting-rifle', 'bat', 'pipe']) armed.add(waitingIdle(id, prop));
    unarmed.add(waitingIdle(id, null, true)); unarmed.add(waitingIdle(id, 'coffee', true)); calm.add(waitingIdle(id)); calm.add(waitingIdle(id, 'box'));
  }
  expect([...armed].sort()).toEqual(['npc-glance', 'npc-look-around']);
  expect([...unarmed].sort()).toEqual(['npc-cower', 'npc-glance', 'npc-hug', 'npc-look-around']);
  // PO Q-159: no threat, no cower (calm waiters in the open).
  expect([...calm].sort()).toEqual(['npc-glance', 'npc-hug', 'npc-look-around']);
});
