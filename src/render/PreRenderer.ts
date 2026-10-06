// Adapted from folio-2025 PreRenderer.js by Bruno Simon (MIT), commit 41046b5.
import { InstancedMesh, Matrix4, Mesh, Sprite, Vector2, Vector3, type Camera, type Object3D, type Scene } from 'three/webgpu';
import type { Renderer } from './Renderer';

/** Warm hidden variants while loading. The real render pass also uploads buffers/textures
 * and compiles shadow and soft-particle programs in their actual HDR/MSAA context. */
export async function preRender(renderer: Renderer, scene: Scene, camera: Camera, render: () => void, compile = () => renderer.compileAsync(scene, camera)): Promise<void> {
  const saved: { object: Object3D; visible: boolean; culled: boolean; count?: number; matrices?: Matrix4[] }[] = [];
  scene.updateMatrixWorld(true);
  const focus = camera.getWorldDirection(new Vector3()).multiplyScalar(20).add(camera.position);
  const size = renderer.getSize(new Vector2());
  try {
    scene.traverse(object => {
      if (object.userData.preventPreRender) return;
      const matrices = object instanceof InstancedMesh ? Array.from({ length: Math.min(2, object.instanceMatrix.count) }, (_, i) => { const matrix = new Matrix4(); object.getMatrixAt(i, matrix); return matrix; }) : undefined;
      saved.push({ object, visible: object.visible, culled: object.frustumCulled, ...(object instanceof InstancedMesh ? { count: object.count, matrices } : {}) });
      object.visible = true;
      if (object instanceof Mesh || object instanceof Sprite) object.frustumCulled = false;
      if (object instanceof InstancedMesh) {
        // Metal can defer pipeline work until vertices actually cover pixels. Empty batches
        // at the origin are outside the loading camera: draw one representative in front of it.
        object.count = 1;
        const p = object.worldToLocal(focus.clone());
        for (let i = 0; i < matrices!.length; i++) object.setMatrixAt(i, new Matrix4().makeTranslation(p.x + i * .2, p.y, p.z));
        object.instanceMatrix.needsUpdate = true;
      }
    });
    renderer.setSize(32, 32, false);
    const start = performance.now();
    if (renderer.selectedBackend === 'webgl') await compile();
    performance.measure('L1 shader compilation', { start, end: performance.now() });
    const draw = performance.now(); render();
    await renderer.finishWarmUp();
    // Three switches from drawArrays/Elements to their instanced variants only above
    // one instance. ANGLE Metal specializes both driver pipelines on their first draw.
    for (const { object, matrices } of saved) if (object instanceof InstancedMesh) object.count = matrices!.length;
    render(); await renderer.finishWarmUp();
    performance.measure('L1 driver warm-up', { start: draw, end: performance.now() });
  } finally {
    for (const { object, visible, culled, count, matrices } of saved) {
      object.visible = visible; object.frustumCulled = culled;
      if (object instanceof InstancedMesh && count !== undefined) { object.count = count; matrices!.forEach((matrix, i) => object.setMatrixAt(i, matrix)); object.instanceMatrix.needsUpdate = true; }
    }
    renderer.setSize(size.x, size.y, false);
  }
}
