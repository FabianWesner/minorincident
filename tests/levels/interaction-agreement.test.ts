import { expect, test } from 'vitest';
import { loadLevel, runnerLevels } from '../../tools/sim-runner/levels';
import { activeInteractions, isRingedInteraction } from '../../src/sim/missions/interaction';
import { isMissionInteraction } from '../../src/render/InteractionView';
import type { EntitySnapshot } from '../../src/sim/world/types';

/**
 * P09: the ground ring (presentation) and the `E` press (input) read the same mission interaction descriptor.
 * For every interact step of every level, activate it alone, stand at its anchor, and require that the input
 * predicate selects the step and the ring predicate agrees with the descriptor's `ring` flag.
 */
for (const level of runnerLevels) test(`${level}: rings and input predicates agree for every interaction`, async () => {
  const world = await loadLevel(level, 1);
  try {
    const mission = world.missions!, player = world.entities.get(1)!;
    mission.state.phase = 'playing';
    let checked = 0;
    for (const step of mission.def.steps) {
      for (const other of mission.def.steps) mission.state.steps[other.id].status = other.id === step.id ? 'active' : 'pending';
      if (level === 'L10') mission.state.states['charge-active'] = false;
      const [interaction] = activeInteractions(mission).filter(i => i.step.id === step.id);
      if (!interaction) continue;
      const anchor = mission.def.anchors[interaction.trigger.anchor];
      Object.assign(player.transform, { x: anchor.x, z: anchor.z });
      expect(mission.interactStepInRange()?.id, `${level} ${step.id} input`).toBe(step.id);
      const entity = { archetype: 'prop', transform: { x: anchor.x, z: anchor.z } } as EntitySnapshot;
      expect(isRingedInteraction(mission, entity.transform), `${level} ${step.id} ring`).toBe(interaction.ring);
      expect(isMissionInteraction(world, entity), `${level} ${step.id} view`).toBe(interaction.ring);
      // Away from the anchor neither side reacts.
      Object.assign(player.transform, { x: anchor.x + 500, z: anchor.z + 500 });
      expect(mission.interactStepInRange()?.id === step.id, `${level} ${step.id} far input`).toBe(false);
      expect(isRingedInteraction(mission, { x: anchor.x + 500, z: anchor.z + 500 })).toBe(false);
      checked++;
    }
    if (['L2', 'L3', 'L4', 'L5'].includes(level)) expect(checked).toBeGreaterThan(0);
  } finally { world.dispose(); }
}, 120_000);

