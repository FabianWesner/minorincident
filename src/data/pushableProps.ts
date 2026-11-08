import records from './physicsAssets';
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
/** Vehicle impacts move freestanding props, including parked/wrecked vehicles and
 * heavy furniture whose old pushable flag only allowed on-foot pushing. Authored
 * fixed fixtures and concrete barrier walls remain part of the static world.
 * Driven vehicles are spawned separately by Vehicles, never from this table. */
export const movableProps: Readonly<Record<string, PhysicsAsset>> = Object.fromEntries(Object.entries(physicsAssets)
  .filter(([id, p]) => (id.startsWith('prop.') || id.startsWith('haz.') || id.startsWith('veh.')) && id !== 'prop.jersey-barrier' && p.class !== 'fixed' && p.mass > 0 && p.boxes.length));

/** Existing district layout/clearance contract. Additional movable classes opt in per placement. */
export const pushableProps: Readonly<Record<string, PhysicsAsset>> = Object.fromEntries(Object.entries(physicsAssets)
  .filter(([id, p]) => (id.startsWith('prop.') || id.startsWith('haz.')) && p.pushable && p.class !== 'fixed' && p.mass > 0 && p.boxes.length));
