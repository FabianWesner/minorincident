import { empty } from '../../tests/fixtures/scenarios/empty';

/** E01 data contract. Real campaign levels and progression arrive in E10/E12/E13. */
export interface ScenarioDefinition {
  name: string;
  ground: { width: number; depth: number };
  player: { x: number; y: number; z: number };
}
export function loadScenarioDefinition(name: string): ScenarioDefinition {
  if (name !== 'empty') throw new Error(`Unknown scenario: ${name}`);
  if (empty.ground.width <= 0 || empty.ground.depth <= 0 || !Object.values(empty.player).every(Number.isFinite)) throw new Error('Invalid empty scenario');
  return structuredClone(empty);
}
