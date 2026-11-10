import { CureFront } from './CureFront';
import { LevelTenEpilogue } from './LevelTenEpilogue';
import { finale } from '../../data/l10Finale';
import { LevelTenStory } from './LevelTenStory';
import type { Mission } from './Mission';

export const cureChargeTicks = 3600;
export const cureChargeRadius = finale.holdRadius;
/** The existing mission flags/counter are the entire serialized device predicate.
 * Called in the mission phase, so pause/focus cannot advance a second clock. */
export class LevelTenFinale {
  readonly cure: CureFront;
  readonly epilogue: LevelTenEpilogue;
  readonly story: LevelTenStory;
  constructor(private readonly mission: Mission) {
    this.cure = new CureFront(mission); this.epilogue = new LevelTenEpilogue(mission);
    this.story = new LevelTenStory(mission);
    const console = mission.def.anchors['cure-console'];
    if (console) mission.def.anchors['cure-mega'] = { ...console };
  }
  update(): void {
    this.story.update();
    const { world, state, def } = this.mission;
    if (state.states['cure-released']) { this.cure.update(); this.epilogue.update(); return; }
    const player = world.entities.get(1)!, console = def.anchors['cure-console'];
    if (console && !state.states['arena-equipped'] && player.transform.x > console.x - 200 && world.chunks?.resident(console.x, console.z)) {
      for (const [i, [dx, dz]] of [[24, -4], [-18, 10]].entries()) state.actors[`arena-fuel-${i}`] = world.hazards!.spawn('propane', { x: console.x + dx, z: console.z + dz });
      state.actors['arena-gate-switch'] = world.interactables!.spawn('switch', { x: console.x + 10, z: console.z + 28 }, { label: 'Electrify the gate', radius: 2 });
      state.states['arena-equipped'] = true;
    }
    const pressed = world.inputFrame.interact && !state.states['console-held'];
    state.states['console-held'] = world.inputFrame.interact;
    const boss = world.megaPursuit;
    if (boss) {
      const wasDead = state.states['mega-dead'];
      state.states['mega-dead'] = boss.state.id !== 0 && boss.state.mode === 'dead';
      if (!wasDead && state.states['mega-dead'] && state.states['charge-ready']) this.mission.radio('L10.release');
    }
    if (!console || player.health.current <= 0 || !state.states['cure-installed'] || state.states['cure-released']) return;
    const mega = boss?.entity();
    if (mega && mega.health.current > 0) {
      const brain = mega.infected!, phase = mega.health.current > mega.health.max * .7 ? 1 : mega.health.current > mega.health.max * .35 ? 2 : 3;
      if (brain.megaPhase !== phase) {
        world.infected!.cancelSpecial(mega.id);
        brain.megaPhase = phase;
        this.mission.requestCheckpoint('cure-disperse-ready');
        world.events.emit({ type: 'mission.signal', tick: world.tick, name: `mega-phase-${phase}` });
      }
      brain.megaWeakTicks = Math.max(0, (brain.megaWeakTicks ?? 0) - 1);
      if (phase === 2 && mega.combat!.statuses.some(s => s.kind === 'burning')) {
        brain.megaBurnTicks = Math.min(120, (brain.megaBurnTicks ?? 0) + 1);
        if (brain.megaBurnTicks === 120) brain.megaArmourBroken = true;
      }
    }
    const gate = { x: console.x, z: console.z + 28 }, switchOn = world.entities.get(state.actors['arena-gate-switch'])?.interactable?.completed;
    if (switchOn && !state.states['gate-spent']) {
      if (world.tick % 60 === 0) world.events.emit({ type: 'vfx.effect', tick: world.tick, kind: 'electric', position: gate, radius: 4 });
      const entity = boss?.entity();
      if (entity && entity.health.current > 0 && Math.hypot(entity.transform.x - gate.x, entity.transform.z - gate.z) <= 4) {
        state.states['gate-spent'] = true;
        world.combat!.damage.apply({ attackId: 0, actionId: 'environment.electric-gate', sourceId: 1, targetId: entity.id, origin: gate, direction: { x: 0, z: 0 }, base: 900, multiplier: 1, type: 'status', stagger: 0, knockback: 0 });
        world.infected!.cancelSpecial(entity.id); entity.combat!.staggerUntil = world.tick + 180;
      }
    }
    const distance = Math.hypot(player.transform.x - console.x, player.transform.z - console.z);
    if (state.steps.hold.status === 'active') {
      const wasReady = state.states['charge-ready'];
      if (!state.states['charge-active'] && pressed && distance <= console.radius) {
        state.states['charge-active'] = true;
        world.events.emit({ type: 'mission.signal', tick: world.tick, name: 'cure-assault-started' });
        return; // Activation is distinct from the 3,600 eligible defend ticks.
      }
      if (state.states['charge-active'] && distance <= cureChargeRadius) {
        state.counters['charge-ticks'] = Math.min(cureChargeTicks, state.counters['charge-ticks'] + 1);
      }
      state.states['charge-ready'] = state.counters['charge-ticks'] === cureChargeTicks;
      if (state.states['charge-ready'] && !wasReady) {
        // Preserve damage dealt while defending. The checkpoint captures the same stalker's actual state.
        if (state.states['mega-dead']) this.mission.radio('L10.release');
        // Phase-entry checkpoints own the boss state. Death keeps the live
        // charge counter, so finishing a charge must not overwrite that seam.
      }
    }
    if (state.steps.mega.status === 'active' && boss?.alive()) {
      // The same boss keeps walking its route, even after the charge is ready.
      // Arrival is a consequence of pursuit, never a scheduled relocation.
      const at = boss.entity()!.transform;
      this.mission.def.anchors['cure-mega'] = { x: at.x, z: at.z, y: at.y, radius: 2 };
    }
    if (state.steps.release.status === 'active' && pressed && distance <= console.radius && state.states['charge-active']
      && state.counters['charge-ticks'] === cureChargeTicks && state.states['mega-dead']) {
      state.states['cure-released'] = true;
      // r31-epilogue P3: Voss's order ends with the release instead of lingering over the dust.
      if (state.subtitle?.id === 'L10.release') state.subtitle = null;
      this.cure.release();
      this.epilogue.gatherCured();
      world.events.emit({ type: 'mission.signal', tick: world.tick, name: 'cure-released' });
    }
  }
}

