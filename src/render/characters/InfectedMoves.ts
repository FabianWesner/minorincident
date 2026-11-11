import type { EntitySnapshot } from '../../sim/world/types';
import type { CrowdLayers } from './CrowdLocomotion';
import type { GaitStyle } from './CourierGroundContacts';

const ease = (u: number): number => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };
/** Visible flinch per hit: short enough that every click of a fast combo reads as its own recoil. */
export const flinchSeconds = .3;
/**
 * The zombie move set on top of the baked infected clips (presentation only, never read by the sim):
 * walkers drag one foot, runners lurch, attacks coil and lunge into a grab, light hits flinch for at most
 * 0.25 s on planted feet. Knockdown/get-up stay with heavy reactions (deaths, finishers, blasts).
 */
export class InfectedMoves {
  private readonly strikes = new Map<number, number>();
  private readonly layers: CrowdLayers = {};
  private readonly style: GaitStyle = {};
  /**
   * PO "Infected recover": a knocked-down infected is down, not dead. Once its fall has settled it stirs in short irregular
   * twitches (the end of the fall clip rewound a few percent), stronger in the last 2 s before it gets up. Returns the phase
   * to subtract from the fall clip; 0 for the living and for permanent corpses.
   */
  static stir(e: EntitySnapshot, renderTick: number, fallSeconds: number): number {
    const b = e.infected; if (!b || b.state !== 'dead' || b.recoverAt < 0 || e.health.current > 0) return 0;
    const lying = (renderTick - b.deadAt) / 60 - fallSeconds; if (lying <= 0) return 0;
    const t = renderTick / 60 + e.id * .61, twitch = Math.max(0, Math.sin(t * 2.3) * Math.sin(t * 5.9 + e.id)) ** 3;
    return Math.min(1, lying) * twitch * ((b.recoverAt - renderTick) / 60 < 2 ? .14 : .06);
  }
  /** Flinch weight 0..1 for a light (non-heavy) reaction, 0 otherwise. */
  static flinch(e: EntitySnapshot, renderTick: number): number {
    const r = e.combat?.reaction;
    if (!r || r.heavy || e.health.current <= 0) return 0;
    // Gun stagger can be one simulation tick by design. Keep a separate, fixed visual window so every hit is readable.
    const age = (renderTick - r.started) / 60, duration = flinchSeconds;
    if (age < 0 || age >= duration) return 0;
    return age < duration * .12 ? ease(age / (duration * .12)) : 1 - ease((age - duration * .12) / (duration * .88));
  }
  /** Ordinary melee stagger uses its authored side pose; bullets retain the moving flinch layer. */
  static staggerClip(e: EntitySnapshot, renderTick: number, yaw: number): 'stagger-left' | 'stagger-right' | undefined {
    const r = e.combat?.reaction;
    if (!r || r.heavy || r.until - r.started <= 1 || e.health.current <= 0 || renderTick < r.started || renderTick - r.started >= flinchSeconds * 60) return;
    const side = r.direction.x * Math.sin(yaw) + r.direction.z * Math.cos(yaw);
    return side < 0 ? 'stagger-left' : 'stagger-right';
  }
  /**
   * Layers and gait style for one infected figure. `gait` is the displayed locomotion clip (or undefined when standing),
   * `windup` the archetype's windup in seconds, `yaw` the presented heading.
   */
  sample(e: EntitySnapshot, state: string, until: number, windup: number, renderTick: number, yaw: number, speed: number, gait: string | undefined, lurchScale = 1): { layers: CrowdLayers; style: GaitStyle } {
    const layers = this.layers, style = this.style;
    layers.maxBodyLean = undefined;
    layers.bodyLean = undefined;
    layers.lean = layers.roll = layers.lunge = layers.lurch = layers.flinch = layers.chestBeat = layers.trunkSwipe = layers.throwPose = layers.shieldBreak = layers.heavyGait = 0;
    layers.attack = undefined; layers.attackStyle = undefined;
    style.drag = 0; style.dragFoot = e.id % 2; style.stance = style.knee = style.maxSwing = style.stepRate = style.maxLift = style.pelvisHeight = style.footRoll = undefined;
    // Broad infected soles settle flat during contact attacks instead of rolling a toe across the floor.
    if (!gait) style.footRoll = 0;
    if (e.archetype === 'infected.riot' && (e.combat?.shieldBrokenUntil ?? 0) > renderTick) {
      const age = renderTick - (e.combat?.shieldBrokenAt ?? renderTick), remain = (e.combat?.shieldBrokenUntil ?? renderTick) - renderTick;
      layers.shieldBreak = ease(Math.min(1, age / 10, remain / 10));
    }
    // Lunge-grab: coil back through the windup, throw the body at the target as it ends, recover after the hit.
    if (state === 'attack') this.strikes.set(e.id, until);
    const strikeAt = this.strikes.get(e.id);
    if (state === 'attack' && strikeAt !== undefined) {
      const p = Math.max(0, Math.min(1, 1 - (strikeAt - renderTick) / Math.max(1, windup * 60)));
      layers.attack = .5 * p;
      layers.lunge = p < .78 ? -.08 * ease(p / .78) : -.08 + .26 * ease((p - .78) / .22);
    } else if (strikeAt !== undefined) {
      const since = renderTick - strikeAt;
      if (since >= 0 && since < 27 && state !== 'dead') {
        layers.attack = .5 + .5 * since / 27;
        layers.lunge = .18 * (since < 6 ? 1 : 1 - ease((since - 6) / 21));
      } else this.strikes.delete(e.id);
    }
    if (layers.attack !== undefined) {
      layers.attackStyle = e.archetype === 'infected.crawler' || e.infected?.legLost ? 2
        : e.archetype === 'infected.riot' ? 3
          : /brute|armored|butcher|screamer|bloated|hazmat|firefighter/.test(e.archetype) ? 1 : 0;
    }
    const special = e.infected?.specialAttack;
    if (special?.move === 'alpha.charge' && special.stage === 'telegraph') {
      const windup = ease((renderTick - special.startTick) / Math.max(1, special.activeTick - special.startTick));
      layers.lean = -.18 * windup; layers.lunge = -.12 * windup;
    }
    if (special?.move === 'gorilla.roar' && special.stage === 'telegraph') layers.chestBeat = Math.max(.001, (renderTick - special.startTick) / 60);
    if (special?.move === 'elephant.swipe') {
      const windup = Math.max(0, Math.min(1, (renderTick - special.startTick) / (special.activeTick - special.startTick)));
      const recovery = Math.max(0, Math.min(1, (renderTick - special.activeTick) / 36));
      layers.trunkSwipe = special.stage === 'telegraph' ? -Math.PI / 3 * ease(windup) : Math.PI / 3 * Math.sin(Math.PI * recovery);
    }
    if (special?.move === 'gorilla.grab-throw' || special?.move === 'alpha.grab-human' || special?.move === 'alpha.grab-throw' || special?.move === 'alpha.living-missile' || special?.move === 'alpha.barrage') {
      const windup = Math.max(0, Math.min(1, (renderTick - special.startTick) / 48));
      layers.throwPose = special.stage === 'telegraph' ? windup * 1.8 : Math.max(0, 1 - (renderTick - special.activeTick) / 30) * 1.8;
    }
    if (special?.stage === 'telegraph') {
      const progress = ease((renderTick - special.startTick) / Math.max(1, special.activeTick - special.startTick));
      if (special.move === 'alpha.ground-slam') layers.throwPose = progress * 2;
      if (special.move === 'alpha.roar') { layers.lean = -.2 * progress; layers.lunge = -.1 * progress; }
      if (special.move === 'alpha.pounce') { layers.lean = -.3 * progress; layers.lunge = -.18 * progress; }
      if (special.move === 'alpha.shield-bash') { layers.throwPose = .7 * progress; layers.lean = -.15 * progress; }
    }
    const flinch = InfectedMoves.flinch(e, renderTick);
    if (flinch) {
      const d = e.combat!.reaction!.direction, c = Math.cos(yaw), s = Math.sin(yaw);
      layers.flinch = flinch; layers.hitX = d.x * c - d.z * s; layers.hitZ = d.x * s + d.z * c;
    }
    if (gait) {
      // Walkers (below run speed) shamble on a dragged foot; frail runners still favour it; the average tier lurches.
      if (speed <= 2.6) { style.drag = .85; layers.lurch = .3; }
      else if (gait === 'infected-frail') { style.drag = .45; layers.lurch = .25; }
      else if (gait === 'infected-lurch' || gait === 'infected-run' || gait === 'run') layers.lurch = 1;
      else layers.lurch = .35;
      layers.lurch *= lurchScale;
    }
    return { layers, style };
  }
}

/** Seconds of the `get-up` clip of a heavy reaction: the rest of the reaction after its 0.7 s knockdown (0.64 s for a
 * hit; the slower recovery stand-up of InfectedSystem.recover, `infectedRecovery.getUpS`, reads as getting up). */
export const getUpSpan = (reaction: { started: number; until: number }) => Math.max(.3, (reaction.until - reaction.started) / 60 - .7);
