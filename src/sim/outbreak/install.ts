import { installNpcSystems } from '../npc/install';
import type { SimWorld } from '../world/SimWorld';
import { Outbreak } from './Outbreak';
import { groveRefuges, populateGrove } from './Population';

export interface L1OutbreakSetup { tier?: 'high' | 'low'; civilians?: number }
/**
 * Lane E entry point for L1 v2 on D-GROVE: installs combat/infected/NPC systems if the composition did not
 * (D-GROVE is not a campaign `L1..L6` id yet), attaches the outbreak layer and populates the morning.
 * High tier: 60 pedestrians, low tier: 50 (section 5.1: 50-60); the infected cap is 60 / 30 (section 5.9).
 */
export function installL1Outbreak(world: SimWorld, setup: L1OutbreakSetup = {}): Outbreak {
  if (!world.infected || !world.npcs) installNpcSystems(world);
  for (const e of [...world.entities.iterate()]) if (e.civilian?.ambient || e.traffic) { world.entities.delete(e.id); world.spatial.delete(e.id); }
  world.npcs!.setAmbient(0);
  // Game.loadLevel applies the quality tier before the mission installs this layer: keep it unless told otherwise.
  const tier = setup.tier ?? world.infected!.director.tier;
  const outbreak = new Outbreak(world, { ...groveRefuges({ world }), tier });
  world.npcs!.civilians.outbreak = outbreak;
  populateGrove(outbreak, setup.civilians ?? (tier === 'low' ? 50 : 60));
  return outbreak;
}
