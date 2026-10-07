// Adapted from folio-2025 Rendering.js / Viewport.js by Bruno Simon (MIT), commit 41046b5.
import { WebGPURenderer } from 'three/webgpu';

/** Automatic WebGPU → WebGL2 fallback; backend is read after renderer.init(), not inferred from navigator. */
export class Renderer extends WebGPURenderer {
  constructor(params: URLSearchParams, canvas?: HTMLCanvasElement) {
    super({ antialias: true, forceWebGL: params.get('renderer') === 'webgl', ...(canvas ? { canvas } : {}) });
    // Game owns recovery and pauses before another draw can reach the lost backend.
    const report = this.onDeviceLost;
    this.onDeviceLost = info => { if (info.api !== 'WebGL') report.call(this, info); };
    // Game owns RAF and resets once per rendered frame, including explicit paused captures.
    this.info.autoReset = false;
    // r186 async warm-up restores _currentRenderContext before building bindings.
    // Its module cache then keys bindings by the persistent renderer and pins old levels.
    this.debug.onNodeBuilderCreated = (builder, object) => {
      const context = (object as { context: object }).context;
      const internal = builder as unknown as { _getBindGroup(name: string, bindings: unknown[]): unknown };
      const getBindGroup = internal._getBindGroup;
      internal._getBindGroup = (name, bindings) => {
        const state = this as unknown as { _currentRenderContext: object | null };
        const previous = state._currentRenderContext; state._currentRenderContext = context;
        try { return getBindGroup.call(builder, name, bindings); }
        finally { state._currentRenderContext = previous; }
      };
    };
  }
  /** Use Three's vertex-attribute instancing path, which shares shaders across
   * district placement counts instead of embedding matrix array lengths in GLSL. */
  attributeInstanceCapacity(): number {
    const backend = this.backend as unknown as { capabilities: { getUniformBufferLimit(): number } };
    return Math.floor(backend.capabilities.getUniformBufferLimit() / 64) + 1;
  }
  /** Finish the loading draw before gameplay can encounter deferred driver work. */
  async finishWarmUp(): Promise<void> {
    if (this.selectedBackend === 'webgl') {
      const backend = this.backend as unknown as { utils: { _clientWaitAsync(): Promise<void> } };
      await backend.utils._clientWaitAsync();
    } else {
      // Dawn finishes pipeline compilation in the GPU process after createRenderPipeline returns.
      // Wait for the warm-up submission, or a cold shader cache freezes the first playable frame
      // (measured ~4.5 s on a first visit) after the loading screen has already closed.
      const device = (this.backend as unknown as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } } }).device;
      await device?.queue.onSubmittedWorkDone();
    }
    // PassNode and ShadowNode cache work per animation frame. A fence can already
    // be signaled: still let Three advance its frame before the next warm-up draw.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  /** Three 0.186 retains shared shader bindings by render context, and WebGL VAOs.
   * Level unload retires all render objects before dropping these renderer-owned caches. */
  releaseLevelCaches(): void {
    const caches = this as unknown as { _objects: { dispose(): void } | null; _nodes: { dispose(): void } | null; _renderLists: { dispose(): void } | null; _renderContexts: { dispose(): void } | null };
    caches._objects?.dispose(); caches._nodes?.dispose(); caches._renderLists?.dispose(); caches._renderContexts?.dispose();
    if (this.selectedBackend === 'webgl') {
      const backend = this.backend as unknown as { gl: WebGL2RenderingContext | null; vaoCache: Record<string, WebGLVertexArrayObject>; state: { setVertexState(vao: WebGLVertexArrayObject | null): void } | null };
      if (!backend.gl) return;
      backend.state!.setVertexState(null);
      for (const vao of Object.values(backend.vaoCache)) backend.gl.deleteVertexArray(vao);
      backend.vaoCache = {};
    }
  }
  get selectedBackend(): 'webgpu' | 'webgl' {
    return (this.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl';
  }
}
