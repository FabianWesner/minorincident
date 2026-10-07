import { Rng } from '../../core/Rng';
import { l1v2 } from '../../data/l1v2';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { GameEvent } from '../../sim/world/types';
import type { FxPool } from './FxPool';
import { Quaternion } from 'three/webgpu';
import { SmokeColumn } from './labAccidentSmoke';
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
  /** Orange interior fire glow through the windows (0 = off). */
  windowFire?(intensity: number): void;
  /** Pull the game camera toward the accident (world point, weight 0..1) so the player sees it. */
  camera?(x: number, z: number, weight: number): void;
}
export interface LabAccidentHost { particles: FxPool; time: number }
export interface LabAccidentState { light: number; bow: number; shattered: boolean; shake: number; smoking: boolean; flash: number }

const { blastShakeS } = l1v2.accident;
const GLASS = 0xcfe9f2, DUST = 0x9a9488, PUFF = 0x96b76a;
const SMOKE_INTERVAL = 0.14, ROOF_Y = 5;
const FIRE = 0xffa040;

export class LabAccidentFx {
  readonly state: LabAccidentState = { light: 1, bow: 0, shattered: false, shake: 0, smoking: false, flash: 0 };
  flashReduction = false;
  private readonly rng: Rng;
  private readonly stops: (() => void)[] = [];
  private flickerFrom = -1;
  private flickerSteps: { at: number; level: number }[] = [];
  private blastAt = -1;
  private sparkAt = 0;
  private focus: Vec2 = { x: 0, z: 0 };
  private fightFade = 1;
  private broken = false;
  private glowFrom = -1;
  private sparked = false;
  /** Opaque smoke puffs and hard shards/debris; add to the scene. `facing` = camera quaternion for billboards. */
  readonly column: SmokeColumn;
  facing = new Quaternion();
  private fighting(p: { x: number; z: number } | undefined): boolean {
    if (!p) return false;
    for (const e of this.world.entities.iterate()) if (e.infected && e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 4) return true;
    return false;
  }
  private smokeAt = -1;
  private nextSmoke = 0;
  private vents: { p: Vec2; y: number }[] = [];
  private dry = false;
  private time = 0;
  constructor(private readonly world: SimWorld, private readonly host: LabAccidentHost, private readonly targets: LabAccidentTargets, private readonly anchor: (name: string) => Vec2 | undefined = () => undefined) {
    this.rng = new Rng(world.seed, 'lab-accident');
    this.column = new SmokeColumn();
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
    this.broken = false;
    this.glowFrom = this.time;
    const v = this.anchor('lab-smoke-vent') ?? this.anchor('lab-smoke-window') ?? p;
    this.focus = v;
    this.state.shattered = false;
    this.state.shake = 1;
    this.targets.windowGlass?.('bow', 0);
    this.vents = [{ p, y: 1.8 }];
    // Contained pressure wave: pale dust ring and glass leaving the window, nothing like a fireball.
    this.glassBurst(p);
    this.dust(p, 22);
    this.fireBurst(p);
    this.sparkAt = this.time + 1;
  }
  private fireBurst(p: Vec2): void {
    for (let i = 0; i < 18; i++) {
      const a = this.rng.next() * Math.PI * 2, sp = 2 + this.rng.next() * 3;
      this.host.particles.spawn(this.host.time, this.life(0.35 + this.rng.next() * 0.25), p.x, 1.6 + this.rng.next(), p.z, Math.cos(a) * sp, 0.5 + this.rng.next() * 2, Math.sin(a) * sp, 0.5 + this.rng.next() * 0.5, 0, FIRE, 0);
    }
  }
  private life(seconds: number): number { return this.dry ? 0.01 : seconds; }
  private glassBurst(p: Vec2): void {
    // Hard, opaque shards and dark debris thrown toward the forecourt (street-facing side), from the window and the front.
    const gate = this.anchor('lab-gate') ?? { x: p.x, z: p.z + 8 }, front = this.anchor('lab-exit-front') ?? p;
    for (const [src, glassN, darkN] of [[p, 12, 5], [front, 14, 6]] as [Vec2, number, number][]) {
      const dx0 = gate.x - src.x, dz0 = gate.z - src.z, len = Math.hypot(dx0, dz0) || 1, dx = dx0 / len, dz = dz0 / len;
      for (let i = 0; i < glassN + darkN; i++) this.column.spawnPiece(this.time, this.rng, src.x, 1.2 + this.rng.next() * 1.1, src.z, dx, dz, i < glassN);
    }
    for (let i = 0; i < 24; i++) {
      const a = this.rng.next() * Math.PI * 2, s = 1.5 + this.rng.next() * 3.5;
      this.host.particles.spawn(this.host.time, this.life(0.6 + this.rng.next() * 0.4), p.x, 1.4 + this.rng.next() * 0.8, p.z, Math.cos(a) * s, 1 + this.rng.next() * 2.5, Math.sin(a) * s, 0.1 + this.rng.next() * 0.08, 0, GLASS, 9.8);
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
    // Roof vent, the broken side window and the street-facing front: the front column climbs the facade inside the game camera.
    const front = this.anchor('lab-exit-front');
    this.vents = [vent && { p: vent, y: ROOF_Y }, window && { p: window, y: 1.8 }, front && { p: front, y: 2.4 }].filter((v): v is { p: Vec2; y: number } => !!v);
    if (!this.vents.length) this.vents = [{ p: this.at(event, 'lab-exit-window'), y: 1.8 }];
  }
  /** Infection puff: small sickly-green burst where an infected steps out. */
  private puff(p: Vec2): void {
    for (let i = 0; i < 10; i++)
      this.host.particles.spawn(this.host.time, this.life(0.5), p.x, 0.9, p.z, (this.rng.next() - 0.5) * 2, 0.4 + this.rng.next(), (this.rng.next() - 0.5) * 2, 0.12 + this.rng.next() * 0.1, 0, PUFF, -0.2);
  }
  /** Run each emit path once with instantly expiring particles so no first-use cost lands on the blast. */
  prewarm(): void {
    this.dry = true;
    try { const p = { x: 0, z: 0 }; this.glassBurst(p); this.dust(p, 14); this.fireBurst(p); this.puff(p); this.smoke(p); } finally { this.dry = false; this.column.reset(); }
  }
  /** Dark opaque puffs rising well above the roof, drifting with a light wind (separate sprite set, see labAccidentSmoke). */
  private smoke(p: Vec2, y = 2): void { if (!this.dry) this.column.spawnPuff(this.time, this.rng, p.x, y, p.z); }
  /** Advance by render seconds; call after Vfx.advance. */
  advance(seconds: number): void {
    this.time += seconds;
    const s = this.state;
    this.stepColumn(seconds);
    if (this.flickerFrom >= 0) {
      const t = this.time - this.flickerFrom;
      let level = 1;
      for (const step of this.flickerSteps) if (step.at <= t) level = step.level; else break;
      const done = t >= l1v2.accident.eventAtS.blast - l1v2.accident.eventAtS.flicker;
      s.light = done ? 1 : level;
      if (done) this.flickerFrom = -1;
      this.targets.windowLight?.(s.light);
    }
    if (this.glowFrom >= 0) {
      // Orange interior fire glow for ~1.7 s, then the windows stay dark and broken.
      const t = this.time - this.glowFrom;
      if (t >= 0.15 && t < 1.8) this.targets.windowFire?.(this.flashReduction ? 0.6 : 0.9 + 0.35 * Math.sin(t * 28));
      else if (t >= 1.8) { this.glowFrom = -1; this.broken = true; this.targets.windowGlass?.('shatter', 1); }
    }
    if (this.blastAt >= 0) {
      const t = this.time - this.blastAt;
      s.bow = Math.min(1, t / 0.12);
      if (!s.shattered) this.targets.windowGlass?.('bow', s.bow);
      if (t >= 0.15 && !s.shattered) s.shattered = true;
      const k = Math.max(0, 1 - t / blastShakeS);
      s.shake = k;
      s.flash = Math.max(0, 1 - t / 0.3) * (this.flashReduction ? 0.15 : 0.75);
      if (k > 0) this.targets.shake((this.flashReduction ? 0.05 : 0.3) * k * k);
      else { this.blastAt = -1; s.flash = 0; }
    } else if (s.shattered && this.time < this.sparkAt + 12) {
      // Blown windows: dark, with the odd weak spark of a failing light (never a strobe).
      const phase = (this.time - this.sparkAt) % 1.3;
      if (!this.flashReduction && phase < 0.12) { this.targets.windowFire?.(0.3); this.sparked = true; }
      else if (this.sparked) { this.sparked = false; this.targets.windowGlass?.('shatter', 1); }
    }
    if (this.sparkAt > 0 && this.time - (this.sparkAt - 1) < 6) {
      // Gentle story pull: ease in 0.6 s, hold 3 s, ease out 1 s toward the midpoint of courier and vent, weight 0.45.
      // Never while the player is fighting (an infected within 4 m): the weight eases to zero.
      const t = this.time - (this.sparkAt - 1), p = this.world.entities.get(1)?.transform;
      const base = Math.max(0, Math.min(1, t / 0.6, (4.6 - t) / 1)) * (this.flashReduction ? 0.2 : 0.45);
      this.fightFade += ((this.fighting(p) ? 0 : 1) - this.fightFade) * Math.min(1, seconds * 6);
      if (p) this.targets.camera?.((p.x + this.focus.x) / 2, (p.z + this.focus.z) / 2, base * this.fightFade);
    }
    if (this.smokeAt >= 0) {
      // The column persists as a landmark for the rest of the level.
      while (this.nextSmoke <= this.time) {
        for (const v of this.vents) this.smoke(v.p, v.y);
        this.nextSmoke += SMOKE_INTERVAL;
      }
    }
  }
  /** Steps the opaque puffs/shards; call from advance. */
  private stepColumn(seconds: number): void { this.column.advance(this.time, seconds, this.facing); }
  /** Full-screen flash strength 0..1 for the HUD flash overlay. */
  get flash(): number { return this.state.flash; }
  dispose(): void { for (const stop of this.stops) stop(); this.stops.length = 0; this.column.dispose(); }
}
