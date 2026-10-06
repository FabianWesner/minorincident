import { Rng } from '../../core/Rng';
import { l1v2 } from '../../data/l1v2';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { GameEvent } from '../../sim/world/types';
import type { FxPool } from './FxPool';
import type { Vec2, L1AccidentEventName } from '../../sim/outbreak/types';

/** Beat 5 of Level 1 v2: a contained pressure blast inside the facility, not a cinematic explosion (design
 * "Sound and atmosphere"). Reuses the shared Vfx particle pool, which PreRenderer already warms, so no new
 * pipeline compiles at the blast. The view reads `state` each frame to drive windows and lights. */
export interface LabAccidentTargets {
  shake(strength: number): void;
  /** Window/interior light multiplier 0..1 (1 = steady). */
  windowLight?(intensity: number): void;
  /** Window glass: bows outward (amount 0..1), then shatters. */
  windowGlass?(state: 'bow' | 'shatter', amount: number): void;
}
export interface LabAccidentHost { particles: FxPool; time: number }
export interface LabAccidentState { light: number; bow: number; shattered: boolean; shake: number; smoking: boolean }

const { blastShakeS } = l1v2.accident;
const GLASS = 0xcfe9f2, DUST = 0x9a9488, SMOKE = 0x7d8f80 /* grey with a faint green tint */, PUFF = 0x96b76a;
const SMOKE_S = 40, SMOKE_INTERVAL = 0.25;

