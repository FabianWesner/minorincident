// Adapted from folio-2025 PreRenderer.js by Bruno Simon (MIT), commit 41046b5.
import { InstancedMesh, Matrix4, Mesh, Sprite, Vector2, Vector3, type Camera, type Object3D, type Scene } from 'three/webgpu';
import type { Renderer } from './Renderer';

/** Warm hidden variants while loading. The real render pass also uploads buffers/textures
 * and compiles shadow and soft-particle programs in their actual HDR/MSAA context. */
/** Compile lanes (WebGL): three's compileAsync awaits each object's program in turn, so one call
 * serializes every link. Concurrent calls over disjoint leaf sets let ANGLE's
 * KHR_parallel_shader_compile work on several programs (L1: 7.4 s -> 2.3 s under load). */
export const compileLanes = 6;
export type CompilePartitions = (() => void)[];
export async function preRender(renderer: Renderer, scene: Scene, camera: Camera, render: () => void, compile: (partitions: CompilePartitions) => Promise<unknown> = partitions => Promise.all(partitions.map(apply => { apply(); return renderer.compileAsync(scene, camera); })), pause?: () => Promise<void>): Promise<void> {
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
    // Each partition shows only its share of leaves while three collects that call's render list
    // (synchronously), so the lanes compile disjoint objects concurrently.
    const leaves: Object3D[] = [];
    scene.traverse(object => { if (!object.userData.preventPreRender && (object instanceof Mesh || object instanceof Sprite)) leaves.push(object); });
    const partitions = Array.from({ length: compileLanes }, (_, lane) => () => { leaves.forEach((leaf, i) => { leaf.visible = i % compileLanes === lane; }); });
    // WebGL only: measured on WebGPU, three's per-object compileAsync costs more than the
    // synchronous pipeline creation of the warm-up draw (L1: 1.6-2.8 s vs +0.2 s).
    // Background (menu-time) warm-up on WebGPU: three's compileAsync builds node graphs asynchronously,
    // yielding between objects, so the big material builds do not land in one long task.
    try { if (renderer.selectedBackend === 'webgl') await compile(partitions); else if (pause) await compile([() => {}]); } finally { for (const leaf of leaves) leaf.visible = true; }
    performance.measure('L1 shader compilation', { start, end: performance.now() });
    // Background (menu-time) warm-up: draw the leaves in small groups, one group per gate slot, so
    // node builds and pipeline creation never form one long task; the full draw below is then cheap.
    if (pause) {
      const chunk = 16;
      for (let from = 0; from < leaves.length; from += chunk) {
        await pause();
        leaves.forEach((leaf, i) => { leaf.visible = i >= from && i < from + chunk; });
        try { render(); } finally { for (const leaf of leaves) leaf.visible = true; }
      }
      performance.measure('L1 warm-up chunks', { start, end: performance.now() });
      await pause();
    }
    const draw = performance.now(); render();
    await renderer.finishWarmUp();
    performance.measure('L1 warm-up draw', { start: draw, end: performance.now() }); let phase = performance.now();
    // Three switches from drawArrays/Elements to their instanced variants only above
    // one instance. ANGLE Metal specializes both driver pipelines on their first draw.
    for (const { object, matrices } of saved) if (object instanceof InstancedMesh) object.count = matrices!.length;
    render(); await renderer.finishWarmUp();
    performance.measure('L1 warm-up instanced draw', { start: phase, end: performance.now() }); phase = performance.now();
    // Opaque district geometry can cover the animated batches in the tiny target.
    // Draw each one alone so ANGLE executes its fragment pipeline, rather than
    // postponing native specialization until the first infected becomes visible.
    // WebGPU pipelines are complete at creation (no lazy driver specialization): measured 0 new
    // pipelines but seconds of frame pacing in these solo draws, so they run on WebGL only.
    const solo = renderer.selectedBackend === 'webgl' ? saved.filter(({ object }) => object instanceof InstancedMesh && object.userData.preRenderSolo) : [];
    if (solo.length) {
      for (const { object } of saved) if (object instanceof Mesh || object instanceof Sprite) object.visible = false;
      for (const { object, matrices } of solo) {
        const mesh = object as InstancedMesh; mesh.visible = true;
        for (const count of [1, matrices!.length]) { mesh.count = count; render(); await renderer.finishWarmUp(); }
        mesh.visible = false;
      }
    }
    performance.measure('L1 warm-up solo draws', { start: phase, end: performance.now() });
    performance.measure('L1 driver warm-up', { start: draw, end: performance.now() });
  } finally {
    for (const { object, visible, culled, count, matrices } of saved) {
      object.visible = visible; object.frustumCulled = culled;
      if (object instanceof InstancedMesh && count !== undefined) { object.count = count; matrices!.forEach((matrix, i) => object.setMatrixAt(i, matrix)); object.instanceMatrix.needsUpdate = true; }
    }
    renderer.setSize(size.x, size.y, false);
  }
}
