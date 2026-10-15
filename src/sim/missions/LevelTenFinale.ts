import { CureFront } from './CureFront';
import { LevelTenEpilogue } from './LevelTenEpilogue';
import { finale } from '../../data/l10Finale';
import type { Mission } from './Mission';

export const cureChargeTicks = 3600;
export const cureChargeRadius = finale.holdRadius;
/** The existing mission flags/counter are the entire serialized device predicate.
 * Called in the mission phase, so pause/focus cannot advance a second clock. */
export class LevelTenFinale {
  readonly cure: CureFront;
  readonly epilogue: LevelTenEpilogue;
  constructor(private readonly mission: Mission) { this.cure = new CureFront(mission); this.epilogue = new LevelTenEpilogue(mission); }
  update(): void {
    const { world, state, def } = this.mission;
    if (state.states['cure-released']) { this.cure.update(); this.epilogue.update(); return; }
    const player = world.entities.get(1)!, console = def.anchors['cure-console'];
    const pressed = world.inputFrame.interact && !state.states['console-held'];
    state.states['console-held'] = world.inputFrame.interact;
    const boss = world.megaPursuit;
    if (boss) state.states['mega-dead'] = boss.state.id !== 0 && boss.state.mode === 'dead';
    if (!console || player.health.current <= 0 || !state.states['cure-installed'] || state.states['cure-released']) return;
    const distance = Math.hypot(player.transform.x - console.x, player.transform.z - console.z);
    if (state.steps.hold.status === 'active') {
      if (!state.states['charge-active'] && pressed && distance <= console.radius) {
        state.states['charge-active'] = true;
        world.events.emit({ type: 'mission.signal', tick: world.tick, name: 'cure-assault-started' });
        return; // Activation is distinct from the 3,600 eligible defend ticks.
      }
      if (state.states['charge-active'] && distance <= cureChargeRadius) {
        state.counters['charge-ticks'] = Math.min(cureChargeTicks, state.counters['charge-ticks'] + 1);
      }
      state.states['charge-ready'] = state.counters['charge-ticks'] === cureChargeTicks;
    }
    if (state.steps.release.status === 'active' && pressed && distance <= console.radius && state.states['charge-active']
      && state.counters['charge-ticks'] === cureChargeTicks && state.states['mega-dead']) {
      state.states['cure-released'] = true;
      this.cure.release();
      world.events.emit({ type: 'mission.signal', tick: world.tick, name: 'cure-released' });
    }
  }
}

/** Shared by both objective HUDs; presentation never controls the charge clock. */
export function cureFinaleText(mission: Mission | null): string | null {
  if (!mission) return null;
  const { state, world, def } = mission;
  if (def.id !== 'L10' || state.steps.hold.status !== 'active') return null;
  if (!state.states['charge-active']) return 'Activate the dispersal console';
  const at = def.anchors['cure-console'], player = world.entities.get(1)!;
  const progress = `${Math.floor(state.counters['charge-ticks'] / 60)}/60 s`;
  if (at && Math.hypot(player.transform.x - at.x, player.transform.z - at.z) > cureChargeRadius) return `Back to the dispersal console · Charge paused · ${progress}`;
  return state.states['charge-ready'] ? 'Kill the Mega Alpha · Charge 60/60 s' : `Defend the dispersal console · Charge ${progress}`;
}
