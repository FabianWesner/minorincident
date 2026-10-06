import { infectedScenarios } from '../../tests/fixtures/scenarios/infected';
import { combatArena } from '../../tests/fixtures/scenarios/combat-arena';
import { survivorScenarios } from '../../tests/fixtures/scenarios/survivor';
import { lookdev } from '../../tests/fixtures/scenarios/lookdev';
import { empty } from '../../tests/fixtures/scenarios/empty';
import { interactYard } from '../../tests/fixtures/scenarios/interact-yard';
import type { DeviceKind, DeviceOptions } from '../sim/interact/Interactables';
import type { HazardKind, DestructibleKind, HazardOptions } from '../sim/interact/Hazards';
import type { PickupKind } from '../sim/interact/Pickups';
/** Authored E11 placements; shared by scenarios and district gameplay overrides. */
export interface InteractionPlacements {
  devices?: { kind: DeviceKind; position: { x: number; z: number }; options?: DeviceOptions }[];
  hazards?: { kind: HazardKind | DestructibleKind; position: { x: number; z: number }; options?: HazardOptions }[];
  pickups?: { kind: PickupKind; position: { x: number; z: number }; item?: string }[];
}

/** E01 data contract. Real campaign levels and progression arrive in E10/E12/E13. */
export interface ScenarioDefinition extends InteractionPlacements {
  name: string;
  survivor?: boolean;
  combat?: boolean;
  infected?: boolean;
  navigation?: import('../sim/ai/DistrictNavigation').NavDistrict[];
  perches?: { x: number; z: number; y: number }[];
  walls?: { x: number; y: number; z: number; halfX: number; halfY: number; halfZ: number }[];
  ground: { width: number; depth: number; center?: { x: number; z: number } };
  player: { x: number; y: number; z: number };
}
export function loadScenarioDefinition(name: string): ScenarioDefinition {
  const definition = name === 'interact-yard' ? interactYard : name === 'mission-sandbox' ? { ...combatArena, name } : name === 'combat-arena' ? combatArena : name === 'empty' ? empty : name === 'lookdev' ? lookdev : survivorScenarios[name] ?? infectedScenarios[name] ?? null;
  if (!definition) throw new Error(`Unknown scenario: ${name}`);
  if (definition.ground.width <= 0 || definition.ground.depth <= 0 || !Object.values(definition.player).every(Number.isFinite)) throw new Error(`Invalid ${name} scenario`);
  return structuredClone(definition);
}
