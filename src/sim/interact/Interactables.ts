// Adapted from Bruno Simon folio-2025 InteractivePoints.js (MIT, 41046b5):
// nearest active point, range reveal and once-only callbacks; progression uses fixed ticks.
import type { InputFrame, Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
import type { NavGrid } from '../world/NavGrid';
import type { CoverWall } from '../combat/HitQuery';

export const deviceKinds = ['door', 'gate', 'generator', 'breaker', 'switch', 'lever', 'valve', 'button', 'radio', 'rescue', 'car-door'] as const;
export type DeviceKind = typeof deviceKinds[number];
const isDoor = (kind: DeviceKind) => kind === 'door' || kind === 'gate' || kind === 'car-door';
/** Serialized interaction component. Door cycles re-arm on exit, never while standing inside. */
export interface Interactable {
  kind: DeviceKind; radius: number; holdTime: number; instant: boolean; interruptOnDamage: boolean;
  progress: number; completed: boolean; enabled: boolean; hint: string; label: string;
  key: string | null; requires: string[]; open: boolean; barricaded: boolean;
  fuel: number; powered: boolean; interruptedAt: number; cycle: number;
}
export interface DeviceOptions {
  radius?: number; holdTime?: number; instant?: boolean; interruptOnDamage?: boolean;
  key?: string; requires?: string[]; fuel?: number; label?: string; halfX?: number; halfZ?: number;
}
/** Level-owned device logic and removable collider/nav integration; no renderer dependencies. */
export class Interactables {
  nav: NavGrid | null = null;
  activeId: number | null = null;
  readonly walls: CoverWall[] = [];
  private readonly authoredWalls = new Map<number, CoverWall>();
  private readonly blockers = new Map<number, { wall: CoverWall; handle: number }>();
  constructor(private readonly world: SimWorld) {
    world.events.on('player.damaged', (e) => {
      if (e.type !== 'player.damaged' || e.amount <= 0) return;
      const c = this.activeId === null ? null : world.entities.get(this.activeId)?.interactable;
      if (c?.interruptOnDamage && !c.completed) {
        c.progress = Math.floor((c.progress + 1e-9) * 4) / 4; c.interruptedAt = world.tick;
        world.events.emit({ type: 'interact.interrupted', tick: world.tick, id: this.activeId!, progress: c.progress });
      }
    });
  }
  spawn(kind: DeviceKind, pos: Vec2, opts: DeviceOptions = {}): number {
    if (!deviceKinds.includes(kind) || ![pos.x, pos.z, opts.radius ?? 1.5, opts.holdTime ?? .6, opts.fuel ?? 0, opts.halfX ?? .5, opts.halfZ ?? .15].every(Number.isFinite)
      || (opts.radius ?? 1.5) <= 0 || (opts.holdTime ?? .6) <= 0 || (opts.fuel ?? 0) < 0 || (opts.halfX ?? .5) <= 0 || (opts.halfZ ?? .15) <= 0) throw new RangeError('Invalid device');
    const entity = this.world.entities.create({ kind: 'device', archetype: `device.${kind}`, faction: 'environment', transform: { ...pos, y: .7, yaw: 0 }, health: { current: 100, max: 100 },
      interactable: { kind, radius: opts.radius ?? 1.5, holdTime: opts.holdTime ?? (kind === 'generator' ? 3 : .6), instant: opts.instant ?? true, interruptOnDamage: opts.interruptOnDamage ?? true,
        progress: 0, completed: false, enabled: true, hint: '', label: opts.label ?? kind, key: opts.key ?? null, requires: opts.requires ?? [], open: false, barricaded: false, fuel: opts.fuel ?? 0, powered: false, interruptedAt: -1, cycle: 0 } });
    this.world.spatial.set(entity.id, pos.x, pos.z);
    if (isDoor(kind)) this.block(entity.id, { ...pos, y: .7, halfX: opts.halfX ?? .5, halfY: .7, halfZ: opts.halfZ ?? .15 });
    return entity.id;
  }
  /** Inventory survives player respawn and is cleared by scenario unload. */
  giveItem(id: string): void {
    const p = this.world.entities.get(1)!; p.inventory ??= [];
    if (!p.inventory.includes(id)) p.inventory.push(id);
  }
  refuel(id: number, seconds: number): void {
    const c = this.world.entities.get(id)?.interactable;
    if (c?.kind !== 'generator' || !Number.isFinite(seconds) || seconds <= 0) throw new RangeError('Invalid refuel');
    c.fuel += seconds;
    if (!c.powered) { c.completed = false; c.progress = 0; }
  }
  /** E26 hook: a barricaded door cannot open until the brace is removed. */
  barricade(id: number, on: boolean): void {
    const c = this.world.entities.get(id)?.interactable;
    if (!c || !['door', 'gate'].includes(c.kind) || c.open) throw new Error('Door must be closed');
    c.barricaded = on;
  }
  block(id: number, wall: CoverWall): void {
    this.authoredWalls.set(id, wall);
    if (this.blockers.has(id)) return;
    const handle = this.world.physics.addBlocker(wall);
    this.blockers.set(id, { wall, handle }); this.walls.push(wall);
    this.nav?.block(id, wall);
    this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id, blocked: true, wall });
  }
  unblock(id: number): void {
    const b = this.blockers.get(id); if (!b) return;
    this.world.physics.removeBlocker(b.handle); this.walls.splice(this.walls.indexOf(b.wall), 1); this.blockers.delete(id); this.nav?.unblock(id);
    this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id, blocked: false, wall: b.wall });
  }
  /** E12 checkpoints and tier rebuilds reconcile collider/nav state with restored components. */
  rebuildBlockers(nav = this.nav, worldReset = false): void {
    for (const id of this.blockers.keys()) {
      if (!worldReset) this.unblock(id);
      else this.nav?.unblock(id);
    }
    this.blockers.clear(); this.walls.length = 0; this.nav = nav;
    for (const [id, wall] of this.authoredWalls) {
      const entity = this.world.entities.get(id);
      if (entity && entity.health.current > 0 && !entity.interactable?.open && !entity.destructible?.broken) this.block(id, wall);
    }
  }
  private complete(id: number): void {
    const entity = this.world.entities.get(id)!, c = entity.interactable!;
    c.completed = true; c.progress = 1; c.hint = '';
    if (isDoor(c.kind)) {
      c.open = !c.open;
      if (c.open) { const b = this.blockers.get(id); if (b) this.doorWalls.set(id, b.wall); this.unblock(id); }
      else this.block(id, this.doorWalls.get(id)!);
    } else if (c.kind === 'generator') c.powered = true;
    else c.powered = !c.powered;
    this.world.events.emit({ type: 'interact.completed', tick: this.world.tick, id, kind: c.kind, cycle: c.cycle });
  }
  private readonly doorWalls = new Map<number, CoverWall>();
  update(input: InputFrame): void {
    const p = this.world.entities.get(1)!;
    let nearest = Infinity; this.activeId = null;
    for (const e of this.world.entities.iterate()) {
      const c = e.interactable; if (!c) continue;
      if (c.powered && c.kind === 'generator') { c.fuel = Math.max(0, c.fuel - 1 / 60); if (c.fuel <= 1e-9) { c.fuel = 0; c.powered = false; c.completed = false; c.progress = 0; } }
      const distance = (e.transform.x - p.transform.x) ** 2 + (e.transform.z - p.transform.z) ** 2;
      if (c.completed && isDoor(c.kind) && distance > c.radius ** 2) { c.completed = false; c.progress = 0; c.cycle++; }
      if (this.world.vehicles?.active == null && p.health.current > 0 && c.enabled && !c.completed && distance <= c.radius ** 2 && distance < nearest) { nearest = distance; this.activeId = e.id; }
    }
    for (const e of this.world.entities.iterate()) {
      const c = e.interactable; if (!c || c.completed) continue;
      if (e.id !== this.activeId) { c.progress = Math.max(0, c.progress - 2 / (c.holdTime * 60)); continue; }
      if (!c.instant && (Math.hypot(input.move.x, input.move.z) > .05 || Math.hypot(p.survivor?.velocity.x ?? 0, p.survivor?.velocity.z ?? 0) > .1)) { c.progress = Math.max(0, c.progress - 2 / (c.holdTime * 60)); continue; }
      c.hint = c.barricaded ? 'barricaded' : c.key && !p.inventory?.includes(c.key) ? 'locked' : c.requires.some(id => !p.inventory?.includes(id)) ? 'missing item' : c.kind === 'generator' && c.fuel <= 0 ? 'fuel' : '';
      if (c.hint || c.interruptedAt === this.world.tick) continue;
      c.progress = input.interact && c.instant ? 1 : Math.min(1, c.progress + 1 / (c.holdTime * 60));
      if (c.progress >= 1 - 1e-9) this.complete(e.id);
    }
  }
}
