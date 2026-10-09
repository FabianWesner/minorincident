// GPU precipitation wraps around the camera focus, following Bruno RainLines/Snow (MIT).
import { BufferAttribute, BufferGeometry, LineSegments, LineBasicNodeMaterial, DataTexture, FloatType, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RedFormat, Vector3 } from 'three/webgpu';
import { attribute, cameraPosition, cameraWorldMatrix, uv, Discard, dot, float, Fn, fract, mix, positionWorld, screenCoordinate, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Lighting } from './Lighting';
import type { View } from './View';

export const weatherSurface = {
  probe: uniform(0), wetness: uniform(0), accumulation: uniform(0), ash: uniform(0), fog: uniform(0), flash: uniform(0),
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
  private readonly wind = uniform(new Vector3());
  private readonly geometry: InstancedBufferGeometry;
  private readonly material: MeshBasicNodeMaterial;
  private readonly mesh: Mesh;
  private lastTrackTick = -1;
  private trackPixels = 0;
  private readonly boltGeometry = new BufferGeometry();
  private readonly boltMaterial = new LineBasicNodeMaterial({ color: '#c4deff', depthWrite: false });
  private readonly bolt = new LineSegments(this.boltGeometry, this.boltMaterial);
  private readonly stop: () => void;
  private lastKind = '';
  private lastPreset = '';
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
      lighting.field.addTransient(p, '#c4deff', 4, 40, .12);
    });
    const plane = new PlaneGeometry(.035, .65), g = this.geometry = new InstancedBufferGeometry();
    g.index = plane.index; for (const [key, value] of Object.entries(plane.attributes)) g.setAttribute(key, value); plane.dispose();
    const seeds = new Float32Array(20_000 * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
    g.setAttribute('seed', new InstancedBufferAttribute(seeds, 3));
    const seed = attribute('seed', 'vec3');
    const local = attribute('position', 'vec3').mul(vec3(this.flake.mul(4).add(1), this.flake.mul(-.85).add(1), 1));
    const speed = mix(16, .8, this.flake);
    const offset = vec3(fract(seed.x.add(this.clock.mul(this.wind.x).div(40))).sub(.5).mul(40), fract(seed.y.sub(this.clock.mul(speed).div(15))).mul(15), fract(seed.z.add(this.clock.mul(this.wind.z).div(40))).sub(.5).mul(40));
    this.material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: 2 });
    this.material.positionNode = cameraWorldMatrix.mul(vec4(local, 0)).xyz.add(offset).add(this.focus);
    this.material.colorNode = mix(vec3(.55, .72, .85), mix(vec3(.65), vec3(.62, .59, .57), weatherSurface.ash), this.flake);
    this.material.opacityNode = Fn(() => { Discard(precipitationKeep().not()); Discard(this.flake.greaterThan(.5).and(uv().sub(.5).length().greaterThan(.5))); return float(.65); })();
    this.mesh = new Mesh(g, this.material); this.mesh.frustumCulled = false; this.add(this.mesh);
    // Ensure the node builder sees a position attribute even on an empty tier.
    if (!g.getAttribute('position')) g.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  }
  update(view: View, tier: 'high' | 'low', reduced: boolean): void {
    const w = this.world.weather; if (!w) return;
    const player = this.world.entities.get(1)?.transform;
    if (player) weatherHero.value.set(player.x, player.y, player.z);
    this.focus.value.set(view.focus.x, 0, view.focus.z); this.clock.value = this.world.tick / 60;
    const snowfall = w.kind === 'snow' || w.kind === 'ash'; this.flake.value = snowfall ? 1 : 0;
    this.wind.value.set(w.wind.x * (w.gust + .2), 0, w.wind.z * (w.gust + .2));
    this.particles = Math.floor((tier === 'high' ? 20_000 : 6000) * Math.max(w.rain, w.flakes * .25));
    this.geometry.instanceCount = this.particles; this.mesh.visible = this.particles > 0;
    weatherSurface.wetness.value = w.wetness; weatherSurface.accumulation.value = w.accumulation; weatherSurface.ash.value = w.kind === 'ash' ? 1 : 0; weatherSurface.fog.value = w.fog;
    this.flash = this.world.tick < w.flashUntil ? (reduced ? .025 : .22) * (w.flashUntil - this.world.tick) / 8 : 0;
    weatherSurface.flash.value = this.flash; this.bolt.visible = this.flash > 0;
    if (w.kind !== this.lastKind || this.lighting.preset !== this.lastPreset) {
      this.lighting.set(this.lighting.preset); this.lastKind = w.kind; this.lastPreset = this.lighting.preset;
      this.lighting.intensity.value *= (1 - w.clouds * .4) * (snowfall ? .7 : 1);
      this.lighting.sun.shadow.radius = w.clouds > .5 ? 5 : 2;
    }
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
  dispose(): void { weatherRayDither.value = 1; this.stop(); this.boltGeometry.dispose(); this.boltMaterial.dispose(); this.geometry.dispose(); this.material.dispose(); this.clear(); weatherSurface.probe.value = weatherSurface.wetness.value = weatherSurface.accumulation.value = weatherSurface.fog.value = weatherSurface.flash.value = 0; (weatherSurface.tracks.image.data as Float32Array).fill(0); weatherSurface.tracks.needsUpdate = true; }
}
