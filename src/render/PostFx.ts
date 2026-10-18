import { qualityBudgets, type QualityTier } from '../core/Quality';
// Adapted from folio-2025 Rendering.js / Passes/cheapDOF.js by Bruno Simon (MIT), commit 41046b5.
import { ColorManagement, NoToneMapping, RenderPipeline, Vector4, type Node, type Camera, type Scene, type WebGPURenderer, type RenderTarget, type Object3D } from 'three/webgpu';
import { pass, uv, uniform, uniformArray, mix, vec2, rtt, float, sin } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { hashBlur } from 'three/addons/tsl/display/hashBlur.js';
import { LookUniforms } from './LookUniforms';

let nextDiagnosticId = 0;
/** Screen-space heat haze slots (vfx-stunning-3): fires and fresh blasts, high tier only. */
export const HEAT_SOURCES = 8;

/** HDR bloom, soft vignette and optional miniature blur; central 40% stays sharp. */
export class PostFx {
  private readonly diagnosticId = ++nextDiagnosticId;
  private disposed = false;
  private readonly targetDisposals = new Map<RenderTarget, number>();
  readonly pipeline: RenderPipeline;
  readonly bloomEnabled = uniform(1);
  private readonly sharpOutput;
  private readonly blurredOutput;
  private readonly scenePass;
  private readonly lowBlur;
  private readonly bloomPass;
  /** Heat haze sources in UV space: x, y (0..1), radius (UV height units), strength 0..1. Empty slots have strength 0. */
  readonly heat = Array.from({ length: HEAT_SOURCES }, () => new Vector4());
  readonly heatTime = uniform(0);
  readonly heatAspect = uniform(16 / 9);
  readonly haze: boolean;
  constructor(private readonly renderer: WebGPURenderer, scene: Scene, camera: Camera, tier: QualityTier = 'high', readonly look = new LookUniforms()) {
    this.scenePass = pass(scene, camera); const scene0 = this.scenePass.getTextureNode('output');
    // Heat haze: one dependent fetch of the scene colour with a small rippling UV offset inside each source's disc.
    // Low tier builds no haze node at all. Bloom keeps reading the undistorted scene.
    this.haze = tier === 'high';
    const source = this.haze ? scene0.sample(uv().add(this.hazeOffset())) : scene0;
    this.bloomPass = bloom(scene0, look.values.bloomStrength, look.values.bloomRadius, look.values.bloomThreshold);
    // Bind level defaults directly so mission lighting changes update the existing pass.
    this.bloomPass.strength = look.nodes.bloomStrength;
    this.bloomPass.radius = look.nodes.bloomRadius;
    this.bloomPass.threshold = look.nodes.bloomThreshold;
    this.tier = tier;
    (this.bloomPass as typeof this.bloomPass & { _nMips: number })._nMips = qualityBudgets[tier].bloomMips;
    // Current Three composites all five texture slots; inactive mips contribute zero.
    this.bloomPass.bloomTintColors.forEach((color, i) => color.setScalar(i < qualityBudgets[tier].bloomMips ? 1 : 0));
    const protectedArea = uv().sub(.5).div(vec2(.18, .35)).length().smoothstep(1, 1.3);
    const strength = uv().y.sub(0.5).abs().smoothstep(look.nodes.dofStart, look.nodes.dofEnd).mul(protectedArea);
    const blur = hashBlur(source, strength.mul(look.nodes.dofAmount), { repeats: tier === 'high' ? look.nodes.dofRepeats : look.nodes.dofRepeatsLow, premultipliedAlpha: true });
    this.lowBlur = tier === 'low' ? rtt(blur, null, null, { resolutionScale: .5 }) : null;
    const vignette = uv().sub(.5).length().smoothstep(.25, .7).mul(look.nodes.vignette).oneMinus();
    this.sharpOutput = source.add(this.bloomPass.mul(this.bloomEnabled)).mul(vignette);
    this.blurredOutput = mix(source, this.lowBlur ?? blur, strength).add(this.bloomPass.mul(this.bloomEnabled)).mul(vignette);
    this.pipeline = new RenderPipeline(renderer, this.sharpOutput);
    for (const target of this.diagnosticTargets()) {
      this.targetDisposals.set(target, 0);
      target.addEventListener('dispose', () => this.targetDisposals.set(target, (this.targetDisposals.get(target) ?? 0) + 1));
    }
  }
  private hazeOffset(): Node<'vec2'> {
    const sources = uniformArray<'vec4'>(this.heat, 'vec4'), p = uv(), t = this.heatTime;
    // Per source only a disc mask (cheap); the ripple is evaluated once, at the mask-weighted source scale.
    let weight: Node<'float'> = float(0), scaled: Node<'float'> = float(0);
    for (let i = 0; i < HEAT_SOURCES; i++) {
      const h = sources.element(i), radius = h.z.max(.0001);
      const mask = float(1).sub(p.sub(h.xy).mul(vec2(this.heatAspect, 1)).div(radius).length().smoothstep(.25, 1)).mul(h.w);
      weight = weight.add(mask); scaled = scaled.add(mask.mul(radius));
    }
    const radius = scaled.div(weight.max(.0001)).max(.0001), local = p.mul(vec2(this.heatAspect, 1)).div(radius);
    // Rising shimmer: two crossed ripples scaled to the source size, so the cells keep their look at every zoom.
    const wave = sin(local.y.mul(11).sub(t.mul(7.5)).add(sin(local.x.mul(7).add(t.mul(2.3))).mul(1.6)));
    const sway = sin(local.x.mul(9).add(t.mul(5.1)).add(local.y.mul(4)));
    return vec2(wave.mul(.6), sway.mul(.4).add(wave.mul(.3))).mul(weight.min(1)).mul(radius.mul(.035));
  }
  private diagnosticTargets(): RenderTarget[] {
    const bloom = this.bloomPass as typeof this.bloomPass & { _renderTargetBright: RenderTarget; _renderTargetsHorizontal: RenderTarget[]; _renderTargetsVertical: RenderTarget[] };
    return [this.scenePass.renderTarget, bloom._renderTargetBright, ...bloom._renderTargetsHorizontal, ...bloom._renderTargetsVertical];
  }
  /** Disposal events include target reallocations on resize, not only final teardown. */
  diagnostics() {
    return { id: this.diagnosticId, disposed: this.disposed, ...this.snapshot(), targets: this.diagnosticTargets().map(target => ({
      id: target.texture.uuid, name: target.texture.name, width: target.width, height: target.height,
      samples: target.samples, disposalEvents: this.targetDisposals.get(target) ?? 0,
    })) };
  }
  applyLook(): void {
    this.bloomPass.strength.value = this.look.values.bloomStrength;
    this.bloomPass.radius.value = this.look.values.bloomRadius;
    this.bloomPass.threshold.value = this.look.values.bloomThreshold;
  }
  private tier: QualityTier = 'high';
  setDof(enabled: boolean): void { this.pipeline.outputNode = enabled ? this.blurredOutput : this.sharpOutput; this.pipeline.needsUpdate = true; }
  snapshot() { return { bloomMips: qualityBudgets[this.tier].bloomMips, dof: this.pipeline.outputNode === this.blurredOutput, dofRepeats: this.tier === 'high' ? this.look.nodes.dofRepeats.value : this.look.nodes.dofRepeatsLow.value, dofResolution: this.tier === 'high' ? 1 : .5, bloomStrength: this.bloomPass.strength.value, haze: this.haze, heatSources: this.heat.filter(h => h.w > 0).length }; }
  /** Compile in the gameplay HDR/MSAA target. `root` warms a streamed subtree with the scene's lights. */
  async compile(partitions?: (() => void)[], root?: Object3D): Promise<void> {
    const renderer = this.renderer, target = renderer.getRenderTarget(), mrt = renderer.getMRT();
    const tone = renderer.toneMapping, color = renderer.outputColorSpace;
    this.scenePass.renderTarget.samples = renderer.samples;
    this.scenePass.renderTarget.texture.type = renderer.getOutputBufferType();
    renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = ColorManagement.workingColorSpace;
    // r186 compileAsync omits render call depth. The scene pass renders inside the
    // pipeline quad (depth 1); depth 0 creates different render objects and node graphs.
    const contexts = (renderer as unknown as { _renderContexts: { get(target: unknown, mrt: unknown, depth?: number): unknown } })._renderContexts;
    const getContext = contexts.get;
    const compile = (object: Object3D) => {
      contexts.get = (target, mrt, depth = 0) => getContext.call(contexts, target, mrt, depth + 1);
      try { return renderer.compileAsync(object, this.scenePass.camera, this.scenePass.scene as Scene); }
      finally { contexts.get = getContext; }
    };
    try {
      if (!partitions && !root) {
        renderer.setRenderTarget(this.scenePass.renderTarget); renderer.setMRT(this.scenePass.getMRT());
        await compile(this.scenePass.scene);
      }
      else {
        // Same state as PassNode.compileAsync, held across concurrent compile lanes (PreRenderer).
        const pass = this.scenePass as typeof this.scenePass & { getMRT(): ReturnType<WebGPURenderer['getMRT']> };
        renderer.setRenderTarget(pass.renderTarget); renderer.setMRT(pass.getMRT());
        // compileAsync captures the render context before yielding. Streaming must restore the
        // target immediately, so an in-flight warm-up cannot redirect the next gameplay draw.
        if (root) return compile(root);
        await Promise.all(partitions!.map(apply => { apply(); return compile(pass.scene); }));
      }
    }
    finally { renderer.setRenderTarget(target); renderer.setMRT(mrt); renderer.toneMapping = tone; renderer.outputColorSpace = color; }
  }
  render(): void { this.pipeline.render(); }
  dispose(): void {
    this.disposed = true;
    // r186's RTTNode has dispose(), currently missing from @types/three.
    if (this.lowBlur) (this.lowBlur as typeof this.lowBlur & { dispose(): void }).dispose(); this.pipeline.dispose(); this.bloomPass.dispose(); this.scenePass.dispose();
    // Bloom's fixed five-slot composite samples inactive low-tier textures. Those targets
    // are never rendered, so they have no target-dispose listener; release their sampled textures.
    const targets = (this.bloomPass as typeof this.bloomPass & { _renderTargetsVertical: RenderTarget[] })._renderTargetsVertical;
    for (let i = qualityBudgets[this.tier].bloomMips; i < targets.length; i++) targets[i].texture.dispose();
  }
}
