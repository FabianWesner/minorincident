import { combatArena } from './combat-arena';
import type { ScenarioDefinition } from '../../../src/levels/loader';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

/** Reproducible, isolated E15 photo spots. Every effect is a view of a typed sim event. */
export const vfxScenarios: Record<string, ScenarioDefinition> = Object.fromEntries(['vfx-stress', 'vfx-showcase', 'blood-probe', 'gore-probe'].map(name => [name, { ...combatArena, name }]));
export function installVfxScenario(world: SimWorld): void {
  if (!vfxScenarios[world.scenario ?? '']) return;
  if (world.scenario === 'gore-probe') { world.combat!.setLoadout(['weapon.machete'], ['weapon.grenade']); return; }
  const id = world.spawnDummy('infected.dummy', world.scenario === 'blood-probe' ? { x: -4, z: -4 } : { x: 3, z: 0 });
  const effect = (kind: Extract<import('../../../src/sim/world/types').GameEvent, { type: 'vfx.effect' }>['kind'], x: number, z: number, radius: number): void => {
    world.events.emit({ type: 'vfx.effect', tick: world.tick, kind, position: { x, z }, radius });
  };
  world.events.on('sim.tick', () => {
    if (world.scenario === 'blood-probe' && world.tick !== 1) return;
    if (world.scenario === 'vfx-stress' || world.tick === 1) world.events.emit({ type: 'combat.hit', tick: world.tick, attackId: world.tick, actionId: 'weapon.machete', sourceId: 1, targetId: id, position: { x: 3, y: 0.7, z: 0, yaw: 0 }, amount: 10 });
    if (world.scenario === 'vfx-stress' && world.tick % 15 === 0) effect('explosion', -3, 0, 3);
    if (world.scenario === 'vfx-showcase' && world.tick % 30 === 1) {
      for (const [kind, x, z, radius] of [['fire', -3, -2, 1], ['smoke', -3, -2, 2], ['toxic', 4, 3, 1], ['electric', 1, -3, 1], ['screamer', -4, 3, 2], ['objective', 4, -4, 1], ['pickup', 2, 3, 1], ['ash', 0, -4, 1]] as const) effect(kind, x, z, radius);
      world.events.emit({ type: 'telegraph', tick: world.tick, attackId: 100, kind: 'charge', position: { x: 0, z: -3 }, radius: 2, angle: 0 });
    }
  }, 6);
}
