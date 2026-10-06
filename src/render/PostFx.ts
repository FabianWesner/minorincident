import { qualityBudgets, type QualityTier } from '../core/Quality';
// Adapted from Bruno Simon folio-2025 Rendering.js / Passes/cheapDOF.js (MIT).
import { RenderPipeline, type Camera, type Scene, type WebGPURenderer, type RenderTarget } from 'three/webgpu';
import { pass, uv, uniform, mix, vec2, rtt } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { hashBlur } from 'three/addons/tsl/display/hashBlur.js';
import { worldLook } from '../data/worldLook';

/** HDR bloom, soft vignette and optional miniature blur; central 40% stays sharp. */
export class PostFx {
  readonly pipeline: RenderPipeline;
  readonly bloomEnabled = uniform(1);
  private readonly sharpOutput;
  private readonly blurredOutput;
  private readonly scenePass;
  private readonly lowBlur;
  private readonly bloomPass;
  constructor(renderer: WebGPURenderer, scene: Scene, camera: Camera, tier: QualityTier = 'high') {
    this.scenePass = pass(scene, camera); const source = this.scenePass.getTextureNode('output');
    this.bloomPass = bloom(source, 0.25, 0, 1);
    this.tier = tier;
    (this.bloomPass as typeof this.bloomPass & { _nMips: number })._nMips = qualityBudgets[tier].bloomMips;
    // Current Three composites all five texture slots; inactive mips contribute zero.
    this.bloomPass.bloomTintColors.forEach((color, i) => color.setScalar(i < qualityBudgets[tier].bloomMips ? 1 : 0));
    const protectedArea = uv().sub(.5).div(vec2(.18, .35)).length().smoothstep(1, 1.3);
    const strength = uv().y.sub(0.5).abs().smoothstep(worldLook.dofStart, worldLook.dofEnd).mul(protectedArea);
    const blur = hashBlur(source, strength.mul(worldLook.dofAmount), { repeats: tier === 'high' ? 18 : 6, premultipliedAlpha: true });
    this.lowBlur = tier === 'low' ? rtt(blur, null, null, { resolutionScale: .5 }) : null;
    const vignette = uv().sub(.5).length().smoothstep(.25, .7).mul(worldLook.vignette).oneMinus();
    this.sharpOutput = source.add(this.bloomPass.mul(this.bloomEnabled)).mul(vignette);
    this.blurredOutput = mix(source, this.lowBlur ?? blur, strength).add(this.bloomPass.mul(this.bloomEnabled)).mul(vignette);
    this.pipeline = new RenderPipeline(renderer, this.sharpOutput);
  }
  private tier: QualityTier = 'high';
  setDof(enabled: boolean): void { this.pipeline.outputNode = enabled ? this.blurredOutput : this.sharpOutput; this.pipeline.needsUpdate = true; }
  snapshot() { return { bloomMips: qualityBudgets[this.tier].bloomMips, dof: this.pipeline.outputNode === this.blurredOutput, dofRepeats: this.tier === 'high' ? 18 : 6, dofResolution: this.tier === 'high' ? 1 : .5 }; }
  render(): void { this.pipeline.render(); }
  dispose(): void {
    // r186's RTTNode has dispose(), currently missing from @types/three.
    if (this.lowBlur) (this.lowBlur as typeof this.lowBlur & { dispose(): void }).dispose(); this.pipeline.dispose(); this.bloomPass.dispose(); this.scenePass.dispose();
    // Bloom's fixed five-slot composite samples inactive low-tier textures. Those targets
    // are never rendered, so they have no target-dispose listener; release their sampled textures.
    const targets = (this.bloomPass as typeof this.bloomPass & { _renderTargetsVertical: RenderTarget[] })._renderTargetsVertical;
    for (let i = qualityBudgets[this.tier].bloomMips; i < targets.length; i++) targets[i].texture.dispose();
  }
}
