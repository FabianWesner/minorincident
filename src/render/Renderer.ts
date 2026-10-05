// Adapted from folio-2025 Rendering.js / Viewport.js by Bruno Simon (MIT), commit 41046b5.
import { WebGPURenderer } from 'three/webgpu';

/** Automatic WebGPU → WebGL2 fallback; backend is read after renderer.init(), not inferred from navigator. */
export class Renderer extends WebGPURenderer {
  constructor(params: URLSearchParams) {
    super({ antialias: true, forceWebGL: params.get('renderer') === 'webgl' });
  }
  get selectedBackend(): 'webgpu' | 'webgl' {
    return (this.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl';
  }
}
