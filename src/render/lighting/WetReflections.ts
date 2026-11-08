import type { Camera, Node, TextureNode } from 'three/webgpu';
import { float, getNormalFromDepth, getViewPosition, rtt, uniform, uv, vec4 } from 'three/tsl';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { weatherSurface } from '../WeatherView';

/** Three's depth-buffer ray march on the existing directional puddle mask. High tier only.
 * Reconstructing normals avoids changing the world's material/MRT contracts. */
export class WetReflections {
  readonly enabled = uniform(1);
  readonly contribution: Node<'vec3'>;
  private readonly normals;
  readonly reflection;
  private active = false;
  private prepared = false;
  constructor(color: Node<'vec4'>, depth: TextureNode, camera: Camera) {
    const inverse = uniform(camera.projectionMatrixInverse), world = uniform(camera.matrixWorld);
    const normal = getNormalFromDepth(uv(), depth, inverse);
    const position = world.mul(vec4(getViewPosition(uv(), depth.r, inverse), 1));
    const worldNormal = world.mul(vec4(normal, 0));
    const pattern = position.x.mul(.65).sin().mul(position.z.mul(.5).sin()).mul(.5).add(.5);
    const wet = pattern.smoothstep(weatherSurface.wetness.oneMinus(), weatherSurface.wetness.oneMinus().add(.15))
      .mul(worldNormal.y.max(0).pow(8)).mul(weatherSurface.wetness.smoothstep(.3, .4));
    this.normals = rtt(vec4(normal, wet), null, null, { resolutionScale: .5 });
    // SSR also resamples the normal at hit UVs: retain the TextureNode rather than a swizzle.
    this.reflection = ssr(color, depth, this.normals as unknown as Node<'vec3'>, { camera, metalnessNode: this.normals.a, roughnessNode: float(0), binaryRefine: true });
    this.reflection.resolutionScale = .5;
    this.reflection.quality.value = .5;
    this.reflection.maxDistance.value = 15;
    this.reflection.thickness.value = .25;
    this.reflection.intensity.value = .8;
    // Skip the offscreen passes in dry scenes. Zero roughness samples the unblurred base mip.
    const normalsUpdate = this.normals.updateBefore.bind(this.normals);
    this.normals.updateBefore = frame => { if (this.active) return normalsUpdate(frame); };
    const reflectionUpdate = this.reflection.updateBefore.bind(this.reflection);
    this.reflection.updateBefore = frame => { if (this.active) return reflectionUpdate(frame); };
    this.contribution = this.reflection.rgb.mul(this.enabled).mul(weatherSurface.wetness.smoothstep(.3, .4));
  }
  update(): void {
    // Warm once behind the loading card, even in a dry level. Rain crossing .3
    // must not compile the ray-march shader for the first time during gameplay.
    this.active = !this.prepared || weatherSurface.wetness.value > .3 && this.enabled.value > 0;
    this.prepared = true;
  }
  snapshot() { return { active: this.active, passes: this.active ? 7 : 0, resolutionScale: .5, quality: this.reflection.quality.value }; }
  dispose(): void {
    (this.normals as typeof this.normals & { dispose(): void }).dispose();
    this.reflection.dispose();
  }
}
