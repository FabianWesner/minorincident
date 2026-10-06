import { ticks, type ActionDef, type Side } from '../../data/actions/schema';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
import { Loadout } from './Loadout';
export interface Attack {
  id: number; sourceId: number; side: Side; def: ActionDef; aim: Vec2; aimPoint: Vec2 | null;
  started: number; activeAt: number; recoveryAt: number; endsAt: number; resolved: boolean; hit: Set<number>;
}
/** Fixed-tick phases; each active action resolves once, independent of render rate. */
export class ActionRunner {
  readonly running: Partial<Record<Side, Attack>> = {};
  infiniteCharges = false;
  constructor(readonly sourceId: number, readonly loadout: Loadout, private sequence = 0) {}
  get lastAttackId(): number { return this.sequence; }
  update(frame: InputFrame, tick: number, enabled: boolean, started: (attack: Attack) => void, resolve: (attack: Attack) => void): void {
    for (const side of ['LEFT', 'RIGHT'] as const) {
      let attack = this.running[side];
      if (!enabled) { delete this.running[side]; continue; }
      if (attack && tick >= attack.endsAt) { delete this.running[side]; attack = undefined; }
      const button = side === 'LEFT' ? frame.left : frame.right;
      const def = this.loadout.definition(this.loadout.current(side).id);
      if (!attack && (button.down || (button.held && (def.category === 'melee' || def.category === 'ranged'))) && this.loadout.usable(side, tick)) {
        this.loadout.state.selectedSide = side;
        const state = this.loadout.state[side];
        attack = { id: ++this.sequence, sourceId: this.sourceId, side, def, aim: { ...state.aim }, aimPoint: state.aimPoint ? { ...state.aimPoint } : null, started: tick, activeAt: tick + ticks(def.windup), recoveryAt: tick + ticks(def.windup + def.active), endsAt: tick + ticks(def.windup + def.active + def.recovery), resolved: false, hit: new Set() };
        this.running[side] = attack; this.loadout.spend(side, tick, def, this.infiniteCharges); started(attack);
      }
      if (attack && !attack.resolved && tick >= attack.activeAt) { attack.resolved = true; resolve(attack); }
    }
  }
}
