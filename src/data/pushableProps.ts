import records from './physicsAssets.json';
import type { Aabb } from '../levels/districts/types';
/** Authored GLB ss_physics, baked by tools/assets/physics-metadata.ts during layout builds.
 * No renderer or asynchronous asset load participates in deterministic simulation. */
export interface PhysicsAsset {
  class: 'light' | 'medium' | 'heavy' | 'fixed'; mass: number;
  friction?: number; restitution?: number; centerOfMass?: number[];
  pushable?: boolean; kickable?: boolean; barricadeValue?: number; barricadeHP?: number;
  breakable?: { hp: number; debrisSet?: string }; flammable?: boolean; burnTime?: number;
  explosive?: unknown; sounds?: string; reset?: 'remove' | 'spawn';
  boxes: Aabb[]; source: string; hash: string;
}
export const physicsAssets = records as unknown as Readonly<Record<string, PhysicsAsset>>;
/** Only movable environment props enter Rapier; vehicles, pickups and fixed objects retain their own systems. */
export const pushableProps: Readonly<Record<string, PhysicsAsset>> = Object.fromEntries(Object.entries(physicsAssets)
  .filter(([id, p]) => (id.startsWith('prop.') || id.startsWith('haz.')) && p.pushable && p.class !== 'fixed' && p.mass > 0 && p.boxes.length));
