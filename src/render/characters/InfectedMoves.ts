import type { EntitySnapshot } from '../../sim/world/types';
import type { CrowdLayers } from './CrowdLocomotion';
import type { GaitStyle } from './CourierGroundContacts';

const ease = (u: number): number => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };
/** Visible flinch per hit: short enough that every click of a fast combo reads as its own recoil. */
export const flinchSeconds = .25;
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
    const age = (renderTick - r.started) / 60, duration = Math.min(flinchSeconds, Math.max(1, r.until - r.started) / 60);
    if (age < 0 || age >= duration) return 0;
    return age < duration * .3 ? ease(age / (duration * .3)) : 1 - ease((age - duration * .3) / (duration * .7));
  }
  /**
   * Layers and gait style for one infected figure. `gait` is the displayed locomotion clip (or undefined when standing),
   * `windup` the archetype's windup in seconds, `yaw` the presented heading.
   */
  sample(e: EntitySnapshot, state: string, until: number, windup: number, renderTick: number, yaw: number, speed: number, gait: string | undefined): { layers: CrowdLayers; style: GaitStyle } {
    const layers = this.layers, style = this.style;
    layers.lean = layers.roll = layers.lunge = layers.lurch = layers.flinch = 0; style.drag = 0; style.dragFoot = e.id % 2;
    // Lunge-grab: coil back through the windup, throw the body at the target as it ends, recover after the hit.
    if (state === 'attack') {
      const p = 1 - Math.max(0, until - renderTick) / Math.max(1, windup * 60);
      layers.lunge = p < .55 ? -.05 * ease(p / .55) : -.05 + .27 * ease((p - .55) / .45);
      this.strikes.set(e.id, until);
    } else if (this.strikes.has(e.id)) {
      const since = (renderTick - this.strikes.get(e.id)!) / 60;
      if (since >= 0 && since < .45 && state !== 'dead') layers.lunge = .22 * (since < .1 ? 1 : 1 - ease((since - .1) / .35));
      else this.strikes.delete(e.id);
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
    }
    return { layers, style };
  }
}
