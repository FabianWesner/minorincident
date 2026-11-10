import type { EntitySnapshot } from '../../sim/world/types';
import type { InfectedSpecialMove } from '../../data/infected';
import type { AlphaType } from '../../data/alphaTypes';
import type { alphaMoveClips } from './crowdClipNames';

export type AlphaMoveClip = typeof alphaMoveClips[number] | 'stagger-left';
/** Presentation-only: one authored clip per move; `split` = end of the telegraph, `end` = end of the strike section. */
interface MoveShape { clip: AlphaMoveClip; split: number; end: number; activeTicks: number; loopTicks?: number; recovery?: number }
const shapes: Partial<Record<InfectedSpecialMove, MoveShape>> = {
  'alpha.charge': { clip: 'alpha-charge', split: .5, end: 1, activeTicks: 24, loopTicks: 24, recovery: .14 },
  'alpha.ground-slam': { clip: 'alpha-slam', split: .55, end: .64, activeTicks: 6 },
  'alpha.grab-human': { clip: 'alpha-grab', split: .5, end: .8, activeTicks: 10 },
  'alpha.grab-throw': { clip: 'alpha-heave', split: .6, end: .72, activeTicks: 8 },
  'alpha.living-missile': { clip: 'alpha-heave', split: .6, end: .72, activeTicks: 8 },
  'alpha.barrage': { clip: 'alpha-heave', split: .55, end: .8, activeTicks: 20, loopTicks: 20 },
  'alpha.roar': { clip: 'alpha-roar', split: .6, end: .74, activeTicks: 8 },
  'alpha.pounce': { clip: 'alpha-pounce', split: .5, end: .72, activeTicks: 10, recovery: .75 },
  'alpha.shield-bash': { clip: 'alpha-bash', split: .6, end: .68, activeTicks: 6 },
};
/** Typed Alpha recovery after a special (InfectedSystem.finishSpecial / cancelSpecial: 48 ticks). */
const recoveryTicks = 48;
/** Visible strike after the sim resolves an ordinary hit on the windup's last tick (r31 P1-A: "attack ends on the strike tick"). */
export const alphaStrikeTicks = 27;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * r32-alphas: which authored Alpha clip a humanoid Alpha shows and at which phase (0..1). Never read by the sim. The ordinary
 * attack shows the coil during the sim windup and keeps the rake/recovery playing for 0.45 s after the strike tick, even
 * though the brain is already back in chase. A special interrupted during its telegraph (roar hit, arm shot) staggers.
 */
export class AlphaMoves {
  private readonly strikes = new Map<number, number>();
  sample(e: EntitySnapshot, renderTick: number, windupSeconds: number, speed: number): { clip: AlphaMoveClip; phase: number } | undefined {
    const b = e.infected;
    if (!b || e.archetype !== 'infected.alpha' || b.pursuit || b.state === 'dead' || e.health.current <= 0) { this.strikes.delete(e.id); return undefined; }
    const a = b.specialAttack, shape = a ? shapes[a.move] : undefined;
    if (a && shape) {
      this.strikes.delete(e.id);
      if (a.stage === 'telegraph') return { clip: shape.clip, phase: shape.split * clamp((renderTick - a.startTick) / Math.max(1, a.activeTick - a.startTick)) };
      if (a.stage === 'active') {
        const age = Math.max(0, renderTick - a.activeTick);
        return { clip: shape.clip, phase: shape.loopTicks ? shape.split + (shape.end - shape.split) * (age / shape.loopTicks % 1) : shape.split + (shape.end - shape.split) * clamp(age / shape.activeTicks) };
      }
      const started = a.recoveryUntil - recoveryTicks, r = clamp((renderTick - started) / recoveryTicks);
      // Cancelled before the strike: the telegraph broke (hit during the inhale/reach) and the body reels instead.
      if (started < a.activeTick) return { clip: 'stagger-left', phase: r };
      // Slam, roar, bash and single throws resolve on one tick: their strike section plays at the start of the recovery.
      const from = shape.recovery ?? (started - a.activeTick < 4 ? shape.split : shape.end);
      return { clip: shape.clip, phase: shape.recovery !== undefined && shape.clip === 'alpha-charge' ? from : from + (1 - from) * r };
    }
    if (b.state === 'attack') {
      this.strikes.set(e.id, b.until);
      return { clip: 'alpha-strike', phase: .5 * clamp(1 - (b.until - renderTick) / Math.max(1, windupSeconds * 60)) };
    }
    const struck = this.strikes.get(e.id);
    if (struck !== undefined) {
      const since = renderTick - struck;
      if (since >= 0 && since < alphaStrikeTicks) return { clip: 'alpha-strike', phase: .5 + .5 * since / alphaStrikeTicks };
      this.strikes.delete(e.id);
    }
    // The Leaper stalks in a half crouch whenever it stands (its look cue: crouched, ready to spring).
    if ((b.alphaType as AlphaType | undefined) === 'leaper' && speed <= .06) return { clip: 'alpha-pounce', phase: .22 };
    return undefined;
  }
}

/** Silhouette per Alpha type (instance scale, presentation only): Brute biggest, Thrower lanky, Screamer thin, Armoured bulky. */
export const alphaSilhouette: Readonly<Record<AlphaType, readonly [width: number, height: number]>> = {
  brute: [1.16, 1.12], thrower: [.94, 1.08], screamer: [.9, 1.02], leaper: [.97, 1], armoured: [1.1, 1.05],
};
