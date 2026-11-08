/** Colour-ID source pass for the real SSR ray march; all non-car depth stays intact. */
import { Color, MeshBasicNodeMaterial, type InstancedMesh, type Mesh, type Object3D } from 'three/webgpu';
import { positionWorld, vec3, vec4 } from 'three/tsl';
import type { Game } from '../../src/Game';
import type { PostFx } from '../../src/render/PostFx';
import type { WetReflections } from '../../src/render/lighting/WetReflections';
import { weatherSurface } from '../../src/render/WeatherView';
export const surfaceWetness = () => weatherSurface.wetness.value;
/** Prove sample pixels belong to the actual synthetic floor, retaining opaque occlusion. */
export function installGroundMask(g: Game) {
  const saved = new Map<Mesh, import('three').Material | import('three').Material[]>(), masks: MeshBasicNodeMaterial[] = [];
  const post = (g.view as unknown as { postFx: { pipeline: PostFx['pipeline']; scenePass: { getTextureNode(name: string): import('three/webgpu').TextureNode } } }).postFx;
  const output = post.pipeline.outputNode, background = g.view.scene.background, backgroundNode = g.view.scene.backgroundNode;
  g.view.scene.backgroundNode = null; g.view.scene.background = new Color(0);
  g.view.scene.traverse(node => {
    const mesh = node as Mesh; if (!mesh.geometry || !mesh.material) return;
    saved.set(mesh, mesh.material);
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshBasicNodeMaterial;
    const mask = new MeshBasicNodeMaterial({ color: mesh.name === 'scene-ground' ? 0xffffff : 0, positionNode: source.positionNode, maskNode: source.maskNode, side: source.side, depthTest: source.depthTest, depthWrite: source.depthWrite, transparent: source.transparent, opacity: source.opacity });
    const pattern = positionWorld.x.mul(.65).sin().mul(positionWorld.z.mul(.5).sin()).mul(.5).add(.5);
    const wet = pattern.smoothstep(weatherSurface.wetness.oneMinus(), weatherSurface.wetness.oneMinus().add(.15)).mul(weatherSurface.wetness.smoothstep(.3, .4));
    // R identifies the actual floor; G independently evaluates its production wet mask.
    mask.outputNode = mesh.name === 'scene-ground' ? vec4(1, wet, 0, 1) : vec4(0, 0, 0, 1);
    mesh.material = mask; masks.push(mask);
  });
  post.pipeline.outputNode = post.scenePass.getTextureNode('output'); post.pipeline.needsUpdate = true;
  return { restore() {
    for (const [mesh, material] of saved) mesh.material = material; masks.forEach(m => m.dispose());
    post.pipeline.outputNode = output; post.pipeline.needsUpdate = true;
    g.view.scene.background = background; g.view.scene.backgroundNode = backgroundNode;
  } };
}
export function installReflectionMask(g: Game) {
  const post = (g.view as unknown as { postFx: { pipeline: PostFx['pipeline']; wetReflections: WetReflections; scenePass: { getTextureNode(name: string): import('three/webgpu').TextureNode } } }).postFx;
  const cars: InstancedMesh[] = [];
  g.view.scene.backgroundNode = null; g.view.scene.background = new Color(0);
  g.view.scene.traverse(n => {
    const mesh = n as InstancedMesh; if (!mesh.geometry || !mesh.material) return;
    let car = false; for (let p: Object3D | null = n; p; p = p.parent) if (p.name.startsWith('inst:veh.sedan-green')) car = true;
    if (car) cars.push(mesh);
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshBasicNodeMaterial;
    const mask = new MeshBasicNodeMaterial({ color: car ? 0xffffff : 0, positionNode: source.positionNode, maskNode: source.maskNode, side: source.side, depthTest: source.depthTest, depthWrite: source.depthWrite, transparent: source.transparent, opacity: source.opacity });
    mask.outputNode = vec4(vec3(car ? 1 : 0), 1); mesh.material = mask;
  });
  post.wetReflections.enabled.value = 1;
  post.pipeline.outputNode = vec4(post.wetReflections.reflection.rgb, 1); post.pipeline.needsUpdate = true;
  return { meshes: cars.length, expected() {
    g.view.scene.traverse(n => { if ((n as Mesh).geometry && !cars.includes(n as InstancedMesh)) n.visible = false; });
    for (const mesh of cars) {
      mesh.geometry = mesh.geometry.clone();
      const a = mesh.geometry.getAttribute('position');
      const matrix = mesh.matrix.clone(); mesh.getMatrixAt(0, matrix);
      const offset = matrix.elements[13] + mesh.matrixWorld.elements[13];
      for (let i = 0; i < a.count; i++) a.setY(i, .004 - a.getY(i) - 2 * offset); a.needsUpdate = true;
      const material = mesh.material as MeshBasicNodeMaterial; material.side = 2; material.needsUpdate = true;
    }
    post.pipeline.outputNode = post.scenePass.getTextureNode('output'); post.pipeline.needsUpdate = true;
  } };
}
