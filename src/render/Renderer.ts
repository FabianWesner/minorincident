// Adapted from folio-2025 Rendering.js / Viewport.js by Bruno Simon (MIT), commit 41046b5.
import { NodeBuilder, AgXToneMapping, ACESFilmicToneMapping, WebGPURenderer, type Object3D, type Camera, type Scene } from 'three/webgpu';

import { worldAssets } from '../assets/worldDefinitions';
import { installTextureRanges } from './TextureRanges';
import { PaletteMaterial } from './PaletteMaterial';
type RenderObjects = { get(...args: unknown[]): unknown };
const paletteVariantCaches = new WeakSet<RenderObjects>();
/** Three r186 otherwise retires a warmed daylight graph when warming its fire graph.
 * Keep one render object per cached palette output; normal level/context disposal owns them all.
 * FIX-04: replacing the daylight object after fire warm-up leaves L2's window
 * pane instance bindings stale, drawing a unit cube at the phone camera focus. */
export function installPaletteVariantCache(objects: RenderObjects): void {
  if (paletteVariantCaches.has(objects)) return;
  paletteVariantCaches.add(objects);
  const get = objects.get;
  objects.get = function (...args: unknown[]) {
    const object = args[0] as { count: number; isInstancedMesh?: boolean; userData: Record<string, unknown> };
    const material = args[1];
    const staticAttributes = object.userData.staticInstanceAttributes && (material as { positionNode?: unknown }).positionNode === object.userData.staticInstancePosition;
    // Mask/id passes replace the material: preserve their original instancing
    // rather than applying a static shader key to captured buffer nodes.
    if (object.userData.staticInstanceAttributes) object.isInstancedMesh = !staticAttributes;
    if (material instanceof PaletteMaterial && material.outputNode) args[7] = `${args[7] ?? 'default'}:palette:${material.outputNode.id}`;
    const result = get.apply(this, args);
    if (staticAttributes) {
      const render = result as { staticInstanceKey?: boolean; initialCacheKey: number; getMaterialCacheKey(): number; getCacheKey(): number };
      if (!render.staticInstanceKey) {
        const key = render.getMaterialCacheKey;
        render.getMaterialCacheKey = function () {
          const count = object.count, instanced = object.isInstancedMesh; object.count = 1; object.isInstancedMesh = false;
          try { return key.call(this); } finally { object.count = count; object.isInstancedMesh = instanced; }
        };
        render.staticInstanceKey = true; render.initialCacheKey = render.getCacheKey();
      }
    }
    return result;
  };
}

/** Three r186 stores interleaved WebGPU buffers under their shared data object,
 * but destroys them through an attribute wrapper. Retire the same cache key so
 * a later level uploads a fresh buffer instead of writing to the destroyed one. */
export function installInterleavedBufferDisposal(backend: {
  get(attribute: object): { buffer?: unknown };
  delete(attribute: object): unknown;
  destroyAttribute(attribute: object): void;
}): void {
  const destroy = backend.destroyAttribute;
  backend.destroyAttribute = function (attribute: object) {
    const interleaved = attribute as { isInterleavedBufferAttribute?: boolean; data: object };
    if (!interleaved.isInterleavedBufferAttribute) { destroy.call(this, attribute); return; }
    if (this.get(interleaved.data).buffer) destroy.call(this, interleaved.data);
    this.delete(attribute);
  };
}

// Load lane: three emits small instance-matrix arrays (and bone/range arrays) as per-object uniform
// buffers named after the node id ('NodeBuffer_<id>'), so every InstancedMesh below the uniform limit
// compiled its own shader module and pipeline (L1 v2: 21 civilian batches x 2 passes = 42 of 130
// pipelines). Report no uniform-buffer room to node builders: three then takes its attribute
// (instancing) / texture (bones) paths, whose shader text is shared by every object of a material.
(NodeBuilder.prototype as unknown as { getUniformBufferLimit(): number }).getUniformBufferLimit = () => 0;