/** Shared by both objective HUDs; presentation never controls the charge clock. */
export function cureFinaleText(mission: Mission | null): string | null {
  if (!mission) return null;
  const { state, world, def } = mission;
  if (def.id !== 'L10') return null;
  if (state.steps.epilogue?.status === 'active' && state.cureFront) return state.cureFront.elapsed < 8 * 60 ? 'Release the cure' : 'Minor Incident';
  if (state.steps.mega.status === 'active' && !state.states['mega-dead']) {
    const at = def.anchors['cure-console'], p = world.entities.get(1)!.transform;
    return at && Math.hypot(p.x - at.x, p.z - at.z) > finale.fightRadius ? 'Back to the dispersal arena · Kill the Mega Alpha' : 'Kill the Mega Alpha';
  }
  if (state.steps.hold.status !== 'active') return null;
  if (!state.states['charge-active']) return 'Activate the dispersal console';
  if (state.states['charge-ready'] && !state.states['mega-dead']) return 'Kill the Mega Alpha';
  const at = def.anchors['cure-console'], player = world.entities.get(1)!;
  const progress = `${Math.floor(state.counters['charge-ticks'] / 60)}/60 s`;
  if (at && Math.hypot(player.transform.x - at.x, player.transform.z - at.z) > cureChargeRadius) return `Back to the dispersal console · Charge paused · ${progress}`;
  return `Defend the dispersal console · Charge ${progress}`;
}
