/** Anything with named children (a loaded GLB root); structural so the WebGL/WebGPU and plain three.js builds both fit. */
interface Named { getObjectByName(name: string): { position: { y: number }; userData: Record<string, unknown> } | undefined }

/**
 * The authored sectional leaves of the fire-station bays are raised, so the bays expose a real aperture (not a dark overlay on a
 * closed door). Used by the district renderer and by Scene Lab's clipping geometry, so both see the same open bays.
 */
export function openFireStationBays(assetId: string, root: Named): void {
  if (assetId !== 'bld.fire-station') return;
  for (const name of ['door_bay_L', 'door_bay_R']) {
    const leaf = root.getObjectByName(name);
    if (leaf) leaf.position.y += Number(leaf.userData.travel ?? 3.15);
  }
}
