import { AdditiveBlending, Color, ConeGeometry, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three/webgpu';
import { normalView, positionViewDirection, positionWorld, uniform, uv, vec3 } from 'three/tsl';
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
    this.add(this.beams, this.streaks, this.insects);
  }
  install(world: DistrictWorld): void { this.lights = placedLights(world); }
  update(power: LightPower | null, practical: number, focus: { x: number; z: number }, low: boolean, insects = false, seconds = 0): void {
    let beams = 0, reflections = 0;
    if (practical <= 0) { this.beams.count = this.streaks.count = 0; this.insects.update([], seconds, false); return; }
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
  snapshot() { return { beams: this.beams.count, reflections: this.streaks.count }; }
  dispose(): void { this.insects.dispose(); for (const mesh of [this.beams, this.streaks]) { mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); mesh.dispose(); } this.clear(); }
}
