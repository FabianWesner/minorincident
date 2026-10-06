import { action } from '../../data/actions/catalog';
import { ticks, type ActionDef, type Side } from '../../data/actions/schema';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
export interface ActionSlot { id: string; magazine: number; reserve: 'infinite'; charges: number; nextCharge: number; reloadUntil: number; readyAt: number }
export interface SideState { rack: ActionSlot[]; index: number; aim: Vec2; aimPoint: Vec2 | null; swapUntil: number }
export interface LoadoutState { selectedSide: Side; LEFT: SideState; RIGHT: SideState }
const slot = (id: string, resolve: (id:string)=>ActionDef): ActionSlot => { const def = resolve(id); return { id, magazine: def.magazine, reserve: 'infinite', charges: def.charges, nextCharge: 0, reloadUntil: 0, readyAt: 0 }; };
/** Rack timers belong to slots and survive cycling. Aim belongs to sides and survives cycling too. */
export class Loadout {
  readonly state: LoadoutState;
  constructor(left: string[], right: string[], readonly definition: (id:string)=>ActionDef = action, readonly capacity = 3) {
    for (const rack of [left, right]) if (rack.length < 1 || rack.length > this.capacity) throw new RangeError(`Racks require 1–${this.capacity} actions`);
    const side = (rack: string[]): SideState => ({ rack: rack.map(id=>slot(id,this.definition)), index: 0, aim: { x: 1, z: 0 }, aimPoint: null, swapUntil: 0 });
    this.state = { selectedSide: 'LEFT', LEFT: side(left), RIGHT: side(right) };
  }
  /** Ordered carried actions for mouse selection; kick is part of unarmed, not a slot. */
  activeEntries(): { side: Side; index: number; id: string }[] {
    const seen = new Set<string>();
    return (['LEFT', 'RIGHT'] as const).flatMap(side => this.state[side].rack.flatMap((slot, index) => {
      const id = slot.id === 'weapon.kick' ? 'weapon.fists' : slot.id;
      if (seen.has(id)) return [];
      seen.add(id); return [{ side, index, id }];
    }));
  }
  cycleActive(direction: number, tick: number): void {
    const entries = this.activeEntries(), side = this.state.selectedSide, state = this.state[side];
    if (!entries.length || tick < state.swapUntil) return;
    const current = entries.findIndex(e => e.side === side && e.index === state.index);
    const next = entries[(current + direction + entries.length) % entries.length];
    this.state.selectedSide = next.side; this.state[next.side].index = next.index; this.state[next.side].swapUntil = tick + 15;
  }
  input(frame: InputFrame, tick: number): void {
    if (frame.selectorSide) this.state.selectedSide = frame.selectorSide;
    if (frame.left.down) this.state.selectedSide = 'LEFT';
    if (frame.right.down) this.state.selectedSide = 'RIGHT';
    const side = this.state[this.state.selectedSide], aim = frame.aim;
    if (aim && Math.hypot(aim.x, aim.z) > 0) {
      const length = Math.hypot(aim.x, aim.z); side.aim.x = aim.x / length; side.aim.z = aim.z / length;
      if (frame.aimPoint) { side.aimPoint ??= { x: 0, z: 0 }; side.aimPoint.x = frame.aimPoint.x; side.aimPoint.z = frame.aimPoint.z; }
      else side.aimPoint = null;
    }
    if (frame.selectedSlot) {
      const choice = frame.selectedSlot, rack = this.state[choice.side];
      if (Number.isInteger(choice.index) && choice.index >= 0 && choice.index < rack.rack.length && tick >= rack.swapUntil) {
        this.state.selectedSide = choice.side;
        if (rack.index !== choice.index) { rack.index = choice.index; rack.swapUntil = tick + 15; }
      }
    }
    if (frame.selectorActive && frame.selector) this.cycleActive(frame.selector, tick);
    else if (frame.selector && tick >= side.swapUntil) {
      side.index = (side.index + frame.selector + side.rack.length) % side.rack.length; side.swapUntil = tick + 15;
    }
  }
  /** Adds to selected rack; full racks replace exactly the current slot. */
  collect(side: Side, id: string): string | null {
    const rack = this.state[side], next = slot(id,this.definition);
    if (rack.rack.length < this.capacity) { rack.rack.push(next); return null; }
    const previous = rack.rack[rack.index].id; rack.rack[rack.index] = next; return previous;
  }
  current(side: Side): ActionSlot { const state = this.state[side]; return state.rack[state.index]; }
  update(tick: number, switched: (side: Side, id: string) => void): void {
    for (const name of ['LEFT', 'RIGHT'] as const) {
      const side = this.state[name];
      if (side.swapUntil && tick >= side.swapUntil) { side.swapUntil = 0; switched(name, this.current(name).id); }
      for (const slot of side.rack) {
        const def = this.definition(slot.id);
        if (slot.reloadUntil && tick >= slot.reloadUntil) { slot.magazine = def.magazine; slot.reloadUntil = 0; }
        if (slot.nextCharge && tick >= slot.nextCharge) { slot.charges++; slot.nextCharge = slot.charges < def.charges ? tick + ticks(def.recharge) : 0; }
      }
    }
  }
  usable(side: Side, tick: number): boolean {
    const slot = this.current(side), def = this.definition(slot.id);
    return tick >= this.state[side].swapUntil && tick >= slot.readyAt && !slot.reloadUntil && (!def.charges || slot.charges > 0);
  }
  spend(side: Side, tick: number, def: ActionDef, infiniteCharges: boolean): void {
    const slot = this.current(side);
    slot.readyAt = tick + Math.max(ticks(def.cooldown), def.fireRate ? ticks(1 / def.fireRate) : 0, ticks(def.windup + def.active + def.recovery));
    if (def.magazine && --slot.magazine === 0) slot.reloadUntil = tick + ticks(def.reloadTime);
    if (def.charges && !infiniteCharges) { slot.charges--; if (!slot.nextCharge) slot.nextCharge = tick + ticks(def.recharge); }
  }
}
