import { lookdev } from '../../tests/fixtures/scenarios/lookdev';
import { empty } from '../../tests/fixtures/scenarios/empty';

/** E01 data contract. Real campaign levels and progression arrive in E10/E12/E13. */
export interface ScenarioDefinition {
  name: string;
  ground: { width: number; depth: number };
  player: { x: number; y: number; z: number };
}
export function loadScenarioDefinition(name: string): ScenarioDefinition {
  const definition = name === 'empty' ? empty : name === 'lookdev' ? lookdev : null;
  if (!definition) throw new Error(`Unknown scenario: ${name}`);
  if (definition.ground.width <= 0 || definition.ground.depth <= 0 || !Object.values(definition.player).every(Number.isFinite)) throw new Error(`Invalid ${name} scenario`);
  return structuredClone(definition);
}
