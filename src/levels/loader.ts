import { infectedScenarios } from '../../tests/fixtures/scenarios/infected';
import { combatArena } from '../../tests/fixtures/scenarios/combat-arena';
import { survivorScenarios } from '../../tests/fixtures/scenarios/survivor';
import { lookdev } from '../../tests/fixtures/scenarios/lookdev';
import { empty } from '../../tests/fixtures/scenarios/empty';

/** E01 data contract. Real campaign levels and progression arrive in E10/E12/E13. */
export interface ScenarioDefinition {
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
  const definition = name === 'combat-arena' ? combatArena : name === 'empty' ? empty : name === 'lookdev' ? lookdev : survivorScenarios[name] ?? infectedScenarios[name] ?? null;
  if (!definition) throw new Error(`Unknown scenario: ${name}`);
  if (definition.ground.width <= 0 || definition.ground.depth <= 0 || !Object.values(definition.player).every(Number.isFinite)) throw new Error(`Invalid ${name} scenario`);
  return structuredClone(definition);
}
