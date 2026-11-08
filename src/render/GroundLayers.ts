import type { Material } from 'three/webgpu';

/** Four depth-buffer units per ground layer, on both WebGPU and WebGL2.
 * Bias only ground overlays, never the base receiver or collision geometry. */
export const groundDepthUnits = 4;
export const maxBakedGroundLayer = 12;
export const groundLayers = { paving: 13, puddle: 14, footprint: 15, lightPool: 16 } as const;
export function groundDepth<T extends Material>(material: T, layer: number): T {
  if (!Number.isInteger(layer) || layer < 0) throw Error(`Invalid ground layer ${layer}`);
  material.userData.groundLayer = layer;
  material.polygonOffset = layer > 0;
  material.polygonOffsetFactor = 0;
  material.polygonOffsetUnits = -groundDepthUnits * layer;
  return material;
}
