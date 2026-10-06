// Adapted from folio-2025 Player.js by Bruno Simon (MIT), commit 41046b5: pre/post physics intent split.
import { FIXED_DT } from '../../core/Clock';
import { actionTicks, survivor, type ActionState, type AnimationState, type GearTier, type SurvivorVariant } from '../../data/survivor';
import type { EventBus } from '../../core/EventBus';
import type { InputFrame } from '../../input/InputFrame';
import type { Physics } from '../../physics/Physics';
import type { EntitySnapshot, GameEvent } from '../world/types';
import { KinematicController } from '../locomotion/KinematicController';

/** Owns survivor timers and animation intent; combat calls damage()/act(), missions setCheckpoint(). */
export class Player {
  readonly locomotion: KinematicController;
  progressionSpeed = 1;
  private lastDamage = -Infinity;
  private action: ActionState | null = null;
  private actionUntil = 0;
  constructor(readonly entity: EntitySnapshot, private readonly physics: Physics, private readonly events: EventBus<GameEvent>) {
    this.locomotion = new KinematicController(physics);
    entity.survivor = { variant: 'female', gearTier: 0, animation: 'idle', animationTick: 0, velocity: this.locomotion.velocity, grounded: false, invulnerableUntil: 0, checkpoint: { ...entity.transform }, diedAt: null };
  }
  private animate(state: AnimationState, tick: number): void {
    const pose = this.entity.survivor!;
    if (pose.animation !== state) { pose.animation = state; pose.animationTick = tick; }
  }
  prePhysics(input: InputFrame, tick: number, enabled = true): void {
    const state = this.entity.survivor!, health = this.entity.health;
    // Finite level floors have edges. Use the normal death/checkpoint lifecycle
    // when the survivor leaves the ground, rather than falling indefinitely.
    if (state.diedAt === null && this.entity.transform.y < survivor.fallDeathY) this.damage(health.max, tick);
    if (state.diedAt !== null && tick - state.diedAt >= survivor.respawnTicks) {
      Object.assign(this.entity.transform, state.checkpoint);
      this.physics.playerBody!.setTranslation(this.entity.transform, true);
      health.current = health.max; state.diedAt = null; state.invulnerableUntil = tick;
      this.lastDamage = -Infinity; this.action = null; this.locomotion.reset();
      this.events.emit({ type: 'player.respawned', tick, id: this.entity.id });
    }
    if (state.diedAt === null && tick - this.lastDamage >= survivor.regenDelayTicks) health.current = Math.min(health.max, health.current + survivor.regenPerSecond * FIXED_DT);
    if (input.interact && state.diedAt === null) this.act('interact', tick);
    this.locomotion.move(input, this.entity.transform, state.diedAt === null && enabled);
  }
  postPhysics(tick: number): void {
    const p = this.physics.playerBody!.translation(), state = this.entity.survivor!;
    Object.assign(this.entity.transform, p); state.grounded = this.physics.characterController!.computedGrounded();
    const speed = Math.hypot(this.locomotion.displacement.x, this.locomotion.displacement.z) / FIXED_DT;
    this.animate(state.diedAt !== null ? 'die' : tick - this.lastDamage < survivor.hurtTicks ? 'hurt' : this.action && tick < this.actionUntil ? this.action : speed > 2.5 ? 'run' : speed > 0.01 ? 'walk' : 'idle', tick);
  }
  /** Returns accepted damage; rejected hits do not postpone regeneration. Timers use sim ticks only. */
  damage(amount: number, tick: number): number {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Damage must be finite and nonnegative');
    const state = this.entity.survivor!;
    if (amount === 0 || state.diedAt !== null || tick < state.invulnerableUntil) return 0;
    const taken = Math.min(amount, this.entity.health.current);
    this.entity.health.current -= taken; this.lastDamage = tick; state.invulnerableUntil = tick + survivor.invulnerableTicks;
    this.events.emit({ type: 'player.damaged', tick, id: this.entity.id, amount: taken });
    if (this.entity.health.current === 0) { state.diedAt = tick; this.action = null; this.locomotion.reset(); this.animate('die', tick); this.events.emit({ type: 'player.died', tick, id: this.entity.id }); }
    else this.animate('hurt', tick);
    return taken;
  }
  /** Presentation intent only: E05/E06 resolve weapons separately. */
  act(action: ActionState, tick: number, duration = actionTicks[action]): void {
    if (!Object.hasOwn(actionTicks, action)) throw new RangeError('Unknown survivor action');
    if (this.entity.survivor!.diedAt !== null) return;
    this.action = action; this.actionUntil = tick + duration; this.animate(action, tick); this.entity.survivor!.animationTick = tick;
  }
  /** Missions restore serialized records, then reset controller-local damage/action timers. */
  restoreVitals(tick: number): void {
    const state=this.entity.survivor!;
    this.entity.health.current=this.entity.health.max; state.diedAt=null; state.invulnerableUntil=tick;
    this.lastDamage=-Infinity; this.action=null; delete state.attack; this.locomotion.reset(); state.velocity=this.locomotion.velocity;
    this.animate('idle',tick);
  }
  setCheckpoint(position: { x: number; y: number; z: number }): void {
    if (!Object.values(position).every(Number.isFinite)) throw new RangeError('Checkpoint must be finite');
    Object.assign(this.entity.survivor!.checkpoint, position);
  }
  /** Cosmetic selection never changes gameplay stats. */
  select(variant: SurvivorVariant, gearTier: GearTier): void {
    if (!['female', 'male'].includes(variant) || !Number.isInteger(gearTier) || gearTier < 0 || gearTier > 4) throw new RangeError('Invalid survivor selection');
    this.entity.survivor!.variant = variant; this.entity.survivor!.gearTier = gearTier;
  }
}
