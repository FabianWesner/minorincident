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

const names = ['bicycle', 'toys', 'outbreak', 'props', 'chunks', 'l7Encounters', 'l8', 'l9', 'megaPursuit', 'mountedGun'] as const;
/** The real outbreak layer (lane D) is `world.npcs.civilians.outbreak`; its state is snapshot()/load(). */
function resolve(world: SimWorld, name: typeof names[number]): SnapshotSeam | undefined {
  if (name === 'chunks') return world.chunks ?? undefined;
  if (name === 'l9') return world.missions?.l9 ?? undefined;
  if (name === 'l8') return world.missions?.l8 ?? undefined;
  if (name === 'l7Encounters') return world.l7Encounters ?? undefined;
  if (name === 'megaPursuit') return world.megaPursuit ?? undefined;
  if (name === 'mountedGun') return world.mountedGun ?? undefined;
  if (name === 'props') return world.props ?? undefined;
  if (name === 'outbreak') { const o = world.npcs?.civilians.outbreak; return o ? { snapshot: () => o.snapshot(), restore: s => o.load(s as ReturnType<typeof o.snapshot>) } : undefined; }
  // Real lane objects (e.g. world.toys) without snapshot() are persisted through entities; only duck-typed seams count here.
  const seam = l1Seams(world)[name as Exclude<typeof name, 'props' | 'chunks' | 'l7Encounters' | 'l8' | 'l9' | 'megaPursuit' | 'mountedGun'>];
  return typeof seam?.snapshot === 'function' ? seam : undefined;
}
export function l1Seams(world: SimWorld): L1Seams { return world as unknown as L1Seams; }
export function captureSeams(world: SimWorld): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of names) { const seam = resolve(world, name); if (seam) out[name] = structuredClone(seam.snapshot()); }
  return out;
}
/** Live save resume retains the Mega position; checkpoint retries apply its respawn fairness gap. */
export function restoreSeams(world: SimWorld, saved: Record<string, unknown> | undefined, respawn = true): void {
  for (const name of names) {
    const seam = resolve(world, name);
    if (!seam || !saved || !(name in saved)) continue;
    const snapshot = structuredClone(saved[name]);
    if (name === 'megaPursuit') world.megaPursuit!.restore(snapshot, respawn);
    else seam.restore(snapshot);
  }
}
