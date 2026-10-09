// GPU precipitation wraps around the camera focus, following Bruno RainLines/Snow (MIT).
import { BufferAttribute, BufferGeometry, LineSegments, LineBasicNodeMaterial, DataTexture, FloatType, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RedFormat, SphereGeometry, Vector3 } from 'three/webgpu';
import { attribute, cameraPosition, cameraWorldMatrix, uv, Discard, dot, Fn, fract, mix, positionWorld, screenCoordinate, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { timeOfDay } from '../data/timeOfDay';
import { weatherPresets } from '../data/weather';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Lighting } from './Lighting';
import type { View } from './View';

export const weatherSurface = {
  clouds: uniform(0), windStrength: uniform(1), probe: uniform(0), wetness: uniform(0), accumulation: uniform(0), ash: uniform(0), fog: uniform(0), flash: uniform(0),
  tracks: new DataTexture(new Float32Array(1024 * 1024), 1024, 1024, RedFormat, FloatType),
};
weatherSurface.tracks.needsUpdate = true;
export const trackMask = () => texture(weatherSurface.tracks, fract(positionWorld.xz.div(64).add(.5))).r;
/** Actual 6m world-space ray distance; all precipitation shares this ordered dither. */
export const weatherRayDither = uniform(1);
export const weatherHero = uniform(new Vector3());
export const precipitationKeep = () => {
  const ray = weatherHero.sub(cameraPosition), t = dot(positionWorld.sub(cameraPosition), ray).div(dot(ray, ray)).clamp(0, 1);
  const distance = positionWorld.sub(cameraPosition.add(ray.mul(t))).length();
  const keep = mix(.08, 1, distance.div(6).clamp(0, 1));
  const dither = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  return mix(1, keep, weatherRayDither).greaterThan(dither);
};
export class WeatherView extends Group {
  private readonly clock = uniform(0);
  private readonly focus = uniform(new Vector3());
  private readonly flake = uniform(0);
  private readonly windLine = uniform(0);
  private readonly wind = uniform(new Vector3());
  private readonly geometry: InstancedBufferGeometry;
  private readonly material: MeshBasicNodeMaterial;
  private readonly mesh: Mesh;
  private readonly ripples: Mesh;
  private readonly rippleGeometry: InstancedBufferGeometry;
  private readonly rippleMaterial: MeshBasicNodeMaterial;
  private readonly breathGeometry = new SphereGeometry(.1, 8, 6);
  private readonly breathMaterial = new MeshBasicNodeMaterial({ color: 0xb8c8d9, transparent: true, opacity: .12, depthWrite: false });
  private readonly breath = new Mesh(this.breathGeometry, this.breathMaterial);
  private reducedFlash = false;
  private lastTrackTick = -1;
  private trackPixels = 0;
  private readonly boltGeometry = new BufferGeometry();
  private readonly boltMaterial = new LineBasicNodeMaterial({ color: '#c4deff', depthWrite: false });
  private readonly bolt = new LineSegments(this.boltGeometry, this.boltMaterial);
  private readonly stop: () => void;
  particles = 0;
  flash = 0;
  constructor(private readonly world: SimWorld, private readonly lighting: Lighting) {
    super(); this.name = 'weather';
    this.boltGeometry.setAttribute('position', new BufferAttribute(new Float32Array(18 * 3), 3)); this.bolt.frustumCulled = false; this.bolt.visible = false; this.add(this.bolt);
    this.stop = world.events.on('weather.lightning', event => {
      if (event.type !== 'weather.lightning') return;
      const a = this.boltGeometry.getAttribute('position') as BufferAttribute, p = event.position;
      for (let i = 0; i < 9; i++) { const y0 = i * 1.8, y1 = (i + 1) * 1.8; a.setXYZ(i * 2, p.x + Math.sin(i * 5.3) * .5, p.y + y0, p.z); a.setXYZ(i * 2 + 1, p.x + Math.sin((i + 1) * 5.3) * .5, p.y + y1, p.z); }
      a.needsUpdate = true;
      lighting.field.addTransient(p, '#c4deff', this.reducedFlash ? .25 : 4, 40, .12);
    });
    const plane = new PlaneGeometry(.012, .35), g = this.geometry = new InstancedBufferGeometry();
    g.index = plane.index; for (const [key, value] of Object.entries(plane.attributes)) g.setAttribute(key, value); plane.dispose();
    const seeds = new Float32Array(20_000 * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
    g.setAttribute('seed', new InstancedBufferAttribute(seeds, 3));
    const seed = attribute('seed', 'vec3');
    const local = attribute('position', 'vec3').mul(vec3(this.flake.mul(12).add(1), this.flake.mul(-.8).add(1), 1));
    const speed = mix(mix(16, .8, this.flake), 0, this.windLine);
    const offset = vec3(fract(seed.x.add(this.clock.mul(this.wind.x).div(40))).sub(.5).mul(40), fract(seed.y.sub(this.clock.mul(speed).div(15))).mul(mix(15, 2, this.windLine)), fract(seed.z.add(this.clock.mul(this.wind.z).div(40))).sub(.5).mul(40));
    this.material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: 2 });
    const billboard = cameraWorldMatrix.mul(vec4(local, 0)).xyz;
    this.material.positionNode = mix(billboard, cameraWorldMatrix.mul(vec4(local.x, 0, 0, 0)).xyz.add(this.wind.mul(local.y).mul(5)), this.windLine).add(offset).add(this.focus);
    this.material.colorNode = mix(vec3(.55, .72, .85), mix(vec3(.65), vec3(.62, .59, .57), weatherSurface.ash), this.flake);
    this.material.opacityNode = Fn(() => { Discard(precipitationKeep().not()); Discard(this.flake.greaterThan(.5).and(uv().sub(.5).length().greaterThan(.5))); return mix(mix(.14, .5, this.flake), .08, this.windLine); })();
    this.mesh = new Mesh(g, this.material); this.mesh.frustumCulled = false; this.add(this.mesh);
    this.rippleGeometry = new InstancedBufferGeometry(); this.rippleGeometry.index = g.index;
    for (const [key, value] of Object.entries(g.attributes)) this.rippleGeometry.setAttribute(key, value);
    this.rippleMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: 2 });
    const phase = fract(this.clock.mul(2).add(seed.y)), size = phase.mul(.35).add(.05);
    this.rippleMaterial.positionNode = vec3(seed.x.sub(.5).mul(40).add(this.focus.x).add(uv().x.sub(.5).mul(size)), .035, seed.z.sub(.5).mul(40).add(this.focus.z).add(uv().y.sub(.5).mul(size)));
    this.rippleMaterial.colorNode = vec3(.35, .5, .65);
    this.rippleMaterial.opacityNode = Fn(() => { Discard(uv().sub(.5).length().sub(.38).abs().greaterThan(.05)); return phase.oneMinus().mul(.25); })();
    this.ripples = new Mesh(this.rippleGeometry, this.rippleMaterial); this.ripples.frustumCulled = false; this.ripples.name = 'rain-splashes'; this.add(this.ripples);
    this.breath.name = 'snow-breath'; this.breath.visible = false; this.add(this.breath);
    // Ensure the node builder sees a position attribute even on an empty tier.
    if (!g.getAttribute('position')) g.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  }
  update(view: View, tier: 'high' | 'low', reduced: boolean): void {
    const w = this.world.weather; if (!w) return; this.reducedFlash = reduced;
    weatherSurface.windStrength.value = w.kind === 'none' ? 0 : 1 + Math.max(0, weatherPresets[w.kind].wind - .12) * 1.5 + w.gust;
    const player = this.world.entities.get(1)?.transform;
    if (player) weatherHero.value.set(player.x, player.y, player.z);
    this.focus.value.set(view.focus.x, 0, view.focus.z); this.clock.value = this.world.tick / 60;
    this.windLine.value = w.kind === 'wind' ? 1 : 0;
    const snowfall = w.kind === 'snow' || w.kind === 'ash'; this.flake.value = snowfall ? 1 : 0;
    this.wind.value.set(w.wind.x * (w.gust + .2), 0, w.wind.z * (w.gust + .2));
    this.particles = Math.floor((tier === 'high' ? 20_000 : 6000) * Math.max(w.rain, w.flakes * .25, this.windLine.value * .025));
    const rippleCount = w.rain ? Math.floor((tier === 'high' ? 200 : 60) * w.rain) : 0;
    this.ripples.visible = rippleCount > 0; this.rippleGeometry.instanceCount = rippleCount;
    this.geometry.instanceCount = this.particles - rippleCount; this.mesh.visible = this.particles > 0;
    this.breath.visible = w.kind === 'snow' && !!player;
    if (player && this.breath.visible) { const cycle = this.world.tick % 120 / 120; this.breath.position.set(player.x + Math.cos(player.yaw) * (.25 + cycle * .3), player.y + 1.45 + cycle * .2, player.z + Math.sin(player.yaw) * (.25 + cycle * .3)); this.breath.scale.setScalar(.4 + cycle * 2); this.breathMaterial.opacity = .18 * (1 - cycle); }
    weatherSurface.wetness.value = w.wetness; weatherSurface.accumulation.value = w.accumulation; weatherSurface.ash.value = w.kind === 'ash' ? 1 : 0; weatherSurface.fog.value = w.fog;
    this.flash = this.world.tick < w.flashUntil ? (reduced ? .025 : .22) * (w.flashUntil - this.world.tick) / 8 : 0;
    weatherSurface.flash.value = this.flash; this.bolt.visible = this.flash > 0;
    // Reapply from authored intensity rather than multiplying the previous frame;
    // Scene Lab and live look controls can reset the lighting after assembly.
    const look = this.lighting.look, preset = this.lighting.preset;
    const baseIntensity = look.has('sunIntensity') || preset === 'L1' ? look.values.sunIntensity : timeOfDay[preset].intensity;
    this.lighting.intensity.value = baseIntensity * (1 - w.clouds * .4) * (snowfall ? .7 : 1);
    this.lighting.sun.intensity = this.lighting.intensity.value;
    this.lighting.sun.shadow.radius = w.clouds > .5 ? Math.max(5, look.values.shadowRadius) : look.values.shadowRadius;
    weatherSurface.clouds.value = w.clouds;
    const trackTick = w.tracks.at(-1)?.tick ?? -1;
    if (trackTick !== this.lastTrackTick) {
      const data = weatherSurface.tracks.image.data as Float32Array; data.fill(0); this.trackPixels = 0;
      for (const t of w.tracks) {
        const x = Math.floor(((t.x / 64 + .5) % 1 + 1) % 1 * 1024), z = Math.floor(((t.z / 64 + .5) % 1 + 1) % 1 * 1024);
        for (let dz = -2; dz <= 2; dz++) for (let dx = -1; dx <= 1; dx++) {
          const ellipse = dx * dx + dz * dz / 4;
          if (ellipse <= 1) { const index = ((z + dz + 1024) % 1024) * 1024 + ((x + dx + 1024) % 1024); if (!data[index]) this.trackPixels++; data[index] = 1 - ellipse * .3; }
        }
      }
      weatherSurface.tracks.needsUpdate = true; this.lastTrackTick = w.tracks.at(-1)?.tick ?? -1;
    }
  }
  snapshot() { return { particles: this.particles, flash: this.flash, rayDitherRadius: 6, wetness: weatherSurface.wetness.value, accumulation: weatherSurface.accumulation.value, tracks: this.world.weather?.tracks.length ?? 0, trackPixels: this.trackPixels }; }
  dispose(): void { weatherSurface.clouds.value = 0; weatherRayDither.value = weatherSurface.windStrength.value = 1; this.stop(); this.boltGeometry.dispose(); this.boltMaterial.dispose(); this.rippleGeometry.dispose(); this.rippleMaterial.dispose(); this.breathGeometry.dispose(); this.breathMaterial.dispose(); this.geometry.dispose(); this.material.dispose(); this.clear(); weatherSurface.probe.value = weatherSurface.wetness.value = weatherSurface.accumulation.value = weatherSurface.fog.value = weatherSurface.flash.value = 0; (weatherSurface.tracks.image.data as Float32Array).fill(0); weatherSurface.tracks.needsUpdate = true; }
}
