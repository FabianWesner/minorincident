import { ColorManagement, Mesh, NoToneMapping, ShadowNode, type Camera, type Light, type Material, type Scene, type DirectionalLight, type SpotLight } from 'three/webgpu';
import type { Renderer } from './Renderer';

/** Three r186 omits shadow rendering from compileAsync. Warm the same shadow
 * render objects asynchronously before their first real draw; otherwise that
 * draw synchronously links every cold caster program (seconds in L5/L6).
 * All ordinary shadow draws and GPU fences still run in PreRenderer afterwards. */
export async function compileShadowMaps(renderer: Renderer, scene: Scene, depth: number): Promise<void> {
  if (renderer.selectedBackend !== 'webgl' || !renderer.shadowMap.enabled) return;
  const lights: (DirectionalLight | SpotLight)[] = [];
  scene.traverseVisible(object => {
    const light = object as Light & { isDirectionalLight?: boolean; isSpotLight?: boolean };
    if ((light.isDirectionalLight || light.isSpotLight) && light.castShadow && (light as DirectionalLight).shadow.map) lights.push(light as DirectionalLight | SpotLight);
  });
  if (!lights.length) return;
  const leaves: Mesh[] = [];
  scene.traverse(object => { if (object instanceof Mesh && !object.userData.preventPreRender && object.geometry.hasAttribute('position')) leaves.push(object); });
  const visibility = leaves.map(object => object.visible);
  const target = renderer.getRenderTarget(), mrt = renderer.getMRT();
  const tone = renderer.toneMapping, color = renderer.outputColorSpace;
  const background = scene.background, backgroundNode = scene.backgroundNode, override = scene.overrideMaterial;
  type Draw = { drawRange: unknown; group: unknown };
  type Args = [Mesh, Material, Scene, Camera, unknown, unknown, unknown, unknown];
  const state = renderer as unknown as {
    _currentRenderContext: unknown; _isPreCompiling: boolean;
    _createObjectPipeline(...args: Args): void;
    _objects: { get(...args: unknown[]): Draw };
    _nodes: { getForRender(draw: Draw): unknown; updateBefore(draw: Draw): void; updateForRender(draw: Draw): void; updateAfter(draw: Draw): void };
    _geometries: { updateForRender(draw: Draw): void };
    _bindings: { updateForRender(draw: Draw): void };
    _pipelines: { getForRender(draw: Draw, promises: Promise<unknown>[]): void };
    _renderContexts: { get(target: unknown, mrt: unknown, depth?: number): unknown };
  };
  const create = state._createObjectPipeline, getContext = state._renderContexts.get;
  const tasks: Promise<unknown>[] = [];
  try {
    scene.background = scene.backgroundNode = null; renderer.setMRT(null);
    renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = ColorManagement.workingColorSpace;
    // Capture each shared override material while its source nodes are installed.
    // r186's deferred work-item queue otherwise sees the restored override nodes.
    state._createObjectPipeline = (object, material, world, camera, lightsNode, group, clipping, passId) => {
      const draw = state._objects.get(object, material, world, camera, lightsNode, state._currentRenderContext, clipping, passId);
      draw.drawRange = object.geometry.drawRange; draw.group = group;
      const previous = state._isPreCompiling, pending: Promise<unknown>[] = [];
      state._isPreCompiling = true;
      try {
        state._nodes.getForRender(draw); state._nodes.updateBefore(draw);
        state._geometries.updateForRender(draw); state._nodes.updateForRender(draw); state._bindings.updateForRender(draw);
        state._pipelines.getForRender(draw, pending);
      } finally { state._isPreCompiling = previous; }
      tasks.push(Promise.all(pending).then(() => {
        const previous = state._isPreCompiling; state._isPreCompiling = true;
        try { state._nodes.updateAfter(draw); } finally { state._isPreCompiling = previous; }
      }));
    };
    state._renderContexts.get = (target, mrt) => getContext.call(state._renderContexts, target, mrt, depth);
    for (const light of lights) {
      light.shadow.updateMatrices(light);
      scene.overrideMaterial = new ShadowNode(light, light.shadow).getShadowMaterial();
      renderer.setRenderTarget(light.shadow.map);
      leaves.forEach(object => { object.visible = object.castShadow; });
      // Collection/node builds are synchronous; only the program links wait.
      await renderer.compileAsync(scene, light.shadow.camera);
    }
  } finally {
    state._createObjectPipeline = create; state._renderContexts.get = getContext;
    leaves.forEach((object, i) => { object.visible = visibility[i]; });
    scene.background = background; scene.backgroundNode = backgroundNode; scene.overrideMaterial = override;
    renderer.setRenderTarget(target); renderer.setMRT(mrt);
    renderer.toneMapping = tone; renderer.outputColorSpace = color;
  }
  await Promise.all(tasks);
}
