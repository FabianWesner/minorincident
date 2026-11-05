/**
 * Authored rotation nodes of the L10 dispersal kit (Blender owners; each node becomes its own splitDoors batch so the
 * placement keeps its shared material and LOD). `axis` is in the node's frame (glTF Y up); rates are rad/s idle and
 * while the dispersal runs. One shared angle drives every placement (DistrictView.updateSpin).
 */
export interface SpinNode { node: string; axis: 'x' | 'y' | 'z'; idle: number; active: number }
export const spinNodes: Record<string, SpinNode[]> = {
  'kit.dispersal-fan-housing': [{ node: 'fanRotor', axis: 'x', idle: 0.9, active: 7 }],
  'kit.dispersal-turbine-hall': [{ node: 'turbineRotor', axis: 'x', idle: 0.7, active: 9 }],
  'kit.dispersal-pipe-tee': [{ node: 'valveWheel', axis: 'y', idle: 0, active: 0.8 }],
};
