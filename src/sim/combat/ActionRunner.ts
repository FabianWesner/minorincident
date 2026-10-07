import { ticks, type ActionDef, type Side } from '../../data/actions/schema';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
import { Loadout } from './Loadout';
import { comboDefinition, meleeChains } from '../../data/meleeCombos';
export interface Attack {
  id: number; sourceId: number; side: Side; def: ActionDef; aim: Vec2; aimPoint: Vec2 | null;
  started: number; activeAt: number; recoveryAt: number; endsAt: number; resolved: boolean; hit: Set<number>;
  combo: number; inPlace: boolean;
  /** E20 §5.3: the fire axe decides single swing or roundhouse at swing start. */
  style?: 'single' | 'roundhouse';
}
/** Fixed-tick phases; each active action resolves once, independent of render rate. */
export class ActionRunner {
  readonly running: Partial<Record<Side, Attack>> = {};
  infiniteCharges = false;
  /** One pending melee tap per side, valid for 200ms (12 sim ticks). */
  private readonly buffered: Partial<Record<Side, { actionId: string; until: number; inPlace: boolean; mouseAttack?: boolean }>> = {};
  snapshotBuffer() { return structuredClone(this.buffered); }
  private readonly chains: Partial<Record<Side, { actionId: string; combo: number; until: number }>> = {};
  constructor(readonly sourceId: number, readonly loadout: Loadout, private sequence = 0) {}
  snapshotChains() { return Object.fromEntries(Object.entries(this.chains).map(([side, chain]) => [side, { ...chain }])); }
  get lastAttackId(): number { return this.sequence; }
  update(frame: InputFrame, tick: number, enabled: boolean, started: (attack: Attack) => void, resolve: (attack: Attack) => void): void {
    for (const side of ['LEFT', 'RIGHT'] as const) {
      let attack = this.running[side];
      if (!enabled) { delete this.running[side]; delete this.buffered[side]; continue; }
      if (attack && tick >= attack.endsAt) { delete this.running[side]; attack = undefined; }
      const button = side === 'LEFT' ? frame.left : frame.right;
      if (frame.cancelMove || frame.moveTarget || frame.attackTarget || frame.selector || frame.selectedSlot || frame.selectedActiveSlot !== undefined) delete this.buffered[side];
      let buffered = this.buffered[side];
      let def = this.loadout.definition(this.loadout.current(side).id);
      if ((frame.mouseAttack || (!button.down && buffered?.mouseAttack)) && def.id === 'weapon.kick') def = this.loadout.definition('weapon.fists');
      if (buffered && (tick > buffered.until || buffered.actionId !== def.id)) { delete this.buffered[side]; buffered = undefined; }
      if (button.down && def.category === 'melee') {
        buffered = { actionId: def.id, until: tick + 12, inPlace: !!frame.attackInPlace, ...(frame.mouseAttack ? { mouseAttack: true } : {}) };
        this.buffered[side] = buffered;
      }
      if (!attack && (buffered || button.down || (button.held && (def.category === 'melee' || def.category === 'ranged'))) && this.loadout.usable(side, tick)) {
        this.loadout.state.selectedSide = side;
        const state = this.loadout.state[side];
        const previous = this.chains[side], count = meleeChains[def.id]?.length ?? 1;
        const unarmedOrder = [0, 1, 2, 4, 5, 3, 6];
        const combo = def.id === 'weapon.fists'
          ? previous?.actionId === def.id ? unarmedOrder[(unarmedOrder.indexOf(previous.combo) + 1) % unarmedOrder.length] : 0
          : previous?.actionId === def.id && tick <= previous.until ? (previous.combo + 1) % count : 0;
        def = comboDefinition(def, combo);
        this.chains[side] = { actionId: def.id, combo, until: tick + ticks(def.cooldown) + 48 };
        attack = { id: ++this.sequence, sourceId: this.sourceId, side, def, combo, inPlace: buffered?.inPlace ?? !!frame.attackInPlace, aim: { ...state.aim }, aimPoint: state.aimPoint ? { ...state.aimPoint } : null, started: tick, activeAt: tick + ticks(def.windup), recoveryAt: tick + ticks(def.windup + def.active), endsAt: tick + ticks(def.windup + def.active + def.recovery), resolved: false, hit: new Set() };
        delete this.buffered[side]; this.running[side] = attack; this.loadout.spend(side, tick, def, this.infiniteCharges); started(attack);
      }
      if (attack && !attack.resolved && tick >= attack.activeAt) { attack.resolved = true; resolve(attack); }
    }
  }
}
