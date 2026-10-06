import { AmbientLight, Box3, DirectionalLight, HemisphereLight, Mesh, PerspectiveCamera, RenderTarget, Scene, Vector3, WebGPURenderer, type Object3D } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Crowd } from './crowd';
import { AssetRegistry, type PlaceholderLog } from './registry';
import manifest from './manifest.json';
import type { AssetDef } from './types';

export interface AssetViewerApi {
  ready: Promise<void>;
  view(index: number): Promise<void>;
  deliveryView?(quality: 'high' | 'lod1' | 'lod2', distance: number): Promise<void>;
  info(): { placeholder: boolean; drawCalls: number; triangles: number; nodes: string[]; events: PlaceholderLog[] };
  goreProbe?(limb: string): Promise<{ hiddenBefore: boolean; visibleAfter: boolean; capTriangles: number; jointError: number }>;
  crowdProbe?(): Promise<{ instances: number; materials: number; drawCalls: number; poseError: number }>;
}
declare global { interface Window { __ASSET__?: AssetViewerApi } }

/** The game WebGPU renderer (WebGL2 fallback), palette swap and golden-hour lights. */
export async function assetViewer(): Promise<void> {
  const params = new URLSearchParams(location.search), id = params.get('asset') ?? 'veh.fire-engine';
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: params.get('renderer') === 'webgl' });
  renderer.info.autoReset = false;
  renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); await renderer.init();
  document.querySelector('#stage')!.appendChild(renderer.domElement);
  const scene = new Scene(); renderer.setClearColor('#2a2730');
  scene.add(new HemisphereLight('#ffe2b6', '#635078', 2), new AmbientLight('#ffe8c8', .3));
  const sun = new DirectionalLight('#ffd5a2', 3); sun.position.set(5,8,5); scene.add(sun);
  const camera = new PerspectiveCamera(25, innerWidth / innerHeight, .01, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  const events: PlaceholderLog[] = [];
  const registry = new AssetRegistry((event) => { events.push(event); console.info(event.type, event.id, event.reason); }, { renderer,
    // Explicit production inspection leaves normal registry status gates in place.
    manifest: (import.meta.env.DEV || params.has('test')) && params.has('production')
      ? (manifest as AssetDef[]).map(def => def.id === id ? { ...def, status: 'integrated', ...(params.has('inspection') ? { requiredNodes: [], animatedNodes: [], sockets: [] } : {}) } : def) : undefined,
  });
  const decay = document.querySelector<HTMLSelectElement>('#decay')!;
  for (const name of registry.definition(id).decayVariants) { const option = new Option(name,name); decay.add(option); }
  decay.disabled = !registry.definition(id).decayVariants.length;
  let object: Object3D, extent = 1;
  const center = new Vector3(), size = new Vector3();
  function render(): void { renderer.info.reset(); renderer.render(scene,camera); }
  async function view(index: number): Promise<void> {
    const angle = index === 4 ? Math.PI / 4 : index * Math.PI / 2;
    const elevation = index === 4 ? Math.PI * .2 : .32;
    const width = Math.abs(Math.sin(angle))*size.x + Math.abs(Math.cos(angle))*size.z;
    const depth = Math.abs(Math.cos(angle))*size.x + Math.abs(Math.sin(angle))*size.z;
    const height = Math.cos(elevation)*size.y + Math.sin(elevation)*depth;
    const distance = Math.max(width/camera.aspect,height) / Math.tan(camera.fov*Math.PI/360) * .6;
    camera.position.set(center.x + Math.cos(angle) * Math.cos(elevation) * distance, center.y + Math.sin(elevation) * distance, center.z + Math.sin(angle) * Math.cos(elevation) * distance);
    controls.target.copy(center); controls.update(); camera.lookAt(center);
    await renderer.compileAsync(scene,camera); render(); render();
  }
  async function load(): Promise<void> {
    if (object) { scene.remove(object); if (object instanceof Crowd) object.dispose(); }
    object = params.has('crowd') && params.has('test')
      ? new Crowd((await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/assets/models/${id}.crowd.glb`)).scene,100)
      : await registry.loadAsset(id, (document.querySelector<HTMLSelectElement>('#quality')?.value ?? 'high') as 'high' | 'lod1' | 'lod2', decay.value || undefined);
    exploded = false;
    scene.add(object);
    new Box3().setFromObject(object).getCenter(center);
    new Box3().setFromObject(object).getSize(size); extent = Math.max(size.x,size.y,size.z);
    await view(4);
    const picker = document.querySelector<HTMLSelectElement>('#nodes')!; picker.replaceChildren();
    object.traverse((node) => { if (node.name) { const option = document.createElement('option'); option.text = node.name; picker.add(option); } });
  }
  controls.addEventListener('change', render);
  document.querySelector('#quality')!.addEventListener('change', () => { void load(); });
  decay.addEventListener('change', () => { void load(); });
  document.querySelector('#wireframe')!.addEventListener('click', () => {
    object.traverse((node) => { if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) if ('wireframe' in material) material.wireframe = !material.wireframe; }); render();
  });
  let exploded = false;
  document.querySelector('#explode')!.addEventListener('click', () => {
    exploded = !exploded;
    for (const name of registry.definition(id).animatedNodes) {
      const node = object.getObjectByName(name);
      if (node) node.position.y += (exploded ? 1 : -1) * extent * .15;
    }
    render();
  });
  document.querySelector('#nodes')!.addEventListener('change', (event) => {
    const node = object.getObjectByName((event.target as HTMLSelectElement).value);
    if (node) { node.getWorldPosition(controls.target); controls.update(); render(); }
  });
  async function deliveryView(quality: 'high' | 'lod1' | 'lod2', distance: number): Promise<void> {
    document.querySelector<HTMLSelectElement>('#quality')!.value = quality;
    await load();
    const elevation = Math.PI * .2, angle = Math.PI / 4;
    camera.position.set(center.x + Math.cos(angle) * Math.cos(elevation) * distance, center.y + Math.sin(elevation) * distance, center.z + Math.sin(angle) * Math.cos(elevation) * distance);
    controls.target.copy(center); controls.update(); camera.lookAt(center);
    await renderer.compileAsync(scene, camera); render(); render();
  }
  const ready = load();
  if (import.meta.env.DEV || params.has('test')) window.__ASSET__ = { ready, view, deliveryView, info: () => {
    const nodes: string[] = []; object.traverse((node) => { if (node.name) nodes.push(node.name); });
    return { placeholder: !!object.userData.placeholder, drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, nodes, events };
  }, goreProbe: async (name) => {
    const limb=object.getObjectByName(name), cap=object.getObjectByName(`stump_${name}`);
    if (!limb || !cap || cap.parent !== limb.parent) throw new Error(`Missing surviving-side cap for ${name}`);
    const hiddenBefore=!cap.visible, jointError=limb.getWorldPosition(new Vector3()).distanceTo(cap.getWorldPosition(new Vector3()));
    let capTriangles=0;
    cap.traverse(node=>{if(node instanceof Mesh)capTriangles+=(node.geometry.index?.count ?? node.geometry.attributes.position.count)/3;});
    limb.removeFromParent(); cap.visible=true;
    await renderer.compileAsync(scene,camera); render(); render();
    return {hiddenBefore,visibleAfter:cap.visible,capTriangles,jointError};
  }, crowdProbe: async () => {
    if (!(object instanceof Crowd)) throw new Error('Not the crowd-bake probe');
    const { crowdPoseError } = await import('./crowdProbe');
    const poseError = await crowdPoseError(renderer,object.clip);
    // Count the asset pass directly; screen presentation can add a renderer pass.
    const target = new RenderTarget(innerWidth,innerHeight);
    object.setTime(.25); renderer.setRenderTarget(target); render();
    const drawCalls = renderer.info.render.drawCalls;
    renderer.setRenderTarget(null); target.dispose(); render();
    return { instances: object.instanceCount, materials: object.children.length, drawCalls, poseError };
  } };
  await ready;
  window.addEventListener('resize', () => { renderer.setSize(innerWidth,innerHeight); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); render(); });
  window.addEventListener('pagehide', () => { controls.dispose(); if (object instanceof Crowd) object.dispose(); void registry.dispose(); renderer.dispose(); }, { once: true });
}
