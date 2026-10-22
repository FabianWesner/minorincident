import { expect, test } from 'vitest';
import { loadLevel } from './world';
import { oracle } from './oracles';

for (const tier of ['low', 'high'] as const) test(`3 late scripted scenes ${tier}: firefighter invitation and metro lookout persist`, async () => {
  const errors = new Set<string>();
  const fire = await loadLevel('L1', 1, tier);
  try {
    const m = fire.missions!, state = m.state.l1!;
    for (const [id, step] of Object.entries(m.state.steps)) step.status = id === 'firestation' ? 'active' : 'completed';
    // The actor must already be visible on the approach, before the invitation bark range.
    const door = m.def.anchors['fire-bay-door'], player = fire.entities.get(1)!;
    Object.assign(player.transform, { x: door.x + 18, z: door.z });
    fire.physics.playerBody!.setTranslation(player.transform, true);
    fire.physics.playerBody!.setNextKinematicTranslation(player.transform);
    for (let i = 0; i < 20 * 60; i++) {
      fire.update();
      const actor = fire.entities.get(state.firefighterId ?? 0);
      if (oracle.actor({ inScriptedScene: true, exists: !!actor, hidden: !!actor?.hidden })) errors.add(`L1/${tier}: invited firefighter missing/hidden at ${fire.tick}`);
    }
    expect(state.firefighterId).toBeGreaterThan(0);
  } finally { fire.dispose(); }
  const metro = await loadLevel('L5', 1, tier);
  try {
    const m = metro.missions!, s = m.state.l5!;
    // The production search completion reveals the hidden lookout; the initial-cast sweep cannot reach this beat.
    (m.l5! as unknown as { findAll(): void }).findAll();
    const id = s.lookoutId;
    expect(id).toBeGreaterThan(0);
    for (let i = 0; i < 20 * 60; i++) {
      metro.update(); const actor = metro.entities.get(id);
      if (oracle.actor({ inScriptedScene: true, exists: !!actor, hidden: !!actor?.hidden })) errors.add(`L5/${tier}: revealed lookout missing/hidden at ${metro.tick}`);
    }
    expect(metro.entities.get(id)?.civilian?.story?.clip).toBe('npc-wave-in');
  } finally { metro.dispose(); }
  expect([...errors].slice(0, 20), 'actors invariant: late scene visibility').toEqual([]);
}, 120_000);
