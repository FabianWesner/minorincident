/** Browser-only review stage, using the same registry/materials as the asset viewer. */
import { AmbientLight, Box3, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu';
import { AssetRegistry } from '../../src/assets/registry';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';

export async function createStage() {
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: true });
  renderer.setPixelRatio(1); renderer.setSize(300, 260); await renderer.init();
  document.body.replaceChildren(renderer.domElement);
  document.body.style.cssText = 'margin:0;background:#2a2730';
  renderer.setClearColor('#2a2730');
  const scene = new Scene();
  scene.add(new HemisphereLight('#ffe2b6', '#635078', 2), new AmbientLight('#ffe8c8', .3));
  const sun = new DirectionalLight('#ffd5a2', 3); sun.position.set(5, 8, 5); scene.add(sun);
  const camera = new PerspectiveCamera(25, 300 / 260, .01, 500);
  const events: unknown[] = [];
  const registry = new AssetRegistry(event => events.push(event), { renderer, manifest: manifest as AssetDef[] });
  let object: Awaited<ReturnType<AssetRegistry['loadAsset']>> | undefined;
  return {
    async capture(id: string, quality: 'high' | 'lod1' | 'lod2', pixels: number, member?: string, azimuth = 45) {
      if (object) scene.remove(object);
      object = await registry.loadAsset(id, quality);
      if (object.userData.placeholder) throw new Error(`Placeholder ${id}:${quality}`);
      scene.add(object); object.updateMatrixWorld(true);
      if (member) {
        const selected = object.getObjectByName(member);
        if (!selected) throw new Error(`Missing member ${member}`);
        const position = selected.getWorldPosition(new Vector3());
        object.traverse(n => {
          if (/^survivor\d\d_root$/.test(n.name) && n !== selected) n.visible = false;
        });
        // Center the selected member without changing its rest frame.
        object.position.sub(position); object.updateMatrixWorld(true);
      }
      const visible = member ? object.getObjectByName(member)! : object;
      const box = new Box3().setFromObject(visible), center = box.getCenter(new Vector3()), size = box.getSize(new Vector3());
      const elevation = Math.PI * .2, angle = azimuth * Math.PI / 180;
      // FOV25, polar .30pi. Match projected character height, not canvas height.
      const depth = Math.abs(Math.cos(angle)) * size.x + Math.abs(Math.sin(angle)) * size.z;
      const height = Math.cos(elevation) * size.y + Math.sin(elevation) * depth;
      const distance = height * 260 / pixels / (2 * Math.tan(camera.fov * Math.PI / 360));
      camera.position.set(center.x + Math.cos(angle) * Math.cos(elevation) * distance, center.y + Math.sin(elevation) * distance, center.z + Math.sin(angle) * Math.cos(elevation) * distance);
      camera.lookAt(center); await renderer.compileAsync(scene, camera); renderer.render(scene, camera); renderer.render(scene, camera);
      return { id, quality, pixels, member, placeholder: false, events, draws: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles };
    },
  };
}
