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
  constructor(left: string[], right: string[], readonly definition: (id:string)=>ActionDef = action) {
    for (const rack of [left, right]) if (rack.length < 1 || rack.length > 3) throw new RangeError('Racks require 1–3 actions');
    const side = (rack: string[]): SideState => ({ rack: rack.map(id=>slot(id,this.definition)), index: 0, aim: { x: 1, z: 0 }, aimPoint: null, swapUntil: 0 });
    this.state = { selectedSide: 'LEFT', LEFT: side(left), RIGHT: side(right) };
  }
  input(frame: InputFrame, tick: number): void {
    if (frame.left.down) this.state.selectedSide = 'LEFT';
    if (frame.right.down) this.state.selectedSide = 'RIGHT';
    const side = this.state[this.state.selectedSide], aim = frame.aim;
    if (aim && Math.hypot(aim.x, aim.z) > 0) {
      const length = Math.hypot(aim.x, aim.z); side.aim.x = aim.x / length; side.aim.z = aim.z / length;
      if (frame.aimPoint) { side.aimPoint ??= { x: 0, z: 0 }; side.aimPoint.x = frame.aimPoint.x; side.aimPoint.z = frame.aimPoint.z; }
      else side.aimPoint = null;
    }
    if (frame.selector && tick >= side.swapUntil) {
      side.index = (side.index + frame.selector + side.rack.length) % side.rack.length; side.swapUntil = tick + 15;
    }
  }
  /** Adds to selected rack; full racks replace exactly the current slot. */
  collect(side: Side, id: string): string | null {
    const rack = this.state[side], next = slot(id,this.definition);
    if (rack.rack.length < 3) { rack.rack.push(next); return null; }
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
