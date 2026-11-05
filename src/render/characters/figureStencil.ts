import { AlwaysStencilFunc, DepthStencilFormat, KeepStencilOp, NotEqualStencilFunc, ReplaceStencilOp, type Material, type Texture } from 'three/webgpu';

/** Visible living fragments reserve one stencil bit. Walls still occlude them through the normal depth test. */
export function livingStencil(material: Material): void {
  material.stencilWrite = true;
  material.stencilRef = 1; material.stencilFunc = AlwaysStencilFunc;
  material.stencilFuncMask = material.stencilWriteMask = 1;
  material.stencilFail = material.stencilZFail = KeepStencilOp; material.stencilZPass = ReplaceStencilOp;
}

/** Ground bodies draw after living figures, preserving self-depth but yielding only the living silhouette. */
export function corpseStencil(material: Material): void {
  material.stencilWrite = true;
  material.stencilRef = 1; material.stencilFunc = NotEqualStencilFunc;
  material.stencilFuncMask = 1; material.stencilWriteMask = 0;
  material.stencilFail = material.stencilZFail = material.stencilZPass = KeepStencilOp;
}

type TextureBinding = { isSampledTexture?: boolean; texture: Texture; store?: boolean; mipLevel: number };
type DepthBackend = {
  get(texture: Texture): { texture: {
    width: number; height: number; depthOrArrayLayers: number; mipLevelCount: number;
    createView(descriptor: { aspect: 'depth-only'; dimension: '2d' | '2d-array'; mipLevelCount: number; baseMipLevel: number }): object;
  }; [key: string]: unknown };
  bindingUtils: { createBindGroup(group: { bindings: TextureBinding[] }, layout: unknown): unknown };
};
/** Three r186 creates an all-aspects sampled view, which WebGPU rejects for a combined depth/stencil texture.
 * Seed its existing view cache with a depth-only view; the attachment and copy still retain both aspects. */
export function installDepthStencilSampling(backend: DepthBackend): void {
  const utils = backend.bindingUtils, create = utils.createBindGroup;
  utils.createBindGroup = function (group, layout) {
    for (const binding of group.bindings) {
      if (!binding.isSampledTexture || binding.texture.format !== DepthStencilFormat) continue;
      const data = backend.get(binding.texture), texture = data.texture;
      const mipLevelCount = binding.store ? 1 : texture.mipLevelCount, baseMipLevel = binding.store ? binding.mipLevel : 0;
      const layers = texture.depthOrArrayLayers > 1 ? `-${texture.depthOrArrayLayers}` : '';
      const key = `view-${texture.width}-${texture.height}${layers}-${mipLevelCount}-${baseMipLevel}`;
      data[key] ??= texture.createView({ aspect: 'depth-only', dimension: layers ? '2d-array' : '2d', mipLevelCount, baseMipLevel });
    }
    return create.call(this, group, layout);
  };
}
