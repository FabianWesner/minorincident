import { cure } from './district';
import type { CureRegion } from './alphaContracts';
import type { Point } from '../districts/types';

/** R1–R6 resident peaks, authored along the road rather than in response to arsenal changes.
 * Low quality thins only ordinary humans. Dogs and regular Alpha encounters keep their mechanics/counts.
 * Checkpoint forecourts and the service/motor-pool roads remain clear of authored groups. */
export interface CureEncounter {
  id: string; region: CureRegion; at: Point; regular: readonly [number, number]; dogs: number; alphas: number; tough?: number;
}
export const cureEncounters: readonly CureEncounter[] = [
  { id: 'crash-singletons', region: 'crash-outskirts', at: [592, -8], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'crash-bend', region: 'crash-outskirts', at: [652, 33], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'crash-pair', region: 'crash-outskirts', at: [712, 33], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'fringe-patrol', region: 'residential-fringe', at: [862, 80], regular: [6, 4], dogs: 2, alphas: 0 },
  { id: 'fringe-hedges', region: 'residential-fringe', at: [982, 80], regular: [6, 4], dogs: 0, alphas: 0 },
  { id: 'fringe-exit', region: 'residential-fringe', at: [1132, 25], regular: [6, 4], dogs: 0, alphas: 0 },
  { id: 'depot-workers', region: 'industrial-area', at: [1372, 100], regular: [11, 7], dogs: 2, alphas: 0, tough: 2 },
  { id: 'depot-alpha', region: 'industrial-area', at: [1517, 100], regular: [11, 7], dogs: 1, alphas: 1, tough: 2 },
  { id: 'depot-exit', region: 'industrial-area', at: [1682, 100], regular: [11, 7], dogs: 0, alphas: 0, tough: 2 },
  { id: 'military-breach', region: 'military-zone', at: [2012, -75], regular: [18, 11], dogs: 2, alphas: 1 },
  { id: 'military-column', region: 'military-zone', at: [2137, -75], regular: [18, 11], dogs: 1, alphas: 0 },
  { id: 'military-exit', region: 'military-zone', at: [2252, -75], regular: [18, 11], dogs: 0, alphas: 1 },
  { id: 'research-approach', region: 'research-campus', at: [2617, 45], regular: [22, 14], dogs: 2, alphas: 1 },
  { id: 'research-lab', region: 'research-campus', at: [2682, 45], regular: [22, 14], dogs: 0, alphas: 0 },
  { id: 'research-quarantine', region: 'research-campus', at: [2857, -5], regular: [22, 14], dogs: 2, alphas: 1 },
  { id: 'corridor-line', region: 'destroyed-corridor', at: [3217, 95], regular: [32, 20], dogs: 2, alphas: 1 },
  { id: 'corridor-breach', region: 'destroyed-corridor', at: [3317, 95], regular: [32, 20], dogs: 2, alphas: 1 },
  { id: 'corridor-exit', region: 'destroyed-corridor', at: [3417, 95], regular: [32, 20], dogs: 1, alphas: 1 },
];
export const cureMedkits = [
  { id: 'crash-approach', at: [732, 29] as Point },
  ...['police-medkit', 'industrial-medkit', 'military-medkit', 'research-medkit', 'corridor-medkit'].map(id => ({ id, at: cure.anchors[id] })),
  { id: 'fringe-detour', at: [937, 76] as Point },
  { id: 'industrial-service', at: [1517, -55] as Point },
  { id: 'military-motor-pool', at: [2137, 110] as Point },
];

/** Stable slots allow a full cap/blocked cell to defer individual members without losing or duplicating a group. */
export function cureEncounterSlots(group: CureEncounter, tier: 'high' | 'low') {
  const regular = group.regular[tier === 'high' ? 0 : 1];
  const roles = [...Array.from({ length: regular }, (_, i) => i < (group.tough ?? 0) ? 'infected.firefighter' : 'infected.runner'),
    ...Array<string>(group.dogs).fill('infected.dog'), ...Array<string>(group.alphas).fill('infected.alpha')];
  const indices = new Map<string, number>();
  return roles.map((archetype, i) => {
    const index = indices.get(archetype) ?? 0; indices.set(archetype, index + 1);
    return { key: `${group.id}:${archetype}:${index}`, archetype,
      x: group.at[0] + (i % 5 - 2) * 2.2, z: group.at[1] + (Math.floor(i / 5) - 2) * 2.2 };
  });
}