/** Automatic WebGPU → WebGL2 fallback; backend is read after renderer.init(), not inferred from navigator. */
export class Renderer extends WebGPURenderer {
  private canvasOverlay = false;
  /** Shadow nodes render the same scene recursively. Its world transforms are
   * already current from the enclosing beauty pass; avoid walking the whole
   * scene again for each shadow pass. Restore automatic updates between calls. */
  override render(scene: Object3D, camera: Camera): void {
    const automatic = scene.matrixWorldAutoUpdate;
    if (automatic) { scene.updateMatrixWorld(); scene.matrixWorldAutoUpdate = false; }
    try { super.render(scene, camera); }
    finally { scene.matrixWorldAutoUpdate = automatic; }
  }

  override get currentSamples(): number {
    return this.canvasOverlay && this.getRenderTarget() === null ? 0 : super.currentSamples;
  }
  /** Fullscreen pipeline output is single-sampled. Overlay passes must load that
   * canvas, rather than resolving an unrelated MSAA colour buffer over it. */
  /** Starts a new three.js node frame, as three's own RAF loop (renderers/common/Animation.js) does. FRAME-updated
   * nodes such as the PostFx scene pass otherwise render once per browser frame, not once per render call. */
  nextNodeFrame(): void {
    const nodes = (this as unknown as { _nodes: { nodeFrame: { update(): void; frameId: number } } })._nodes;
    nodes.nodeFrame.update(); (this.info as { frame: number }).frame = nodes.nodeFrame.frameId;
  }
  renderOverlay(scene: Scene, camera: Camera): void {
    const previous = this.canvasOverlay;
    this.canvasOverlay = true;
    try { this.render(scene, camera); }
    finally { this.canvasOverlay = previous; }
  }
  private levelCacheReleases = 0;
  /** Read-only reload diagnostics; does not consume GL errors or change GPU state. */
  diagnostics() {
    const target = this.getRenderTarget();
    const gl = (this.backend as unknown as { gl?: WebGL2RenderingContext }).gl;
    return { backend: this.selectedBackend, levelCacheReleases: this.levelCacheReleases,
      contextLost: gl?.isContextLost() ?? false,
      renderTarget: target ? { id: target.texture.uuid, width: target.width, height: target.height, samples: target.samples } : null,
      memory: { ...this.info.memory }, render: { ...this.info.render },
      framebufferStatus: gl ? gl.checkFramebufferStatus(gl.FRAMEBUFFER) : null };
  }
  /** The loading card permits a complete node build; menu streaming still yields. */
  foregroundCompile = false;
  /** Diagnostic count: a rise after the card hides identifies a cold node graph. */
  nodeBuilds = 0;
  readonly nodeBuildMaterials: Record<string, number> = {};
  /** Opt-in submitted geometry breakdown, including actual shadow passes (not estimates). */
  profile: Record<string, { drawCalls: number; triangles: number }> | null = null;
  profileAssets: Record<string, { drawCalls: number; triangles: number }> | null = null;
  private readonly categories = new WeakMap<Object3D, string>();
  private readonly assets = new WeakMap<Object3D, string>();
  override async init(): Promise<this> {
    await super.init();
    installTextureRanges(this.backend);
    if (this.selectedBackend === 'webgpu') installInterleavedBufferDisposal(this.backend as unknown as Parameters<typeof installInterleavedBufferDisposal>[0]);
    installPaletteVariantCache((this as unknown as { _objects: RenderObjects })._objects);
    const nodes = (this as unknown as { _nodes: { getForRender(object: unknown): unknown; getForRenderAsync(object: unknown): Promise<unknown> } })._nodes;
    const asynchronous = nodes.getForRenderAsync;
    nodes.getForRenderAsync = object => this.foregroundCompile ? Promise.resolve(nodes.getForRender(object)) : asynchronous.call(nodes, object);
    if (!this.profile) return this;
    const backend = this.backend as unknown as { draw(object: { object: Object3D; camera: Camera }, info: Renderer['info']): void };
    const draw = backend.draw.bind(backend);
    backend.draw = (renderObject, info) => {
      const calls = info.render.drawCalls, triangles = info.render.triangles;
      draw(renderObject, info);
      let category = this.categories.get(renderObject.object);
      if (!category) {
        category = 'other';
        for (let node: Object3D | null = renderObject.object; node; node = node.parent) {
          if (node.name === 'infected-crowd' || node.name === 'civilian-crowd') { category = 'crowd'; break; }
          if (node.name.startsWith('inst:')) { const id = node.name.slice(5); this.assets.set(renderObject.object, id); category = worldAssets[id]?.category === 'building' ? 'buildings' : 'props'; break; }
        }
        // Uncategorised draws are attributed to their top-level scene group (debug profile only).
        if (category === 'other') { let top: Object3D = renderObject.object; while (top.parent && top.parent.parent) top = top.parent; this.assets.set(renderObject.object, `other/${top.name || top.type}/${renderObject.object.name || renderObject.object.type}`); }
        this.categories.set(renderObject.object, category);
      }
      if (renderObject.camera !== this.profileCamera) category = 'shadows';
      const total = this.profile![category] ??= { drawCalls: 0, triangles: 0 };
      total.drawCalls += info.render.drawCalls - calls; total.triangles += info.render.triangles - triangles;
      const asset = this.assets.get(renderObject.object);
      if (asset) {
        const total = this.profileAssets![`${category === 'shadows' ? 'shadow' : 'view'}:${asset}`] ??= { drawCalls: 0, triangles: 0 };
        total.drawCalls += info.render.drawCalls - calls; total.triangles += info.render.triangles - triangles;
      }
    };
    return this;
  }
  private profileCamera: Camera | null = null;
  beginProfile(camera: Camera): void { if (this.profile) { this.profile = {}; this.profileAssets = {}; this.profileCamera = camera; } }
  constructor(params: URLSearchParams, canvas?: HTMLCanvasElement) {
    super({ antialias: true, forceWebGL: params.get('renderer') === 'webgl', ...(canvas ? { canvas } : {}) });
    if (params.get('test') === '1' && params.has('tone')) this.toneMapping = params.get('tone') === 'agx' ? AgXToneMapping : ACESFilmicToneMapping;
    if (params.has('profile')) { this.profile = {}; this.profileAssets = {}; }
    // Game owns recovery and pauses before another draw can reach the lost backend.
    const report = this.onDeviceLost;
    this.onDeviceLost = info => { if (info.api !== 'WebGL') report.call(this, info); };
    // Game owns RAF and resets once per rendered frame, including explicit paused captures.
    this.info.autoReset = false;
    // r186 async warm-up restores _currentRenderContext before building bindings.
    // Its module cache then keys bindings by the persistent renderer and pins old levels.
    this.debug.onNodeBuilderCreated = (builder, object) => {
      this.nodeBuilds++;
      if (params.has('loadProfile')) {
        const draw = object as { material: { name: string; type: string }; object: { name: string; type: string; parent?: { name: string }; userData: Record<string, unknown> } };
        const key = `${draw.material.name || draw.material.type}:${draw.object.userData.staticInstanceAttributes ? 'static' : draw.object.name || draw.object.parent?.name || draw.object.type}`;
        this.nodeBuildMaterials[key] = (this.nodeBuildMaterials[key] ?? 0) + 1;
      }
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
      const backend = this.backend as unknown as { gl?: WebGL2RenderingContext; utils: { _clientWaitAsync(): Promise<void> } };
      const gl = backend.gl;
      if (gl) {
        // Poll GPU completion between paints. RAF-based polling followed by the
        // required new frame paid 2–3 frames for every tiny animated warm-up draw.
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (!fence) throw new Error('Could not create warm-up GPU fence');
        gl.flush();
        await new Promise<void>((resolve, reject) => {
          const check = () => {
            const status = gl.clientWaitSync(fence, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
            if (status === gl.TIMEOUT_EXPIRED) { setTimeout(check, 1); return; }
            gl.deleteSync(fence);
            if (status === gl.WAIT_FAILED) reject(new Error('Warm-up GPU fence failed'));
            else resolve();
          };
          check();
        });
      } else await backend.utils._clientWaitAsync();
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
    this.levelCacheReleases++;
    // r186's geometry listeners capture the first RenderObject using each
    // geometry. Shared fullscreen/retained prototype geometry outlives a level,
    // pinning that render context and its entire shared-uniform cache. Retire
    // attributes and invalidate initialization so the next use uploads again.
    const geometries = (this as unknown as { _geometries: {
      _geometryDisposeListeners: Map<object, () => void>;
      delete(geometry: object): unknown;
    } | null })._geometries;
    if (geometries) for (const [geometry, retire] of geometries._geometryDisposeListeners) {
      retire(); geometries.delete(geometry);
    }
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