export class LabAccidentFx {
  readonly state: LabAccidentState = { light: 1, bow: 0, shattered: false, shake: 0, smoking: false };
  flashReduction = false;
  private readonly rng: Rng;
  private readonly stops: (() => void)[] = [];
  private flickerFrom = -1;
  private flickerSteps: { at: number; level: number }[] = [];
  private blastAt = -1;
  private smokeAt = -1;
  private nextSmoke = 0;
  private vents: Vec2[] = [];
  private dry = false;
  private time = 0;
  constructor(world: SimWorld, private readonly host: LabAccidentHost, private readonly targets: LabAccidentTargets, private readonly anchor: (name: string) => Vec2 | undefined = () => undefined) {
    this.rng = new Rng(world.seed, 'lab-accident');
    for (const type of ['l1.flicker', 'l1.blast', 'l1.smoke', 'l1.infectedExit'] as L1AccidentEventName[])
      this.stops.push(world.events.on(type, this.receive as (e: GameEvent) => void));
  }
  private at(event: { anchor?: string; position?: Vec2 }, fallback: string): Vec2 {
    return event.position ?? (event.anchor ? this.anchor(event.anchor) : undefined) ?? this.anchor(fallback) ?? { x: 0, z: 0 };
  }
  readonly receive = (event: { type: string; anchor?: string; position?: Vec2 }): void => {
    if (event.type === 'l1.flicker') this.startFlicker();
    else if (event.type === 'l1.blast') this.blast(this.at(event, 'lab-exit-window'));
    else if (event.type === 'l1.smoke') this.startSmoke(event);
    else if (event.type === 'l1.infectedExit') this.puff(this.at(event, 'lab-exit-front'));
  };
  /** Irregular dips of the window light for ~1.5 s. Reduced flashing: slow, shallow dips only (no strobe). */
  private startFlicker(): void {
    this.flickerFrom = this.time;
    this.flickerSteps = [];
    const len = l1v2.accident.eventAtS.blast - l1v2.accident.eventAtS.flicker;
    for (let t = 0; t < len; t += this.flashReduction ? 0.5 : 0.04 + this.rng.next() * 0.1)
      this.flickerSteps.push({ at: t, level: this.flashReduction ? 0.6 + this.rng.next() * 0.3 : this.rng.next() < 0.45 ? 0.1 + this.rng.next() * 0.3 : 0.8 + this.rng.next() * 0.2 });
  }
  private blast(p: Vec2): void {
    this.blastAt = this.time;
    this.state.shattered = false;
    this.state.shake = 1;
    this.targets.windowGlass?.('bow', 0);
    this.vents = [p];
    // Contained pressure wave: pale dust ring and glass leaving the window, nothing like a fireball.
    this.glassBurst(p);
    this.dust(p, 14);
  }
  private life(seconds: number): number { return this.dry ? 0.01 : seconds; }
  private glassBurst(p: Vec2): void {
    for (let i = 0; i < 28; i++) {
      const a = this.rng.next() * Math.PI * 2, s = 1.5 + this.rng.next() * 3.5;
      this.host.particles.spawn(this.host.time, this.life(0.9 + this.rng.next() * 0.5), p.x, 1.4 + this.rng.next() * 0.8, p.z, Math.cos(a) * s, 1 + this.rng.next() * 2.5, Math.sin(a) * s, 0.05 + this.rng.next() * 0.05, 0, GLASS, 9.8);
    }
  }
  private dust(p: Vec2, n: number): void {
    for (let i = 0; i < n; i++)
      this.host.particles.spawn(this.host.time, this.life(1.6), p.x, 1.2, p.z, (this.rng.next() - 0.5) * 3, this.rng.next() * 1.2, (this.rng.next() - 0.5) * 3, 0.45 + this.rng.next() * 0.35, 0, DUST, -0.1);
  }
  private startSmoke(event: { anchor?: string; position?: Vec2 }): void {
    this.smokeAt = this.time;
    this.nextSmoke = this.time;
    this.state.smoking = true;
    const vent = this.anchor('lab-smoke-vent'), window = this.anchor('lab-smoke-window');
    this.vents = [vent, window].filter((v): v is Vec2 => !!v);
    if (!this.vents.length) this.vents = [this.at(event, 'lab-exit-window')];
  }
  /** Infection puff: small sickly-green burst where an infected steps out. */
  private puff(p: Vec2): void {
    for (let i = 0; i < 10; i++)
      this.host.particles.spawn(this.host.time, this.life(0.5), p.x, 0.9, p.z, (this.rng.next() - 0.5) * 2, 0.4 + this.rng.next(), (this.rng.next() - 0.5) * 2, 0.12 + this.rng.next() * 0.1, 0, PUFF, -0.2);
  }
  /** Run each emit path once with instantly expiring particles so no first-use cost lands on the blast. */
  prewarm(): void {
    this.dry = true;
    try { const p = { x: 0, z: 0 }; this.glassBurst(p); this.dust(p, 14); this.puff(p); this.smoke(p); } finally { this.dry = false; }
  }
  private smoke(p: Vec2): void {
    for (let i = 0; i < 2; i++)
      this.host.particles.spawn(this.host.time, this.life(3.5), p.x + (this.rng.next() - 0.5) * 0.4, 2 + this.rng.next() * 0.4, p.z + (this.rng.next() - 0.5) * 0.4, (this.rng.next() - 0.5) * 0.3, 1.1 + this.rng.next() * 0.7, (this.rng.next() - 0.5) * 0.3, 0.55 + this.rng.next() * 0.5, 0, SMOKE, -0.15);
  }
  /** Advance by render seconds; call after Vfx.advance. */
  advance(seconds: number): void {
    this.time += seconds;
    const s = this.state;
    if (this.flickerFrom >= 0) {
      const t = this.time - this.flickerFrom;
      let level = 1;
      for (const step of this.flickerSteps) if (step.at <= t) level = step.level; else break;
      const done = t >= l1v2.accident.eventAtS.blast - l1v2.accident.eventAtS.flicker;
      s.light = done ? 1 : level;
      if (done) this.flickerFrom = -1;
      this.targets.windowLight?.(s.light);
    }
    if (this.blastAt >= 0) {
      const t = this.time - this.blastAt;
      s.bow = Math.min(1, t / 0.12);
      if (!s.shattered) this.targets.windowGlass?.('bow', s.bow);
      if (t >= 0.15 && !s.shattered) { s.shattered = true; this.targets.windowGlass?.('shatter', 1); }
      const k = Math.max(0, 1 - t / blastShakeS);
      s.shake = k;
      if (k > 0) this.targets.shake((this.flashReduction ? 0.04 : 0.14) * k * k);
      else this.blastAt = -1;
    }
    if (this.smokeAt >= 0) {
      if (this.time - this.smokeAt > SMOKE_S) { this.smokeAt = -1; s.smoking = false; }
      else while (this.nextSmoke <= this.time) { for (const v of this.vents) this.smoke(v); this.nextSmoke += SMOKE_INTERVAL; }
    }
  }
  dispose(): void { for (const stop of this.stops) stop(); this.stops.length = 0; }
}
