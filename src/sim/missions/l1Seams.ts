import type { SimWorld } from '../world/SimWorld';

/**
 * Optional interfaces of the L1 v2 systems that other lanes own (F: bicycle and toys, D: outbreak overlay).
 * The mission only needs them to snapshot/restore through checkpoints and to infect the technician in place;
 * every member is optional, so the mission runs with any of them missing (mocks in tests, absent before the merge).
 * Lanes attach their object to the world under these names (`world.bicycle`, `world.toys`, `world.outbreak`).
 */
export interface SnapshotSeam {
  /** Serializable state, structured-cloneable; called when a checkpoint is captured. */
  snapshot(): unknown;
  /** Restores a value returned by `snapshot`; called after the entity restore of a checkpoint. */
  restore(snapshot: unknown): void;
}
export interface OutbreakSeam extends SnapshotSeam {
  /** Turns a living civilian entity into an infected one in place (same entity id, model, tint, accessories). */
  infect?(entityId: number, options?: { tier?: 'frail' | 'average' | 'athletic'; instant?: boolean }): boolean;
}
export interface L1Seams { bicycle?: SnapshotSeam; toys?: SnapshotSeam; outbreak?: OutbreakSeam }

const names = ['bicycle', 'toys', 'outbreak'] as const;
export function l1Seams(world: SimWorld): L1Seams { return world as unknown as L1Seams; }
export function captureSeams(world: SimWorld): Record<string, unknown> {
  const seams = l1Seams(world), out: Record<string, unknown> = {};
  for (const name of names) if (seams[name]) out[name] = structuredClone(seams[name]!.snapshot());
  return out;
}
export function restoreSeams(world: SimWorld, saved: Record<string, unknown> | undefined): void {
  const seams = l1Seams(world);
  for (const name of names) if (seams[name] && saved && name in saved) seams[name]!.restore(structuredClone(saved[name]));
}
