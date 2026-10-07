import type { Document } from '@gltf-transform/core';
import type { AssetDef } from '../../src/assets/types';

export function triangleCount(document: Document): number {
  return document.getRoot().listNodes().reduce((sum, node) => sum + (node.getMesh()?.listPrimitives().reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')!.getCount()) / 3, 0) ?? 0), 0);
}
/** Small hand-held objects have no distance tier; all other hero/side assets do. */
export function requiredLods(def: AssetDef, triangles: number): ('lod1' | 'lod2')[] {
  if (def.tier === 'distant') return [];
  if (/^(wpn|thr|pick)\./.test(def.id)) return triangles > 2000 ? ['lod1'] : [];
  return ['lod1', 'lod2'];
}

/** Tiny meshes cost less than aggressive decimation; retain their complete silhouette. */
export function lodTriangleLimit(triangles: number, lod: number, def?: AssetDef): number {
  const smallItem = def && (def.category === 'prop' && triangles <= 12000 || /^(wpn|thr|pick)\./.test(def.id) && triangles <= 6000);
  const articulatedFloor = def && (def.category === 'character' || def.category === 'infected') ? 4000 : 3000;
  return triangles <= 3000 || smallItem ? triangles : Math.max(articulatedFloor, Math.ceil(triangles * (lod === 1 ? .155 : .045)));
}

/** Source contracts from specs/03 §7 also apply while manifest registration is pending. */
export function semanticNodeNames(document: Document): string[] {
  const parts = /(?:^|_)(?:root|hip|torso|head|arm[LR]|foreArm[LR]|hand[LR]|leg[LR]|shin[LR]|foot[LR]|body|neck|jaw|tail|wing[LR]|leg[FB][LR]|paw[FB][LR]|wheel[FB][LR]|lightsFront|lightsBrake|driverSeat|exit[LR]|siren[LR]|ladder|grip|muzzle|tip|roof|interior)$/;
  return document.getRoot().listNodes().map(node => node.getName()).filter(name => name && !/_(?:pal|emi)_/.test(name) && (parts.test(name) || /^(?:door|window)[_:]/.test(name) || /socket/i.test(name)));
}
