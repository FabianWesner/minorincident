import type { DistrictLayout } from './types';
import { inside } from './validate';

/** PO 2026-10-13 "Flowers growing on stone": baked micro-dressing (daisies) may only stand on soil. Ground-level decorations
 * keep grass (lawns, beds) and wood (planter boxes, whose daisies sit inside the box); paths, paving, roads, gravel and metal
 * reject them. Raised decorations (y > 5 cm) were placed on a planter or bed top by the author and are kept. */
export const soilSurfaces: ReadonlySet<string> = new Set(['grass', 'wood']);
const raised = .05;

type Layout = Pick<DistrictLayout, 'surfaces'>;
type Decoration = { kind: string; position: readonly number[] };

/** Layout surface under a district-local point; later polygons are painted over earlier ones (the district-wide base first). */
export function surfaceUnder(layout: Layout, x: number, z: number): string | null {
  let found: string | null = null;
  for (const s of layout.surfaces) if (inside([x, z], s.polygon)) found = s.surface;
  return found;
}

export function decorationAllowed(layout: Layout, d: Decoration): boolean {
  if (d.position[1] > raised) return true;
  const surface = surfaceUnder(layout, d.position[0], d.position[2]);
  return surface === null || soilSurfaces.has(surface);
}

/** The decorations the game actually shows (render) and uses (gardeners, planter boxes). */
export function soilDecorations<T extends Decoration>(layout: Layout & { decorations?: readonly T[] }): T[] {
  return (layout.decorations ?? []).filter(d => decorationAllowed(layout, d));
}

/** Decorations a layout bakes on a surface that rejects them (validator and render filter). */
export function strayDecorations<T extends Decoration>(layout: Layout & { decorations?: readonly T[] }): T[] {
  return (layout.decorations ?? []).filter(d => !decorationAllowed(layout, d));
}
