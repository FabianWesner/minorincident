import { AdditiveBlending, BufferGeometry, Color, ConeGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three/webgpu';
import { attribute, cos, fract, normalView, positionGeometry, positionViewDirection, positionWorld, sin, uniform, uv, vec3 } from 'three/tsl';
import { Rng } from '../../core/Rng';
import { placedLights, type PlacedLight } from '../../data/placedLights';
import { lightPalette } from '../../data/lights';
import type { DistrictWorld } from '../../sim/world/DistrictWorld';
import type { LightPower } from '../../sim/lighting/LightPower';
import { weatherSurface } from '../WeatherView';
import { LampInsects } from '../AmbientLife';

/** Existing additive geometry path: soft spot volumes and wet-ground splats.
 * They read exactly the same fixed-tick anchor state as emissive meshes/pools. */
export class PracticalEffects extends Group {
  private lights: PlacedLight[] = [];
  private readonly beams: InstancedMesh;
  private readonly streaks: InstancedMesh;
  private readonly instanceMatrix = new Matrix4();
  private readonly instancePosition = new Vector3();
  private readonly instanceScale = new Vector3();
  private readonly instanceRotation = new Quaternion();
  private readonly axis = new Vector3(0, 1, 0);
  private readonly direction = new Vector3();
  private readonly color = new Color();
  private readonly insects = new LampInsects();
  /** Per-level lamp beam weight (look.beamStrength): night levels read their cones without extra draws. */
  readonly beamStrength = uniform(1);
  /** Per-frame beams of moving lamps (the driven vehicle's headlights), drawn in the same instanced cone draw. */
  private readonly dynamic: { position: Vector3; direction: Vector3; length: number; radius: number; color: Color }[] = [];
  private dynamicCount = 0;
  readonly motes = new BeamMotes();
  constructor() {
    super();
    const beam = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
    const edge = normalView.dot(positionViewDirection).abs().smoothstep(.03, .35);
    const groundFade = positionWorld.y.smoothstep(.02, .8);
    beam.colorNode = vec3(1); beam.opacityNode = edge.mul(uv().y.smoothstep(0, .2)).mul(groundFade).mul(this.beamStrength).mul(.015);
    this.beams = new InstancedMesh(new ConeGeometry(1, 1, 20, 1, true), beam, 128); this.beams.count = 0; this.beams.frustumCulled = false;
    const streak = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    const local = uv().sub(.5).mul(2);
    // Same directional wet mask as the production surface shader (E28), shared on both tiers.
    const pattern = positionWorld.x.mul(.65).sin().mul(positionWorld.z.mul(.5).sin()).mul(.5).add(.5);
    const wet = pattern.smoothstep(weatherSurface.wetness.oneMinus(), weatherSurface.wetness.oneMinus().add(.15));
    const ripple = positionWorld.x.mul(5).add(positionWorld.z.mul(.7).sin()).sin().mul(.25).add(.75);
    streak.colorNode = vec3(1); streak.opacityNode = local.x.abs().oneMinus().pow(2).mul(local.y.abs().oneMinus()).mul(wet).mul(ripple).mul(.7);
    const plane = new PlaneGeometry(1, 1); plane.rotateX(-Math.PI / 2);
    this.streaks = new InstancedMesh(plane, streak, 128); this.streaks.count = 0; this.streaks.frustumCulled = false;
    this.add(this.beams, this.streaks, this.insects, this.motes);
  }
  install(world: DistrictWorld): void { this.lights = placedLights(world); }
  /** A moving lamp's visible cone for this frame (cleared by `update`): apex at `position`, `length` m along `direction`. */
  pushBeam(position: Vector3, direction: Vector3, length: number, angleDeg: number, color: Color): void {
    const slot = this.dynamic[this.dynamicCount] ??= { position: new Vector3(), direction: new Vector3(), length: 0, radius: 0, color: new Color() };
    slot.position.copy(position); slot.direction.copy(direction).normalize(); slot.length = length; slot.radius = length * Math.tan(angleDeg * Math.PI / 360); slot.color.copy(color);
    this.dynamicCount++;
  }
  update(power: LightPower | null, practical: number, focus: { x: number; z: number }, low: boolean, insects = false, seconds = 0): void {
    let beams = 0, reflections = 0;
    const dynamic = this.dynamicCount; this.dynamicCount = 0;
    this.motes.update(practical > 0 && dynamic ? this.dynamic.slice(0, dynamic) : [], seconds, low);
    if (practical <= 0) { this.beams.count = this.streaks.count = 0; this.insects.update([], seconds, false); return; }
    for (let i = 0; i < dynamic && beams < 128; i++) {
      const b = this.dynamic[i];
      this.instancePosition.copy(b.position).addScaledVector(b.direction, b.length / 2);
      this.instanceRotation.setFromUnitVectors(this.axis, this.direction.copy(b.direction).negate()); this.instanceScale.set(b.radius, b.length, b.radius);
      this.beams.setMatrixAt(beams, this.instanceMatrix.compose(this.instancePosition, this.instanceRotation, this.instanceScale)); this.beams.setColorAt(beams++, this.color.copy(b.color).multiplyScalar(practical));
    }
    const nearby = this.lights.filter(light => (power ? power.isOn(light.id) : light.on) && Math.hypot(light.position[0] - focus.x, light.position[2] - focus.z) < 40).sort((a, b) => Math.hypot(a.position[0] - focus.x, a.position[2] - focus.z) - Math.hypot(b.position[0] - focus.x, b.position[2] - focus.z));
    this.insects.update(nearby, seconds, insects && !low);
    if (practical > 0) for (const light of nearby) {
      const anchor = light.anchor, [x, y, z] = light.position;
      this.color.set(lightPalette[anchor.color]).multiplyScalar(anchor.intensity * practical * .3);
      if (anchor.type === 'spot' && anchor.beam !== 'none' && beams < (low ? 6 : 128)) {
        const length = Math.min(anchor.range, (y - light.ground) / Math.max(.1, -light.direction[1])), radius = length * Math.tan((anchor.angle ?? 45) * Math.PI / 360);
        this.direction.fromArray(light.direction).normalize(); this.instancePosition.fromArray(light.position).addScaledVector(this.direction, length / 2);
        this.instanceRotation.setFromUnitVectors(this.axis, this.direction.clone().negate()); this.instanceScale.set(radius, length, radius);
        this.beams.setMatrixAt(beams, this.instanceMatrix.compose(this.instancePosition, this.instanceRotation, this.instanceScale)); this.beams.setColorAt(beams++, this.color);
      }
      if (anchor.reflect && reflections < 128) {
        this.instancePosition.set(x, light.ground + .045, z + 1.5); this.instanceRotation.identity(); this.instanceScale.set(1.2, 1, 5);
        this.streaks.setMatrixAt(reflections, this.instanceMatrix.compose(this.instancePosition, this.instanceRotation, this.instanceScale)); this.streaks.setColorAt(reflections++, this.color);
      }
    }
    for (const [mesh, count] of [[this.beams, beams], [this.streaks, reflections]] as const) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  }
  snapshot() { return { beams: this.beams.count, reflections: this.streaks.count, motes: this.motes.visible ? this.motes.drawn : 0 }; }
  dispose(): void { this.insects.dispose(); this.motes.dispose(); for (const mesh of [this.beams, this.streaks]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose(); } this.clear(); }
}

/** Dust and insects drifting through the driven vehicle's headlights (E31 addendum): one additive draw of tiny motes in the
 * beams' common volume, animated on the GPU; brightest near the lamps, fading with distance. Low tier draws a third. */
export class BeamMotes extends Mesh<BufferGeometry, MeshBasicNodeMaterial> {
  private readonly origin = uniform(new Vector3());
  private readonly forward = uniform(new Vector3(1, 0, 0));
  private readonly side = uniform(new Vector3(0, 0, 1));
  private readonly reach = uniform(12);
  private readonly spread = uniform(3);
  private readonly strength = uniform(0);
  private readonly clock = uniform(0);
  private readonly centre = new Vector3();
  private readonly ahead = new Vector3();
  static readonly count = 96;
  constructor() {
    const rng = new Rng(77, 'beam-motes'), positions: number[] = [], seeds: number[] = [];
    for (let i = 0; i < BeamMotes.count; i++) {
      const size = .018 + rng.next() * .022, seed = [rng.next(), rng.next() * 2 - 1, rng.next(), rng.next() * 6.283];
      positions.push(-size, 0, 0, size, 0, 0, 0, size * 1.6, 0);
      for (let v = 0; v < 3; v++) seeds.push(...seed);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('_mote', new Float32BufferAttribute(seeds, 4));
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending, fog: false });
    material.name = 'keep_beamMotes';
    super(geometry, material);
    const seed = attribute('_mote', 'vec4'), t = this.clock;
    // Each mote drifts slowly along the beam and wraps; a little wander so they read as dust and insects, not a grid.
    const along = fract(seed.x.add(t.mul(.045)).add(sin(t.mul(.7).add(seed.w)).mul(.02)));
    const lateral = seed.y.mul(along.mul(.85).add(.15)).add(sin(t.mul(1.3).add(seed.w.mul(2))).mul(.06));
    const height = seed.z.mul(along.mul(1.1).add(.5)).add(sin(t.mul(2.1).add(seed.w)).mul(.12)).add(.25);
    const wobble = vec3(cos(t.mul(5).add(seed.w.mul(3))), sin(t.mul(4.3).add(seed.w)), 0).mul(.012);
    material.positionNode = this.origin.add(this.forward.mul(along.mul(this.reach))).add(this.side.mul(lateral.mul(this.spread))).add(vec3(0, height, 0)).add(positionGeometry).add(wobble);
    // Near the lamps the beam is brightest; fade in over the first metre and out towards its end.
    const fade = along.smoothstep(0, .08).mul(along.oneMinus().pow(1.6));
    material.colorNode = vec3(1, .93, .78).mul(2.4);
    material.opacityNode = fade.mul(this.strength).mul(sin(t.mul(9).add(seed.w.mul(7))).mul(.25).add(.75));
    this.name = 'beam-motes'; this.frustumCulled = false; this.visible = false; this.renderOrder = 3;
  }
  get drawn(): number { return this.geometry.drawRange.count === Infinity ? BeamMotes.count : this.geometry.drawRange.count / 3; }
  update(beams: readonly { position: Vector3; direction: Vector3; length: number }[], seconds: number, low: boolean): void {
    this.clock.value = seconds;
    this.visible = beams.length > 0;
    if (!beams.length) return;
    this.centre.set(0, 0, 0); this.ahead.set(0, 0, 0); let length = 0;
    for (const b of beams) { this.centre.add(b.position); this.ahead.add(b.direction); length += b.length; }
    this.centre.multiplyScalar(1 / beams.length); this.ahead.y = 0; this.ahead.normalize(); length /= beams.length;
    // Start just ahead of the lamps, at the ground under them (heights are added in the shader).
    this.origin.value.set(this.centre.x + this.ahead.x * .3, this.centre.y - 1.05, this.centre.z + this.ahead.z * .3);
    this.forward.value.copy(this.ahead); this.side.value.set(-this.ahead.z, 0, this.ahead.x);
    this.reach.value = length * .9; this.spread.value = 1.4 + length * .22; this.strength.value = 1;
    this.geometry.setDrawRange(0, (low ? BeamMotes.count / 3 : BeamMotes.count) * 3);
  }
  dispose(): void { this.geometry.dispose(); this.material.dispose(); }
}
