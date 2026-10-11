// GPU precipitation wraps around the camera focus, following Bruno RainLines/Snow (MIT).
import { Color, BufferAttribute, BufferGeometry, LineSegments, LineBasicNodeMaterial, DataTexture, FloatType, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RedFormat, SphereGeometry, Vector3 } from 'three/webgpu';
import { attribute, cameraPosition, cameraWorldMatrix, uv, Discard, dot, Fn, fract, mix, positionWorld, renderGroup, screenCoordinate, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { timeOfDay } from '../data/timeOfDay';
import { weatherPresets } from '../data/weather';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Lighting } from './Lighting';
import type { View } from './View';

/** Surface graph flags; state changes reuse Three node materials and cached output graphs. */
export const weatherMaterialFlags = { clouds: 1, wet: 2, accumulation: 4, fog: 8, flash: 16, field: 32, hero: 64, probeShift: 7 } as const;
export const weatherSurface = {
  // Global weather values are shared across world materials: update once per render,
  // rather than checking the same values again for every building/prop draw.
  clouds: uniform(0).setGroup(renderGroup), windStrength: uniform(1).setGroup(renderGroup), probe: uniform(0).setGroup(renderGroup), wetness: uniform(0).setGroup(renderGroup), accumulation: uniform(0).setGroup(renderGroup), ash: uniform(0).setGroup(renderGroup), fog: uniform(0).setGroup(renderGroup), flash: uniform(0).setGroup(renderGroup),
  tracks: new DataTexture(new Float32Array(1024 * 1024), 1024, 1024, RedFormat, FloatType),
};
weatherSurface.tracks.needsUpdate = true;
export const trackMask = () => texture(weatherSurface.tracks, fract(positionWorld.xz.div(64).add(.5))).r;
/** Actual 6m world-space ray distance; all precipitation shares this ordered dither. */
export const weatherRayDither = uniform(1).setGroup(renderGroup);
export const weatherHero = uniform(new Vector3()).setGroup(renderGroup);
export const precipitationKeep = () => {
  const ray = weatherHero.sub(cameraPosition), t = dot(positionWorld.sub(cameraPosition), ray).div(dot(ray, ray)).clamp(0, 1);
  const distance = positionWorld.sub(cameraPosition.add(ray.mul(t))).length();
  const keep = mix(.08, 1, distance.div(6).clamp(0, 1));
  const dither = fract(fract(dot(screenCoordinate.xy.floor(), vec2(.06711056, .00583715))).mul(52.9829189));
  return mix(1, keep, weatherRayDither).greaterThan(dither);
};
export class WeatherView extends Group {
  private readonly cloudSky = new Color('#8a949e');
  private readonly clock = uniform(0);
  private readonly focus = uniform(new Vector3());
  private readonly flake = uniform(0);
  private readonly haze = uniform(0);
  private readonly precipitation = uniform(0);
  private readonly rain = uniform(0);
  private readonly windLine = uniform(0);
  private readonly wind = uniform(new Vector3());
  private readonly geometry: InstancedBufferGeometry;
  private readonly material: MeshBasicNodeMaterial;
  private readonly mesh: Mesh;
  private readonly ripples: Mesh;
  private readonly rippleGeometry: InstancedBufferGeometry;
  private readonly rippleMaterial: MeshBasicNodeMaterial;
  private readonly shaftGeometry = new PlaneGeometry(2, 16);
  private readonly shaftMaterial = new MeshBasicNodeMaterial({ color: '#ffd591', transparent: true, depthWrite: false, side: 2 });
  private readonly shafts = new Group();
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
    // Soft depth-tested cards use the same inexpensive mesh path as precipitation;
    // no screen-space pass or additional shadow map is needed for golden haze.
    this.shaftMaterial.opacityNode = uv().x.sub(.5).abs().mul(2).oneMinus().pow(2).mul(uv().y.smoothstep(0, .2)).mul(uv().y.smoothstep(1, .7)).mul(.16).mul(this.haze);
    for (let i = 0; i < 3; i++) { const shaft = new Mesh(this.shaftGeometry, this.shaftMaterial); shaft.frustumCulled = false; this.shafts.add(shaft); }
    this.shafts.name = 'golden-haze-shafts'; this.shafts.visible = false; this.add(this.shafts);
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
    const local = attribute('position', 'vec3').mul(vec3(this.flake.mul(4).add(1), this.flake.mul(-.88).add(1), 1));
    const speed = mix(mix(16, .8, this.flake), 0, this.windLine);
    const offset = vec3(fract(seed.x.add(this.clock.mul(this.wind.x).div(40))).sub(.5).mul(40), fract(seed.y.sub(this.clock.mul(speed).div(15))).mul(mix(15, 2, this.windLine)), fract(seed.z.add(this.clock.mul(this.wind.z).div(40))).sub(.5).mul(40));
    this.material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: 2 });
    const billboard = cameraWorldMatrix.mul(vec4(local, 0)).xyz;
    this.material.positionNode = mix(billboard, cameraWorldMatrix.mul(vec4(local.x, 0, 0, 0)).xyz.add(this.wind.mul(local.y).mul(5)), this.windLine).add(offset).add(this.focus);
    this.material.colorNode = mix(vec3(.55, .72, .85), mix(vec3(.65), vec3(.62, .59, .57), weatherSurface.ash), this.flake);
    this.material.opacityNode = Fn(() => { Discard(precipitationKeep().not()); Discard(this.flake.greaterThan(.5).and(uv().sub(.5).length().greaterThan(.5))); return mix(mix(.14, .5, this.flake), .08, this.windLine).mul(this.precipitation); })();
    this.mesh = new Mesh(g, this.material); this.mesh.frustumCulled = false; this.add(this.mesh);
    this.rippleGeometry = new InstancedBufferGeometry(); this.rippleGeometry.index = g.index;
    for (const [key, value] of Object.entries(g.attributes)) this.rippleGeometry.setAttribute(key, value);
    this.rippleMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: 2 });
    const phase = fract(this.clock.mul(2).add(seed.y)), size = phase.mul(.35).add(.05);
    this.rippleMaterial.positionNode = vec3(seed.x.sub(.5).mul(40).add(this.focus.x).add(uv().x.sub(.5).mul(size)), .035, seed.z.sub(.5).mul(40).add(this.focus.z).add(uv().y.sub(.5).mul(size)));
    this.rippleMaterial.colorNode = vec3(.35, .5, .65);
    this.rippleMaterial.opacityNode = Fn(() => { Discard(uv().sub(.5).length().sub(.38).abs().greaterThan(.05)); return phase.oneMinus().mul(.25).mul(this.rain); })();
    this.ripples = new Mesh(this.rippleGeometry, this.rippleMaterial); this.ripples.frustumCulled = false; this.ripples.name = 'rain-splashes'; this.add(this.ripples);
    this.breath.name = 'snow-breath'; this.breath.visible = false; this.add(this.breath);
    // Ensure the node builder sees a position attribute even on an empty tier.
    if (!g.getAttribute('position')) g.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  }
  update(view: View, tier: 'high' | 'low', reduced: boolean): void {
    const w = this.world.weather; if (!w) return; this.reducedFlash = reduced;
    weatherSurface.windStrength.value = w.kind === 'none' ? 0 : 1 + Math.max(0, w.windStrength - .12) * 1.5 + w.gust;
    this.shafts.visible = w.haze > 0; this.haze.value = w.haze;
    if (this.shafts.visible) this.shafts.children.forEach((shaft, i) => {
      shaft.position.set(view.focus.x + (i - 1) * 6, 6, view.focus.z - 5 + i * 2);
      shaft.quaternion.copy(view.camera.quaternion); shaft.rotateZ(-.5);
    });
    const player = this.world.entities.get(1)?.transform;
    if (player) weatherHero.value.set(player.x, player.y, player.z);
    this.focus.value.set(view.focus.x, 0, view.focus.z); this.clock.value = this.world.tick / 60;
    this.windLine.value = w.windLines;
    this.flake.value = w.flakes > 0 ? w.flakes / Math.max(.000001, w.flakes + w.rain) : 0;
    this.wind.value.set(w.wind.x * (w.gust + .2), 0, w.wind.z * (w.gust + .2));
    this.particles = Math.floor((tier === 'high' ? 20_000 : 6000) * Math.max(w.rain, w.flakes * .25, this.windLine.value * .025));
    const rippleCount = w.rain ? Math.floor((tier === 'high' ? 200 : 60) * w.rain) : 0;
    const future = !w.override && w.timeline.some(key => { const p = { ...weatherPresets[key.kind], ...key.preset }; return p.rain > 0 || p.flakes > 0 || key.kind === 'wind'; });
    const futureRain = !w.override && w.timeline.some(key => (key.preset?.rain ?? weatherPresets[key.kind].rain) > 0);
    this.precipitation.value = this.particles > 0 ? 1 : 0; this.rain.value = w.rain;
    // Two transparent instances warm Metal's instanced draw path before the first flake/drop.
    this.ripples.visible = rippleCount > 0 || futureRain; this.rippleGeometry.instanceCount = Math.max(futureRain ? 2 : 0, rippleCount);
    this.geometry.instanceCount = Math.max(future ? 2 : 0, this.particles - rippleCount); this.mesh.visible = this.particles > 0 || future;
    this.breath.visible = w.snow > 0 && !!player;
    if (player && this.breath.visible) { const cycle = this.world.tick % 120 / 120; this.breath.position.set(player.x + Math.cos(player.yaw) * (.25 + cycle * .3), player.y + 1.45 + cycle * .2, player.z + Math.sin(player.yaw) * (.25 + cycle * .3)); this.breath.scale.setScalar(.4 + cycle * 2); this.breathMaterial.opacity = .18 * (1 - cycle) * w.snow; }
    weatherSurface.wetness.value = w.wetness; weatherSurface.accumulation.value = w.accumulation; weatherSurface.ash.value = w.ash; weatherSurface.fog.value = w.fog;
    this.flash = this.world.tick < w.flashUntil ? (reduced ? .025 : .22) * (w.flashUntil - this.world.tick) / 8 : 0;
    weatherSurface.flash.value = this.flash; this.bolt.visible = this.flash > 0;
    // Reapply from authored intensity rather than multiplying the previous frame;
    // Scene Lab and live look controls can reset the lighting after assembly.
    const look = this.lighting.look, preset = this.lighting.preset;
    const baseIntensity = look.has('sunIntensity') || preset === 'L1' ? look.values.sunIntensity : timeOfDay[preset].intensity;
    this.lighting.intensity.value = baseIntensity * this.lighting.gloom * (1 - w.clouds * .4) * (1 - w.snow * .3);
    this.lighting.sun.intensity = this.lighting.intensity.value;
    this.lighting.sun.shadow.radius = look.values.shadowRadius + (Math.max(5, look.values.shadowRadius) - look.values.shadowRadius) * w.clouds;
    const authored = timeOfDay[preset], values = look.values;
    this.lighting.fogA.value.set(look.has('fog') && !look.has('fogA') ? values.fog : look.has('sky') && !look.has('fogA') ? values.sky : look.has('fogA') || preset === 'L1' ? values.fogA : authored.sky).lerp(this.cloudSky, w.clouds * .35);
    this.lighting.fogB.value.set(look.has('fog') && !look.has('fogB') ? values.fog : look.has('fogB') || preset === 'L1' ? values.fogB : authored.fog).lerp(this.cloudSky, w.clouds * .2);
    weatherSurface.clouds.value = w.clouds;
    const flags = weatherMaterialFlags;
    // Compile the union at level load, so a scripted blend changes uniforms only.
    let scriptedFeatures = 0;
    if (!w.override) for (const key of w.timeline) {
      const p = { ...weatherPresets[key.kind], ...key.preset };
      scriptedFeatures |= (p.clouds ? flags.clouds : 0) | (p.rain ? flags.wet : 0) | (p.flakes ? flags.accumulation : 0) | (p.fog ? flags.fog : 0) | (key.kind === 'thunderstorm' ? flags.flash : 0);
    }
    this.lighting.setWeatherMode(scriptedFeatures | (w.clouds > 0 ? flags.clouds : 0) | (w.rain > 0 || w.wetness > .3 ? flags.wet : 0) | (w.flakes > 0 || w.accumulation > 0 ? flags.accumulation : 0) | (w.fog > 0 ? flags.fog : 0) | (w.kind === 'thunderstorm' || this.flash > 0 ? flags.flash : 0) | (weatherSurface.probe.value << flags.probeShift));
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
  dispose(): void { weatherSurface.clouds.value = 0; weatherRayDither.value = weatherSurface.windStrength.value = 1; this.stop(); this.boltGeometry.dispose(); this.boltMaterial.dispose(); this.rippleGeometry.dispose(); this.rippleMaterial.dispose(); this.breathGeometry.dispose(); this.breathMaterial.dispose(); this.shaftGeometry.dispose(); this.shaftMaterial.dispose(); this.geometry.dispose(); this.material.dispose(); this.clear(); weatherSurface.probe.value = weatherSurface.wetness.value = weatherSurface.accumulation.value = weatherSurface.fog.value = weatherSurface.flash.value = 0; (weatherSurface.tracks.image.data as Float32Array).fill(0); weatherSurface.tracks.needsUpdate = true; }
}
