import { Quaternion, Vector3 } from 'three';
import { lerp } from '../../core/maths';
import type { SurvivorState } from '../../data/survivor';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import type { BicycleView } from '../BicycleView';
import type { Vfx } from '../vfx/Vfx';
import { l10Closing } from './l10Closing';
import type { CharacterView } from './CharacterView';
import type { carTransitionPose } from './carTransition';

/** Bat roundhouse body turn (presentation only; the sim sweep strikes each target as this angle passes it):
 * a short coil against the swing in the windup, the full circle linearly over the active window. */
export function roundhouseSpin(attack: { started: number; activeAt: number; recoveryAt: number }, time: number): number {
  const u = time - attack.started, a = attack.activeAt - attack.started, r = attack.recoveryAt - attack.started;
  if (u < a) { const t = Math.max(0, u) / Math.max(1, a); return -.45 * t * t * (3 - 2 * t); }
  return u >= r ? 0 : -.45 + (Math.PI * 2 + .45) * (u - a) / Math.max(1, r - a);
}

/** Per-frame courier pose from the sim: interpolated position and facing, the hit-stop freeze, the bicycle ride,
 * the threat glance and the saddle/handlebar contacts. */
export class CourierPresenter {
  private hitStopTick = 0;
  private frozenStarted = -1;
  private frozenPose: SurvivorState | null = null;
  private wasPointerFacing = false;
  private readonly bikeOrientation = new Quaternion();
  private readonly seat = new Vector3();
  private readonly glance = new Vector3();
  private readonly gripL = new Vector3();
  private readonly gripR = new Vector3();
  constructor(private readonly world: SimWorld) {}
  /** Combat levels: keep a pose copy the hit-stop freezes into. */
  capture(survivor: SurvivorState | undefined): void { this.frozenPose = survivor ? structuredClone(survivor) : null; }
  reset(): void { this.frozenStarted = -1; this.frozenPose = null; this.wasPointerFacing = false; }
  present(character: CharacterView, survivor: SurvivorState, bicycle: BicycleView | null, vfx: Vfx | null, carPose: ReturnType<typeof carTransitionPose>, alpha: number, aspect: number): void {
    const current = this.world.entities.get(1)!.transform, previous = this.world.previousPlayer;
    // Portrait hero readability supplements the seven-metre camera floor; collision stays in metres.
    character.scale.setScalar(aspect < 1 ? 1.25 : 1);
    character.position.set(lerp(previous?.x ?? current.x, current.x, alpha), lerp(previous?.y ?? current.y, current.y, alpha) - 0.7, lerp(previous?.z ?? current.z, current.z, alpha));
    const from = previous?.yaw ?? current.yaw;
    const striking = !!survivor.attack && this.world.tick < survivor.attack.endsAt;
    const input = this.world.inputFrame;
    const pointerFacing = input.strafe && input.aimSource === 'pointer' ? input.aim : null;
    // The input's follow-through already owns the full 0.45 s grace. Do not
    // append another presentation turn after handing facing back to walking.
    const resumeWalking = this.wasPointerFacing && !pointerFacing && Math.hypot(survivor.velocity.x, survivor.velocity.z) > .1;
    this.wasPointerFacing = !!pointerFacing;
    const riding = this.world.entities.get(1)?.riding;
    const mountedFrame = riding !== undefined && bicycle?.frameOrientation(this.bikeOrientation);
    const stopped = vfx?.hitStop.active(vfx.time) ?? false;
    if (stopped && vfx!.hitStop.started !== this.frozenStarted && this.frozenPose) {
      this.frozenStarted = vfx!.hitStop.started; this.hitStopTick = this.world.tick;
      const velocity = this.frozenPose.velocity, checkpoint = this.frozenPose.checkpoint;
      Object.assign(this.frozenPose, survivor);
      this.frozenPose.velocity = velocity; Object.assign(velocity, survivor.velocity);
      this.frozenPose.checkpoint = checkpoint; Object.assign(checkpoint, survivor.checkpoint);
    }
    character.face(carPose ? carPose.yaw : mountedFrame ? current.yaw : pointerFacing ? -Math.atan2(pointerFacing.z, pointerFacing.x) : from + Math.atan2(Math.sin(current.yaw - from), Math.cos(current.yaw - from)) * alpha, (this.world.tick + alpha) / 60, striking, mountedFrame ? this.bikeOrientation : undefined,
      striking && survivor.attack!.style === 'roundhouse' ? roundhouseSpin(survivor.attack!, (stopped ? this.hitStopTick : this.world.tick) + (stopped ? 1 : alpha) - 1) : 0, resumeWalking);
    // E19 courier: the bicycle sim (lane F) marks the rider; the bike's crank/steer drive the pose.
    const bike = riding === undefined ? undefined : (this.world.entities.get(riding) as { bicycle?: { pedal: number; steer: number } } | undefined)?.bicycle;
    const ending = this.world.missions?.state;
    const closing = ending?.epilogue && ending.counters['epilogue-ticks'] >= 45 * 60;
    const closingPose = closing ? { ...survivor, scriptedClip: 'npc-sit' as const, animation: 'idle' as const, velocity: { x: 0, z: 0 } } : undefined;
    const seat = closing ? l10Closing.seat(this.world) : undefined;
    // r31-epilogue: she sits on the platform steps facing the sunrise (east), see l10Closing.
    if (seat) { character.position.set(seat.x, l10Closing.seatY, seat.z); character.rotation.y = Math.PI / 2; }
    character.update(closingPose ?? carPose?.pose ?? (stopped && this.frozenPose ? this.frozenPose : survivor), stopped ? this.hitStopTick : this.world.tick, stopped ? 1 : alpha,
      riding === undefined ? undefined : { pedal: bicycle?.presentedRide?.pedal ?? bike?.pedal ?? this.world.tick * .12, steer: bicycle?.presentedRide?.steer ?? bike?.steer ?? 0 }, !!input.strafe && !carPose && riding === undefined);
    const cureCollected = this.world.missions?.state?.id === 'L10' && this.world.missions.state.items.includes('cure-canister');
    character.showCure(!!cureCollected && !!this.world.missions?.state?.states['cure-carried'] && !this.world.missions?.state?.states['cure-installed']);
    if (character.skinActive) character.glanceAt(this.threat(current));
    // Riding: the pelvis sits on the saddle, measured from the bike's `seat` node every frame (any heading, lean or turn).
    if (character.skinActive) character.applyRideContacts(riding !== undefined ? bicycle?.riderContacts() : undefined);
    else if (riding !== undefined && bicycle?.seatWorld(this.seat)) {
      character.seatPelvis(this.seat, -.04);
      if (bicycle.gripsWorld(this.gripL, this.gripR)) character.holdHandlebar(this.gripL, this.gripR);
    }
  }
  /** Presentation glance target for the courier: the nearest live infected within 6 m (head height). */
  private threat(player: { x: number; z: number }): Vector3 | null {
    let best: EntitySnapshot | undefined, distance = 36;
    for (const e of this.world.entities.iterate()) {
      if (e.id === 1 || e.faction !== 'infected' || e.hidden || e.infected?.hidden || e.corpse || e.health.current <= 0 || e.archetype === 'infected.crow') continue;
      const d = (e.transform.x - player.x) ** 2 + (e.transform.z - player.z) ** 2;
      if (d < distance) { distance = d; best = e; }
    }
    return best ? this.glance.set(best.transform.x, best.transform.y + .4, best.transform.z) : null;
  }
}
