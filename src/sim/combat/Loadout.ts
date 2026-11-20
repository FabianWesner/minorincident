import { weaponFallbackPriority, weaponKey, weaponLegacyKey } from '../../data/weaponKeys';
import { compareWeapons } from '../../data/weaponOrder';
import { action } from '../../data/actions/catalog';
import { ticks, type ActionDef, type Side } from '../../data/actions/schema';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
export interface ActionSlot { id: string; magazine: number; reserve: 'infinite'; charges: number; nextCharge: number; reloadUntil: number; readyAt: number; lastFuelUse?: number }
export interface SideState { rack: ActionSlot[]; index: number; aim: Vec2; aimPoint: Vec2 | null; swapUntil: number; unarmed?: ActionSlot }
export interface LoadoutState { corgiReady?: number; previous?: { side: Side; index: number; id: string }; selectedSide: Side; LEFT: SideState; RIGHT: SideState }
const slot = (id: string, resolve: (id:string)=>ActionDef): ActionSlot => { const def = resolve(id); return { id, magazine: def.magazine, reserve: 'infinite', charges: def.charges, nextCharge: 0, reloadUntil: 0, readyAt: 0 }; };
/** Rack timers belong to slots and survive cycling. Aim belongs to sides and survives cycling too. */
export class Loadout {
  readonly state: LoadoutState;
  constructor(left: string[], right: string[], readonly definition: (id:string)=>ActionDef = action, readonly capacity = 3) {
    for (const rack of [left, right]) if (rack.length < 1 || rack.length > this.capacity) throw new RangeError(`Racks require 1–${this.capacity} actions`);
    const side = (rack: string[]): SideState => ({ rack: rack.map(id=>slot(id,this.definition)), index: rack.findIndex(id => id !== 'ability.corgi-lure'), aim: { x: 1, z: 0 }, aimPoint: null, swapUntil: 0 });
    this.state = { selectedSide: 'LEFT', LEFT: side(left), RIGHT: side(right) };
  }
  /** Presentation order leaves slot storage, checkpoint indices and cooldowns intact. */
  orderedEntries(side: Side): { side: Side; index: number; id: string }[] {
    return this.state[side].rack.flatMap((slot, index) => slot.id === 'ability.corgi-lure' ? [] : [{ side, index, id: slot.id }]).sort((a, b) =>
      (weaponKey(a.id) ?? 99) - (weaponKey(b.id) ?? 99) || compareWeapons(a.id, b.id));
  }
  /** Ordered carried actions for mouse selection; kick is part of unarmed, not a slot. */
  activeEntries(): { side: Side; index: number; id: string }[] {
    const seen = new Set<string>();
    const entries = (['LEFT', 'RIGHT'] as const).flatMap(side => this.state[side].rack.flatMap((slot, index) => {
      if (slot.id === 'ability.corgi-lure') return [];
      const id = slot.id === 'weapon.kick' ? 'weapon.fists' : slot.id;
      if (seen.has(id)) return [];
      seen.add(id); return [{ side, index, id }];
    }));
    // Innate fists have no carried rack slot. The sentinel preserves campaign
    // arsenal/checkpoint invariants at the unarmed L10 crash start.
    if (!seen.has('weapon.fists') && !entries.some(entry => this.definition(entry.id).category === 'melee')) entries.push({ side: 'LEFT', index: -1, id: 'weapon.fists' });
    else if (entries.some(entry => entry.id !== 'weapon.fists' && this.definition(entry.id).category === 'melee')) {
      const fists = entries.findIndex(entry => entry.id === 'weapon.fists'); if (fists >= 0) entries.splice(fists, 1);
    }
    return entries.sort((a, b) => (weaponKey(a.id) ?? 99) - (weaponKey(b.id) ?? 99)
      || this.definition(b.id).tier - this.definition(a.id).tier || compareWeapons(a.id, b.id));
  }
  cycleActive(direction: number, tick: number, legacyOrder = false): void {
    const entries = this.activeEntries(), side = this.state.selectedSide, state = this.state[side];
    if (legacyOrder) entries.sort((a, b) => compareWeapons(a.id, b.id));
    if (!entries.length) return;
    const current = entries.findIndex(e => e.side === side && e.index === state.index);
    const next = entries[(current + direction + entries.length) % entries.length];
    if (next.side === side && next.index === state.index) return;
    this.state.selectedSide = next.side; this.state[next.side].index = next.index; this.state[next.side].swapUntil = tick + 15;
  }
  input(frame: InputFrame, tick: number): void {
    const beforeSide = this.state.selectedSide, beforeIndex = this.state[beforeSide].index;
    const beforeId = this.current(beforeSide).id;
    if (frame.selectorSide) this.state.selectedSide = frame.selectorSide;
    if (frame.left.down) this.state.selectedSide = 'LEFT';
    if (frame.right.down) this.state.selectedSide = 'RIGHT';
    const side = this.state[this.state.selectedSide], aim = frame.aim;
    if (aim && Math.hypot(aim.x, aim.z) > 0) {
      const length = Math.hypot(aim.x, aim.z); side.aim.x = aim.x / length; side.aim.z = aim.z / length;
      if (frame.aimPoint) { side.aimPoint ??= { x: 0, z: 0 }; side.aimPoint.x = frame.aimPoint.x; side.aimPoint.z = frame.aimPoint.z; }
      else side.aimPoint = null;
    }
    const legacyEntries = frame.selectedLegacyWeaponKey === undefined ? [] : (['LEFT', 'RIGHT'] as const).flatMap(name => this.state[name].rack.map((slot, index) => ({ side: name, index, id: slot.id })));
    const key = frame.selectedWeaponKey;
    let keyed: { side: Side; index: number; id: string } | undefined;
    if (frame.selectedLegacyWeaponKey === weaponLegacyKey('weapon.fists')) keyed = { side: 'LEFT', index: -1, id: 'weapon.fists' };
    else if (frame.selectedLegacyWeaponKey !== undefined) keyed = legacyEntries.find(entry => weaponLegacyKey(entry.id) === frame.selectedLegacyWeaponKey);
    else if (key !== undefined) {
      const matching = this.activeEntries().filter(entry => weaponKey(entry.id) === key)
        .sort((a, b) => this.definition(b.id).tier - this.definition(a.id).tier || compareWeapons(a.id, b.id));
      if (matching.length) {
        const current = matching.findIndex(entry => entry.side === beforeSide && entry.index === beforeIndex);
        keyed = matching[current >= 0 ? (current + 1) % matching.length : 0];
      }
    }
    const oldPosition = frame.selectedPositionWeaponKey === undefined ? undefined : this.activeEntries().sort((a, b) => compareWeapons(a.id, b.id))[frame.selectedPositionWeaponKey - 1];
    const sideEntries = frame.selectedSlot && frame.orderedSelection ? this.orderedEntries(frame.selectedSlot.side) : undefined;
    if (frame.legacyWeaponOrder) sideEntries?.sort((a, b) => compareWeapons(a.id, b.id));
    const activeEntries = frame.selectedActiveSlot === undefined ? undefined : this.activeEntries();
    if (frame.legacyWeaponOrder) activeEntries?.sort((a, b) => compareWeapons(a.id, b.id));
    const choice = keyed ?? oldPosition ?? (sideEntries && frame.selectedSlot ? sideEntries[frame.selectedSlot.index] : frame.selectedSlot) ?? (frame.selectedActiveSlot !== undefined && Number.isInteger(frame.selectedActiveSlot) && frame.selectedActiveSlot >= 0 ? activeEntries?.[frame.selectedActiveSlot] : undefined);
    if (choice) {
      const rack = this.state[choice.side];
      if (Number.isInteger(choice.index) && (choice.index >= 0 || choice.index === -1 && choice.side === 'LEFT') && choice.index < rack.rack.length && tick >= rack.swapUntil) {
        this.state.selectedSide = choice.side;
        if (rack.index !== choice.index) { rack.index = choice.index; rack.swapUntil = tick + 15; }
      }
    }
    if (frame.selectorActive && frame.selector) this.cycleActive(frame.selector, tick, frame.legacyWeaponOrder);
    else if (frame.selector && tick >= this.state[this.state.selectedSide].swapUntil) {
      const cycling = this.state[this.state.selectedSide];
      const entries = this.orderedEntries(this.state.selectedSide), current = entries.findIndex(e => e.index === cycling.index);
      if (frame.legacyWeaponOrder) { entries.sort((a, b) => compareWeapons(a.id, b.id)); }
      const position = frame.legacyWeaponOrder ? entries.findIndex(e => e.index === cycling.index) : current;
      if (entries.length) { cycling.index = entries[(position + frame.selector + entries.length) % entries.length].index; cycling.swapUntil = tick + 15; }
    }
    const selectedSide = this.state.selectedSide, selectedId = this.current(selectedSide).id;
    if (selectedId !== beforeId) this.state.previous = { side: beforeSide, index: beforeIndex, id: beforeId };
  }
  /** Return to the last selection only if that same slot is still usable. */
  returnToPrevious(tick: number): boolean {
    const previous = this.state.previous;
    if (!previous) return false;
    const state = this.state[previous.side];
    const slot = previous.index === -1 ? state.unarmed : state.rack[previous.index];
    if (!slot || slot.id !== previous.id || !this.hasAmmo(slot)) return false;
    delete this.state.previous;
    this.state.selectedSide = previous.side; state.index = previous.index; state.swapUntil = tick + 15;
    return true;
  }
  fallback(tick: number): void {
    if (this.returnToPrevious(tick)) return;
    const best = this.activeEntries().filter(e => weaponFallbackPriority(e.id) !== undefined && (e.index === -1 || this.hasAmmo(this.state[e.side].rack[e.index])))
      .sort((a, b) => weaponFallbackPriority(b.id)! - weaponFallbackPriority(a.id)!)[0] ?? { side: 'LEFT' as const, index: -1 };
    this.state.selectedSide = best.side; this.state[best.side].index = best.index; this.state[best.side].swapUntil = tick + 15;
    delete this.state.previous;
  }
  /** Adds an owned action to the rack; only throwable variants intentionally share key 0. */
  collect(side: Side, id: string, _retain = false): string | null {
    void _retain;
    const rack = this.state[side], next = slot(id,this.definition);
    const existing = rack.rack.findIndex(entry => entry.id === id);
    if (existing >= 0) {
      const current = rack.rack[existing], def = this.definition(id);
      current.charges = def.charges; current.magazine = def.magazine; current.nextCharge = 0; current.reloadUntil = 0;
      return null;
    }
    if (this.definition(id).category === 'throwable' && ['weapon.molotov', 'weapon.pipe-bomb'].includes(id)) {
      const throwable = rack.rack.findIndex(entry => this.definition(entry.id).category === 'throwable');
      if (throwable >= 0 && ['weapon.molotov', 'weapon.pipe-bomb'].includes(rack.rack[throwable].id)) { const previous = rack.rack[throwable].id; rack.rack[throwable] = next; return previous; }
    }
    rack.rack.push(next); return null;
  }
  current(side: Side): ActionSlot { const state = this.state[side]; return state.index === -1 ? state.unarmed ??= slot('weapon.fists', this.definition) : state.rack[state.index]; }
  /** Zero capacity means bottomless campaign ammo, not an exhausted magazine. */
  hasAmmo(slot: ActionSlot): boolean {
    const def = this.definition(slot.id);
    return (!def.magazine || slot.magazine >= 1) && (!def.charges || slot.charges > 0);
  }
  update(tick: number, switched: (side: Side, id: string) => void): void {
    for (const name of ['LEFT', 'RIGHT'] as const) {
      const side = this.state[name];
      if (side.swapUntil && tick >= side.swapUntil) { side.swapUntil = 0; switched(name, this.current(name).id); }
      for (const slot of side.unarmed ? [...side.rack, side.unarmed] : side.rack) {
        const def = this.definition(slot.id);
        // Fuel refills continuously whenever the stream is idle, including while holstered.
        if (slot.id === 'weapon.flamethrower' && tick - (slot.lastFuelUse ?? -Infinity) > ticks(1 / def.fireRate)) {
          slot.magazine = Math.min(def.magazine, slot.magazine + def.magazine / ticks(def.reloadTime));
          slot.reloadUntil = 0;
        }
        if (slot.reloadUntil && tick >= slot.reloadUntil) { slot.magazine = def.magazine; slot.reloadUntil = 0; }
        if (slot.nextCharge && tick >= slot.nextCharge) { slot.charges++; slot.nextCharge = slot.charges < def.charges ? tick + ticks(def.recharge) : 0; }
      }
    }
  }
  usable(side: Side, tick: number): boolean {
    const slot = this.current(side);
    return tick >= this.state[side].swapUntil && tick >= slot.readyAt && !slot.reloadUntil && this.hasAmmo(slot);
  }
  spend(side: Side, tick: number, def: ActionDef, infiniteCharges: boolean): void {
    const slot = this.current(side);
    slot.readyAt = tick + Math.max(ticks(def.cooldown), def.fireRate ? ticks(1 / def.fireRate) : 0, ticks(def.windup + def.active + def.recovery));
    if (def.magazine) {
      slot.magazine = Math.max(0, slot.magazine - 1);
      if (def.id === 'weapon.flamethrower') slot.lastFuelUse = tick;
      else if (slot.magazine === 0) slot.reloadUntil = tick + ticks(def.reloadTime);
    }
    if (def.charges && !infiniteCharges) {
      slot.charges--; if (!slot.nextCharge) slot.nextCharge = tick + ticks(def.recharge);
    }
    // PO 2026-11-20: a weapon that recovers by itself stays in hand — recharging throwables ("!" until a charge is back),
    // flamethrower fuel (refills when idle; "it flips back to the previous weapon. Super annoying") and reloading magazines.
    const recovers = !!(def.charges && slot.nextCharge) || def.id === 'weapon.flamethrower' || slot.reloadUntil > 0;
    if (!this.hasAmmo(slot) && this.state.selectedSide === side && !recovers) this.fallback(tick);
  }
}
