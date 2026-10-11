// Weather keyframes and seeded gusts adapt Bruno Simon Weather/YearCycles/Wind/Lightnings (MIT).
import { Rng } from '../../core/Rng';
import { weatherKinds, weatherPresets, weatherTimelines, type WeatherKey, type WeatherKind, type WeatherPreset } from '../../data/weather';
import type { SimWorld } from '../world/SimWorld';
export interface WeatherModifiers { noiseRadius: number; fireDuration: number; fireSpread: number; vehicleGrip: number; playerSpeed: number; infectedSight: number }
export type WeatherEvent =
  | { type: 'weather.gust'; tick: number; wind: { x: number; z: number }; strength: number }
  | { type: 'weather.lightning'; tick: number; position: { x: number; y: number; z: number }; thunderAt: number; revealed: number[] }
  | { type: 'weather.thunder'; tick: number; position: { x: number; y: number; z: number }; strikeTick: number };
export class WeatherSystem {
  kind: WeatherKind = 'clear';
  override: WeatherKind | null = null;
  private precipitationIntensity = 1;
  wetness = 0;
  accumulation = 0;
  gust = 0;
  readonly wind = { x: 1, z: .25 };
  rain = 0; fog = 0; flakes = 0; clouds = 0; windStrength = 0;
  snow = 0; ash = 0; haze = 0; windLines = 0; blend = 1;
  timeline: readonly WeatherKey[];
  readonly modifiers: WeatherModifiers = { noiseRadius: 1, fireDuration: 1, fireSpread: 1, vehicleGrip: 1, playerSpeed: 1, infectedSight: 1 };
  readonly reveals = new Map<number, number>();
  readonly tracks: { id: number; x: number; z: number; yaw: number; tick: number }[] = [];
  private readonly lastTrack = new Map<number, { x: number; z: number }>();
  private readonly rng: Rng;
  private nextGust = 120;
  private nextLightning = 180;
  private readonly thunder: { at: number; strikeTick: number; position: { x: number; y: number; z: number } }[] = [];
  powerRevision = 0;
  flashUntil = 0;
  lightning: { x: number; y: number; z: number } | null = null;
  constructor(private readonly world: SimWorld, readonly seed: number) { this.rng = new Rng(seed, 'weather'); this.timeline = weatherTimelines[world.scenario ?? ''] ?? [{ tick: 0, kind: 'clear' }]; this.configure(); }
  setOverride(kind: WeatherKind | null, intensity = 1): void {
    if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) throw new RangeError('Weather intensity must be 0..1');
    this.precipitationIntensity = intensity;
    if (kind !== null && !weatherKinds.includes(kind)) throw new RangeError('Unknown weather');
    this.override = kind; this.configure();
  }
  private configure(): void {
    let key = this.timeline[0] ?? { tick: 0, kind: 'clear' as const }, previous = key;
    for (const candidate of this.timeline) if (candidate.tick <= this.world.tick) { previous = key; key = candidate; }
    let kind = key.kind;
    // L6 exterior is story-position based: no snow/rain leaks into the tunnel.
    const district = this.world.scenario === 'L6' && !this.override ? this.world.districts?.districts.find(d => d.layout.anchors['night-exit']) : null;
    const localExit = district?.layout.anchors['night-exit'];
    const exit = localExit && district ? [localExit.position[0] + district.origin[0], localExit.position[2] + district.origin[1]] : null;
    const player = this.world.entities.get(1)?.transform;
    if (this.world.scenario === 'L6' && exit && player && Math.hypot(player.x - exit[0], player.z - exit[1]) < 20) kind = 'fog';
    this.kind = this.override ?? kind;
    const duration = (key.blend ?? 0) * 60;
    const t = this.override || kind !== key.kind || !duration ? 1 : Math.min(1, Math.max(0, (this.world.tick - key.tick) / duration));
    this.blend = t * t * (3 - 2 * t);
    const from = { ...weatherPresets[previous.kind], ...previous.preset };
    const to = this.override || kind !== key.kind ? weatherPresets[this.kind] : { ...weatherPresets[key.kind], ...key.preset };
    const mix = (a: number, b: number) => a + (b - a) * this.blend;
    this.rain = mix(from.rain, to.rain) * this.precipitationIntensity;
    this.flakes = mix(from.flakes, to.flakes) * this.precipitationIntensity;
    this.fog = mix(from.fog, to.fog); this.clouds = mix(from.clouds, to.clouds); this.windStrength = mix(from.wind, to.wind);
    const weight = (k: WeatherKind) => mix(Number(previous.kind === k), Number(this.kind === k));
    this.snow = weight('snow'); this.ash = weight('ash'); this.haze = weight('haze'); this.windLines = weight('wind');
    // Ash continues drifting as dusk fog rolls in.
    if (to.flakes && this.kind === 'fog') this.ash = 1;
    const modifiers = (k: WeatherKind, p: WeatherPreset): WeatherModifiers => ({ noiseRadius: p.rain ? .8 : 1, fireDuration: p.rain ? .6 : 1, fireSpread: p.rain ? .6 : p.wind > .3 ? 1.4 : 1, vehicleGrip: p.rain ? .85 : k === 'snow' ? .6 : p.flakes ? .9 : 1, playerSpeed: k === 'snow' ? .95 : 1, infectedSight: k === 'fog' ? .6 : k === 'thunderstorm' ? .85 : 1 });
    const before = modifiers(previous.kind, from), after = modifiers(this.kind, to);
    for (const name of Object.keys(after) as (keyof WeatherModifiers)[]) this.modifiers[name] = mix(before[name], after[name]);
  }
  /** Authored developer fixture; gameplay uses the campaign timeline by default. */
  setTimeline(keys: readonly WeatherKey[]): void { this.timeline = keys; this.override = null; this.configure(); }

  update(): void {
    this.configure();
    const tick = this.world.tick;
    this.wetness = this.rain ? Math.min(1, this.wetness + this.rain / 3600) : this.wetness * Math.pow(.5, 1 / 5400);
    this.accumulation = this.flakes ? Math.min(1, this.accumulation + this.flakes / 1800) : Math.max(0, this.accumulation - 1 / 7200);
    this.gust *= .99;
    if (tick >= this.nextGust) {
      this.nextGust = tick + 180 + Math.floor(this.rng.next() * 240);
      this.gust = this.windStrength * (.5 + this.rng.next());
      const angle = .25 + (this.rng.next() - .5) * .4;
      this.wind.x = Math.cos(angle); this.wind.z = Math.sin(angle);
      if (this.windStrength > .1) this.world.events.emit({ type: 'weather.gust', tick, wind: { ...this.wind }, strength: this.gust });
    }
    if (this.gust > .5 && this.world.props) for (const prop of this.world.props.items) {
      if (prop.metadata.class !== 'light' || prop.body.isFixed()) continue;
      const force = prop.body.mass() * this.gust * .12;
      prop.body.applyImpulse({ x: this.wind.x * force, y: 0, z: this.wind.z * force }, true);
    }
    if (this.kind === 'thunderstorm' && tick >= this.nextLightning) {
      this.nextLightning = tick + 300 + Math.floor(this.rng.next() * 600);
      const player = this.world.entities.get(1)?.transform ?? { x: 0, z: 0 };
      const angle = this.rng.next() * Math.PI * 2, distance = 20 + this.rng.next() * 100;
      this.strike({ x: player.x + Math.cos(angle) * distance, y: 0, z: player.z + Math.sin(angle) * distance });
    }
    for (let i = this.thunder.length - 1; i >= 0; i--) if (tick >= this.thunder[i].at) {
      const t = this.thunder.splice(i, 1)[0]; this.world.events.emit({ type: 'weather.thunder', tick, position: t.position, strikeTick: t.strikeTick });
    }
    for (const [id, until] of this.reveals) if (tick >= until) this.reveals.delete(id);
    if (this.flakes > 0) for (const e of this.world.entities.iterate()) {
      if ((e.id !== 1 && e.faction !== 'infected') || e.health.current <= 0 || e.hidden) continue;
      const last = this.lastTrack.get(e.id), at = e.transform;
      if (last && Math.hypot(last.x - at.x, last.z - at.z) < .45) continue;
      this.lastTrack.set(e.id, { x: at.x, z: at.z });
      this.tracks.push({ id: e.id, x: at.x, z: at.z, yaw: at.yaw, tick });
      if (this.tracks.length > 1024) this.tracks.shift();
    }
  }
  /** Shared strike entry for scripted tall-prop hits and deterministic fixtures. */
  strike(position: { x: number; y: number; z: number }, consequence?: 'fire' | 'blackout'): void {
    const tick = this.world.tick, player = this.world.entities.get(1)?.transform ?? { x: 0, z: 0 }, revealed: number[] = [];
    for (const e of this.world.entities.iterate()) if (e.faction === 'infected' && e.health.current > 0 && Math.hypot(e.transform.x - player.x, e.transform.z - player.z) <= 40) { this.reveals.set(e.id, tick + 30); revealed.push(e.id); }
    const thunderAt = tick + Math.round(Math.hypot(position.x - player.x, position.z - player.z) / 340 * 60);
    this.flashUntil = tick + 8; this.lightning = { ...position }; this.thunder.push({ at: thunderAt, position: { ...position }, strikeTick: tick });
    if (consequence === 'fire') this.world.hazards?.spawn('fire', position);
    if (consequence === 'blackout') { this.world.districts?.districts.forEach(d => d.decay.lights.splice(0)); this.powerRevision++; }
    this.world.events.emit({ type: 'weather.lightning', tick, position: { ...position }, thunderAt, revealed });
  }
  snapshot() { return { powerRevision: this.powerRevision, kind: this.kind, override: this.override, rain: this.rain, fog: this.fog, flakes: this.flakes, clouds: this.clouds, wetness: this.wetness, accumulation: this.accumulation, wind: { ...this.wind }, blend: this.blend, strength: this.windStrength + this.gust, gust: this.gust, flashUntil: this.flashUntil, lightning: this.lightning && { ...this.lightning }, modifiers: { ...this.modifiers }, reveals: [...this.reveals].map(([id, until]) => ({ id, until })), tracks: this.tracks.map(t => ({ ...t })), rng: this.rng.snapshot() }; }
}
