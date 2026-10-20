import type { SimWorld } from '../world/SimWorld';
import { placedLights } from '../../data/placedLights';
import type { DistrictWorld } from '../world/DistrictWorld';
import { timeOfDay } from '../../data/timeOfDay';

export type LightPowerEvent =
  | { type: 'power.on' | 'power.off'; tick: number; group: string }
  | { type: 'light.broken'; tick: number; id: string; entityId: number };
export interface LampState {
  id: string; group: string; x: number; y: number; z: number; range: number;
  breakable: boolean; broken: boolean; powered: boolean; startedAt: number;
  entityId?: number;
  index: number; available: boolean; authoredPower: boolean;
}
/** Fixed-tick power/startup state shared by emissives, pools, beams and AI.
 * Visual quality never changes this state. Broken lamps stay broken on restart. */
export class LightPower {
  readonly lamps = new Map<string, LampState>();
  /** Render-only dressing lights: authored power only, no lamp entity, never in infected sight. */
  private readonly decor = new Map<string, string>();
  private readonly decorOff = new Set<string>();
  private readonly byEntity = new Map<number, LampState>();
  private readonly generators = new Map<number, string>();
  private nextIndex = 0;
  private weatherRevision = 0;
  revision = 0;
  constructor(private readonly world: SimWorld) {
    world.events.on('interact.completed', event => {
      if (event.type !== 'interact.completed') return;
      const device = world.entities.get(event.id)?.interactable;
      if (!device?.powerGroup) return;
      if (device.kind === 'generator' && device.powered) this.generators.set(event.id, device.powerGroup);
      this.setGroup(device.powerGroup, device.powered);
    });
    world.events.on('combat.hit', event => {
      if (event.type !== 'combat.hit' || event.damageType !== 'bullet' || event.amount <= 0) return;
      const lamp = this.byEntity.get(event.targetId);
      if (!lamp || !lamp.breakable || lamp.broken) return;
      lamp.broken = true; this.revision++;
      world.events.emit({ type: 'light.broken', tick: world.tick, id: lamp.id, entityId: event.targetId });
      world.events.emit({ type: 'vfx.effect', tick: world.tick, kind: 'electric', position: { x: lamp.x, y: lamp.y, z: lamp.z }, radius: .5 });
    });
    world.events.on('checkpoint.restored', () => this.rebind());
  }
  register(def: Omit<LampState, 'broken' | 'powered' | 'startedAt' | 'entityId' | 'index' | 'available' | 'authoredPower'>, powered: boolean): LampState {
    const existing = this.lamps.get(def.id);
    if (existing) return existing;
    const lamp: LampState = { ...def, broken: false, powered, authoredPower: powered, startedAt: -1, index: this.nextIndex++, available: true };
    {
      const entity = this.world.entities.createAuxiliary({ kind: 'light', archetype: 'light.anchor', faction: 'environment',
        transform: { x: def.x, y: def.y, z: def.z, yaw: 0 }, health: { current: 1, max: 1 },
        ...(def.breakable ? { combat: { radius: .45, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } } : {}) });
      lamp.entityId = entity.id; entity.light = lamp; this.byEntity.set(entity.id, lamp); this.world.spatial.set(entity.id, def.x, def.z);
    }
    this.lamps.set(def.id, lamp); this.revision++;
    return lamp;
  }
  /** Tier changes retain shot-out lamps and generator overrides when authored power is unchanged. */
  install(districts: DistrictWorld): void {
    this.rebind();
    for (const lamp of this.lamps.values()) lamp.available = false;
    this.decor.clear(); this.decorOff.clear();
    for (const source of placedLights(districts)) {
      if (source.decor) { this.decor.set(source.id, source.group); if (!source.on) this.decorOff.add(source.group); continue; }
      const [x, y, z] = source.position;
      const lamp = this.register({ id: source.id, group: source.group, x, y, z, range: source.anchor.range, breakable: source.anchor.breakable }, source.on);
      lamp.available = true;
      if (lamp.authoredPower !== source.on) { lamp.powered = source.on; lamp.startedAt = -1; lamp.authoredPower = source.on; }
    }
    for (const lamp of this.lamps.values()) {
      const entity = this.world.entities.get(lamp.entityId!);
      if (entity) entity.health.current = lamp.available && !lamp.broken ? 1 : 0;
    }
    this.revision++;
  }
  /** Plain lamp components are captured by the existing entity checkpoint path. */
  private rebind(): void {
    this.lamps.clear(); this.byEntity.clear(); this.generators.clear(); this.nextIndex = 0;
    for (const entity of this.world.entities.iterate()) {
      if (entity.light) { this.lamps.set(entity.light.id, entity.light); this.byEntity.set(entity.id, entity.light); this.nextIndex = Math.max(this.nextIndex, entity.light.index + 1); }
      if (entity.interactable?.kind === 'generator' && entity.interactable.powered && entity.interactable.powerGroup) this.generators.set(entity.id, entity.interactable.powerGroup);
    }
    this.revision++;
  }
  setGroup(group: string, powered: boolean, startup = true): void {
    let changed = false;
    for (const lamp of this.lamps.values()) if (lamp.group === group && lamp.powered !== powered) {
      lamp.powered = powered; lamp.startedAt = powered && startup ? this.world.tick : -1; changed = true;
    }
    if (!changed) return;
    this.revision++;
    this.world.events.emit({ type: powered ? 'power.on' : 'power.off', tick: this.world.tick, group });
  }
  isOn(id: string): boolean {
    const decor = this.decor.get(id);
    if (decor !== undefined) return !this.decorOff.has(decor);
    const lamp = this.lamps.get(id);
    if (!lamp || !lamp.available || !lamp.powered || lamp.broken) return false;
    if (lamp.startedAt < 0) return true;
    const age = this.world.tick - lamp.startedAt;
    return age >= 60 || (age >= 18 && age < 36);
  }
  /** Generator fuel expiry uses the same shutdown as a breaker or scripted group. */
  update(): void {
    const revision = this.world.weather?.powerRevision ?? 0;
    if (revision !== this.weatherRevision) {
      this.weatherRevision = revision;
      const sources = this.world.districts ? placedLights(this.world.districts) : [];
      for (const group of new Set([...this.lamps.values()].map(lamp => lamp.group))) this.setGroup(group, sources.some(source => source.group === group && source.on), false);
    }
    for (const [id, group] of this.generators) if (!this.world.entities.get(id)?.interactable?.powered) {
      this.generators.delete(id); this.setGroup(group, false);
    }
  }
  get night(): boolean {
    const preset = this.world.missions?.state.timeOfDay ?? this.world.districts?.composition.timeOfDay;
    // E23 is sunset: its strong practical blend adds firelight while the sun is still up.
    // It must not shorten sight to the full-night 9.6 m range.
    return !!preset && preset !== 'L5' && (timeOfDay[preset].practical ?? 0) > .5;
  }
  /** perf-w6: every infected asks about the same courier position each tick. Lamp state only changes with `revision`
   * (power, breakage, install, checkpoint rebind) and the tick (startup flicker), so one answer per tick, spot and revision. */
  private readonly sight = { tick: -1, revision: -1, x: NaN, z: NaN, value: 1 };
  sightMultiplier(target: { x: number; z: number }, night = this.night): number {
    if (!night) return 1;
    const memo = this.sight;
    if (memo.tick === this.world.tick && memo.revision === this.revision && memo.x === target.x && memo.z === target.z) return memo.value;
    let value = .6;
    for (const lamp of this.lamps.values()) if (this.isOn(lamp.id) && Math.hypot(target.x - lamp.x, target.z - lamp.z) <= lamp.range) { value = 1; break; }
    memo.tick = this.world.tick; memo.revision = this.revision; memo.x = target.x; memo.z = target.z; memo.value = value;
    return value;
  }
}
