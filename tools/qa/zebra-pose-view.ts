/** Browser-only pose inspection using the shipped GLBs, game materials and camera angle. */
import { AnimationMixer, Box3, PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Lighting } from '../../src/render/Lighting';
import { Materials } from '../../src/render/Materials';
import { AssetMaterials } from '../../src/assets/materials';

export async function drawPose(id: string, lod: number, clip: string, seconds: number) {
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: true });
  renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); await renderer.init();
  document.body.replaceChildren(renderer.domElement);
  const scene = new Scene(), lighting = new Lighting(scene, undefined, renderer);
  lighting.set('golden'); lighting.applyLook();
  const materials = new Materials(lighting), palette = new AssetMaterials(materials);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/assets/models/${id}${lod ? `.lod${lod}` : ''}.glb`);
  gltf.scene.traverse(node => { if (node.userData.hidden) node.visible = false; });
  palette.swap(gltf.scene);
  scene.add(gltf.scene);
  const mixer = new AnimationMixer(gltf.scene), animation = gltf.animations.find(a => a.name === clip);
  if (!animation) throw new Error(`Missing ${clip}`);
  mixer.clipAction(animation).play(); mixer.setTime(seconds); gltf.scene.updateMatrixWorld(true);
  const center = new Box3().setFromObject(gltf.scene).getCenter(new Vector3());
  const camera = new PerspectiveCamera(25, innerWidth / innerHeight, .01, 500);
  camera.position.copy(center).add(new Vector3(1, 1.027, 1).normalize().multiplyScalar(12)); camera.lookAt(center);
  renderer.setClearColor('#2a2730'); await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
  const label = document.createElement('div'); label.style.cssText = 'position:fixed;top:0;left:0;background:#17151b;color:white;padding:8px;font:16px sans-serif';
  label.textContent = `${id} LOD${lod} · ${clip} ${seconds.toFixed(2)}s`; document.body.append(label);
}
