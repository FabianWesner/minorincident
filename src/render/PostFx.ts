// Adapted from folio-2025 Rendering.js / Passes/cheapDOF.js by Bruno Simon (MIT), commit 41046b5.
import { RenderPipeline, type Camera, type Scene, type WebGPURenderer } from 'three/webgpu';
import { pass, uv, uniform, mix } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { hashBlur } from 'three/addons/tsl/display/hashBlur.js';

/** HDR bloom; optional cheap tilt-shift restricted to the top/bottom 15%, never the play area. */
export class PostFx {
  readonly pipeline: RenderPipeline;
  readonly bloomEnabled = uniform(1);
  private readonly sharpOutput;
  private readonly blurredOutput;
  private readonly scenePass;
  private readonly bloomPass;
  constructor(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
    this.scenePass = pass(scene, camera); const source = this.scenePass.getTextureNode('output');
    this.bloomPass = bloom(source, 0.25, 0, 1);
    const strength = uv().y.sub(0.5).abs().smoothstep(0.35, 0.5);
    const blur = hashBlur(source, strength.mul(0.003), { repeats: 8, premultipliedAlpha: true });
    this.sharpOutput = source.add(this.bloomPass.mul(this.bloomEnabled));
    this.blurredOutput = mix(source, blur, strength).add(this.bloomPass.mul(this.bloomEnabled));
    this.pipeline = new RenderPipeline(renderer, this.sharpOutput);
  }
  setDof(enabled: boolean): void { this.pipeline.outputNode = enabled ? this.blurredOutput : this.sharpOutput; this.pipeline.needsUpdate = true; }
  render(): void { this.pipeline.render(); }
  dispose(): void { this.pipeline.dispose(); this.bloomPass.dispose(); this.scenePass.dispose(); }
}
