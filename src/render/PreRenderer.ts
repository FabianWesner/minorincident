// Adapted from folio-2025 PreRenderer.js by Bruno Simon (MIT), commit 41046b5.
import { InstancedMesh, Light, LineSegments, Matrix4, Mesh, Sprite, Vector2, Vector3, type Camera, type Object3D, type Scene, type DataTexture } from 'three/webgpu';
import type { Renderer } from './Renderer';

/** Warm hidden variants while loading. The real render pass also uploads buffers/textures
 * and compiles shadow and soft-particle programs in their actual HDR/MSAA context. */
/** Compile lanes (WebGL): three's compileAsync awaits each object's program in turn, so one call
 * serializes every link. Concurrent calls over disjoint leaf sets let ANGLE's
 * KHR_parallel_shader_compile work on several programs (L1: 7.4 s -> 2.3 s under load). */
export const compileLanes = 6;
export const warmUpSize = 128;
export const textureUploadBudget = 4 * 1024 * 1024;
export type CompilePartitions = (() => void)[];
/** Same exact static layout needs one program/driver representative. */
function warmCandidates<T extends Object3D>(leaves: T[]): T[] {
  const seen = new Set<string>();
  return leaves.filter(leaf => {
    if (!(leaf instanceof InstancedMesh) || leaf.userData.preRenderSolo || Array.isArray(leaf.material) || leaf.material.userData.batchFeatures === undefined || Object.keys(leaf.geometry.morphAttributes).length) return true;
    const attributes = Object.keys(leaf.geometry.attributes).map(name => {
      const a = leaf.geometry.getAttribute(name) as import('three').BufferAttribute | import('three').InterleavedBufferAttribute;
      return `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}:${'isInstancedBufferAttribute' in a ? a.count : ''}`;
    }).sort().join('|');
    const key = `${leaf.material.uuid}:${leaf.material.customProgramCacheKey()}:${leaf.instanceMatrix.count}:${!!leaf.instanceColor}:${+leaf.castShadow}:${+leaf.receiveShadow}:${attributes}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
}
/** Spread an alternate light graph across playable frames. Compilation captures
 * one leaf synchronously, then waits for its asynchronous GPU link. New graphs
 * execute the same HDR pass in isolated ordinary/instanced draws before use.
 * Every temporary scene change is restored before the normal gameplay draw. */
export function incrementalPreRender(renderer: Renderer, scene: Scene, camera: Camera, render: () => void, compile: (root: Object3D) => Promise<void>, source: <T>(run: () => T) => T) {
  let leaves: (Mesh | Sprite | LineSegments)[] = [];
  scene.traverse(object => {
    if (!object.userData.preventPreRender && (object instanceof Mesh || object instanceof Sprite || object instanceof LineSegments) && object.geometry.hasAttribute('position')) leaves.push(object);
  });
  leaves = warmCandidates(leaves);
  let index = 0, phase: 'compile' | 'waiting' | 'draw' = 'compile', instances = 1, error: unknown;
  const representative = <T>(object: Mesh | Sprite | LineSegments, count: number, run: () => T): T => {
    const visible = object.visible, culled = object.frustumCulled, automatic = object.matrixAutoUpdate;
    const matrix = object.matrix.clone(), worldMatrix = object.matrixWorld.clone();
    const instanced = object instanceof InstancedMesh, originalCount = instanced ? object.count : 0;
    const matrices = instanced ? Array.from({ length: Math.min(2, object.instanceMatrix.count) }, (_, i) => { const matrix = new Matrix4(); object.getMatrixAt(i, matrix); return matrix; }) : [];
    const focus = camera.getWorldDirection(new Vector3()).multiplyScalar(20).add(camera.position);
    object.visible = true; object.frustumCulled = false;
    if (instanced) {
      object.count = count;
      const local = object.worldToLocal(focus);
      matrices.forEach((_, i) => object.setMatrixAt(i, new Matrix4().makeTranslation(local.x + i * .3, local.y, local.z)));
      object.instanceMatrix.needsUpdate = true;
    } else {
      if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      const center = object.geometry.boundingSphere!.center.clone().applyMatrix4(object.matrix);
      const local = object.parent ? object.parent.worldToLocal(focus) : focus;
      object.matrixAutoUpdate = false;
      object.matrix.elements[12] += local.x - center.x; object.matrix.elements[13] += local.y - center.y; object.matrix.elements[14] += local.z - center.z;
      object.updateMatrixWorld(true);
    }
    try { return source(run); }
    finally {
      object.visible = visible; object.frustumCulled = culled; object.matrixAutoUpdate = automatic;
      object.matrix.copy(matrix); object.matrixWorld.copy(worldMatrix); object.matrixWorldNeedsUpdate = true;
      if (instanced) { object.count = originalCount; matrices.forEach((matrix, i) => object.setMatrixAt(i, matrix)); object.instanceMatrix.needsUpdate = true; }
    }
  };
  return {
    get done() { return index >= leaves.length; },
    get remaining() { return leaves.length - index; },
    cancel() { index = leaves.length; leaves.length = 0; },
    step(): void {
      if (error) { const failure = error; this.cancel(); throw failure; }
      if (this.done || phase === 'waiting') return;
      const object = leaves[index];
      if (phase === 'compile') {
        // Viewport depth copies acquire their multisampled texture during the
        // actual HDR pass. Precompiling that binding would use its 1×1 fallback.
        if (renderer.selectedBackend === 'webgpu' && object.userData.preRenderNeedsDepth) { phase = 'draw'; instances = 1; return; }
        const before = renderer.nodeBuilds, foreground = renderer.foregroundCompile;
        const background = scene.background, backgroundNode = scene.backgroundNode;
        let pending: Promise<void>;
        try {
          // Capture this leaf's light graph before restoring the gameplay source.
          // r186 caches the light hash by info.calls, but compileAsync does not
          // advance it. It also queues the background before the requested leaf;
          // omit that unrelated item so this leaf builds before the first await.
          (renderer.info as unknown as { calls: number }).calls++;
          scene.background = null; scene.backgroundNode = null;
          renderer.foregroundCompile = true;
          pending = representative(object, 1, () => compile(object));
        } finally { renderer.foregroundCompile = foreground; scene.background = background; scene.backgroundNode = backgroundNode; }
        const changed = renderer.nodeBuilds !== before; phase = 'waiting';
        void pending.then(() => {
          if (this.done) return;
          if (changed) { phase = 'draw'; instances = 1; }
          else { index++; phase = 'compile'; }
        }, failure => { error = failure; });
        return;
      }
      // Restrict casters as well as receivers, so a first spot draw cannot build
      // the whole shadow scene at once. Groups retain the path to this leaf.
      const visible: [Object3D, boolean][] = [], after = object.onAfterRender;
      scene.traverse(node => {
        if (node instanceof Light) return;
        visible.push([node, node.visible]);
        node.visible = node === object || !(node instanceof Mesh || node instanceof Sprite || node instanceof LineSegments);
      });
      object.onAfterRender = () => {}; // Warm-up draws are not visible-figure observations.
      try {
        renderer.nextNodeFrame(); representative(object, instances, render);
      } finally {
        for (const [node, wasVisible] of visible) node.visible = wasVisible;
        object.onAfterRender = after; renderer.nextNodeFrame();
      }
      if (instances === 1 && object instanceof InstancedMesh && object.instanceMatrix.count > 1) instances = 2;
      else { index++; phase = 'compile'; }
    },
  };
}
export async function preRender(renderer: Renderer, scene: Scene, camera: Camera, render: () => void, compile: (partitions: CompilePartitions) => Promise<unknown> = partitions => Promise.all(partitions.map(apply => { apply(); return renderer.compileAsync(scene, camera); })), pause?: () => Promise<void>, progress?: (completed: number, total: number) => void, background = false, budgetedWarmUp = false, cooperative = false): Promise<void> {
  const saved: { object: Object3D; visible: boolean; culled: boolean; count?: number; matrices?: Matrix4[]; position?: Vector3 }[] = [];
  scene.updateMatrixWorld(true);
  const focus = camera.getWorldDirection(new Vector3()).multiplyScalar(20).add(camera.position);
  const size = renderer.getSize(new Vector2());
  try {
    scene.traverse(object => {
      // Hidden geometry needs warming; hidden lights must retain the gameplay
      // light list. Enabling the inactive hero spot warmed the wrong node cache
      // for every daylight batch, leaving distant objects cold on first use.
      if (object.userData.preventPreRender || object instanceof Light) return;
      // Reserved hero slots have no vertices until their streamed model arrives.
      if ((object instanceof Mesh || object instanceof LineSegments) && !object.geometry.hasAttribute('position')) return;
      const matrices = object instanceof InstancedMesh ? Array.from({ length: Math.min(2, object.instanceMatrix.count) }, (_, i) => { const matrix = new Matrix4(); object.getMatrixAt(i, matrix); return matrix; }) : undefined;
      saved.push({ ...(object instanceof LineSegments ? {position:object.position.clone()}:{}), object, visible: object.visible, culled: object.frustumCulled, ...(object instanceof InstancedMesh ? { count: object.count, matrices } : {}) });
      object.visible = true;
      if (object instanceof LineSegments) object.position.copy(object.parent ? object.parent.worldToLocal(focus.clone()) : focus);
      if (object instanceof Mesh || object instanceof Sprite || object instanceof LineSegments) object.frustumCulled = false;
      if (object instanceof InstancedMesh) {
        // Metal can defer pipeline work until vertices actually cover pixels. Empty batches
        // at the origin are outside the loading camera: draw one representative in front of it.
        object.count = 1;
        const p = object.worldToLocal(focus.clone());
        for (let i = 0; i < matrices!.length; i++) object.setMatrixAt(i, new Matrix4().makeTranslation(p.x + i * .2, p.y, p.z));
        object.instanceMatrix.needsUpdate = true;
      }
    });
    renderer.setSize(warmUpSize, warmUpSize, false);
    const start = performance.now();
    // Each partition shows only its share of leaves while three collects that call's render list
    // (synchronously), so the lanes compile disjoint objects concurrently.
    const leaves: Object3D[] = [];
    scene.traverse(object => { if (!object.userData.preventPreRender && (object instanceof Sprite || (object instanceof Mesh || object instanceof LineSegments) && object.geometry.hasAttribute('position'))) leaves.push(object); });
    // Static batches share node graphs. Compile one representative of each exact
    // material/attribute/shadow/capacity variant; the draws below still upload and
    // execute every render object, including both instancing driver paths.
    // Viewport-depth bindings acquire their multisampled texture in the HDR draw.
    // As with incremental warm-up, compile the other graphs first and let that draw
    // build the depth-dependent leaves against their actual target.
    const candidates = warmCandidates(leaves).filter(leaf => renderer.selectedBackend !== 'webgpu' || !leaf.userData.preRenderNeedsDepth);
    // Shared pose materials change their texture in onBeforeRender. Explicitly
    // warm every batch's atlas before compilation, rather than only the last binding.
    // Keep upload work within 4 MiB between paints; every shipped atlas fits that budget.
    if (renderer.selectedBackend === 'webgpu' && budgetedWarmUp && pause) {
      const textures = new Set<DataTexture>(leaves.flatMap(leaf => leaf.userData.preRenderTextures ?? []));
      let bytes = 0;
      for (const texture of textures) {
        const size = texture.image.data?.byteLength ?? 0;
        if (bytes && bytes + size > textureUploadBudget) { await pause(); bytes = 0; }
        renderer.initTexture(texture); bytes += size;
      }
      await pause();
      performance.measure('Texture atlas upload', { start, end: performance.now() });
    }
    progress?.(0, 1);
    const lanes = cooperative ? 1 : compileLanes;
    const partitions = Array.from({ length: lanes }, (_, lane) => () => { leaves.forEach(leaf => { leaf.visible = false; }); candidates.forEach((leaf, i) => { leaf.visible = i % lanes === lane; }); });
    // Compile foreground WebGPU pipelines asynchronously before drawing on every level.
    // Synchronous creation defers compilation to Dawn's GPU-process command flush,
    // blocking later queue writes/fences. Disjoint lanes retain the actual HDR context.
    // Background node builds keep Three's cooperative yielding.
    const compilationStart = performance.now(), foregroundCompile = renderer.foregroundCompile;
    try {
      // The L7 -> L8 card still owns the frame budget. Use Three's yielding
      // node builds serially instead of stacking six complete graphs in a task.
      renderer.foregroundCompile = !background && !cooperative;
      if (renderer.selectedBackend === 'webgl' || !background) await compile(partitions); else if (background) await compile([() => {}]);
    } finally { renderer.foregroundCompile = foregroundCompile; for (const leaf of leaves) leaf.visible = true; }
    performance.measure('L1 shader compilation', { start: compilationStart, end: performance.now() });
    // Background (menu-time) warm-up: draw the leaves in small groups, one group per gate slot, so
    // node builds and pipeline creation never form one long task; the full draw below is then cheap.
    const solo = renderer.selectedBackend === 'webgl' ? saved.filter(({ object }) => object instanceof InstancedMesh && object.userData.preRenderSolo) : [];
    // L3 WebGPU draws at most 64 leaves per frame behind the card, so cold atlases
    // do not accumulate in a single draw. WebGL retains its measured batching.
    const chunk = cooperative ? 16 : background ? renderer.selectedBackend === 'webgl' ? 64 : 16 : renderer.selectedBackend === 'webgpu' && budgetedWarmUp ? 64 : 1024, soloChunk = cooperative ? 8 : 64, chunks = pause ? Math.ceil(leaves.length / chunk) : 0, total = chunks + Math.ceil(solo.length / soloChunk) * 2 + 3;
    let completed = 1; progress?.(completed, total);
    if (pause) {
      for (let from = 0; from < leaves.length; from += chunk) {
        await pause();
        leaves.forEach((leaf, i) => { leaf.visible = i >= from && i < from + chunk; });
        try { render(); } finally { for (const leaf of leaves) leaf.visible = true; }
        progress?.(++completed, total);
      }
      performance.measure('L1 warm-up chunks', { start, end: performance.now() });
      await pause();
    }
    const draw = performance.now(); render();
    await renderer.finishWarmUp(); progress?.(++completed, total);
    performance.measure('L1 warm-up draw', { start: draw, end: performance.now() }); let phase = performance.now();
    // Three switches from drawArrays/Elements to their instanced variants only above
    // one instance. ANGLE Metal specializes both driver pipelines on their first draw.
    for (const { object, matrices } of saved) if (object instanceof InstancedMesh) object.count = matrices!.length;
    render(); await renderer.finishWarmUp(); progress?.(++completed, total);
    performance.measure('L1 warm-up instanced draw', { start: phase, end: performance.now() }); phase = performance.now();
    // Opaque district geometry can cover the animated batches in the tiny target.
    // Draw animated batches without opaque geometry so ANGLE executes their fragment pipelines, rather than
    // postponing native specialization until the first infected becomes visible.
    // WebGPU pipelines are complete at creation (no lazy driver specialization): measured 0 new
    // pipelines but seconds of frame pacing in these solo draws, so they run on WebGL only.
    if (solo.length) {
      for (const { object } of saved) if (object instanceof Mesh || object instanceof Sprite || object instanceof LineSegments) object.visible = false;
      // Sixty-four separated actors fit an 8x8 grid in the 128px target.
      // Each still executes the ordinary and instanced driver paths, but shares the GPU fence
      // and presented frame with its neighbors instead of paying two frames per actor.
      const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const halfWidth = 20 / Math.abs(camera.projectionMatrix.elements[0]), halfHeight = 20 / Math.abs(camera.projectionMatrix.elements[5]);
      // Each actor retains the old 16px cell coverage, including narrow meshes.
      const scale = .5 * Math.min(1, halfWidth * .125, halfHeight * .125);
      for (let from = 0; from < solo.length; from += soloChunk) {
        const group = solo.slice(from, from + soloChunk);
        group.forEach(({ object, matrices }, i) => {
          object.visible = true;
          const center = focus.clone().addScaledVector(right, (i % 8 * .25 - .875 + 1 / warmUpSize) * halfWidth).addScaledVector(up, (Math.floor(i / 8) * .25 - .875 + 1 / warmUpSize) * halfHeight);
          const mesh = object as InstancedMesh;
          for (let instance = 0; instance < matrices!.length; instance++) {
            const local = object.worldToLocal(center.clone().addScaledVector(right, instance * scale * .4));
            mesh.setMatrixAt(instance, new Matrix4().makeScale(scale, scale, scale).setPosition(local));
          }
          mesh.instanceMatrix.needsUpdate = true;
        });
        for (const instanced of [false, true]) {
          for (const { object, matrices } of group) (object as InstancedMesh).count = instanced ? matrices!.length : 1;
          render(); await renderer.finishWarmUp(); progress?.(++completed, total);
        }
        for (const { object } of group) object.visible = false;
      }
    }
    performance.measure('L1 warm-up solo draws', { start: phase, end: performance.now() });
    performance.measure('L1 driver warm-up', { start: draw, end: performance.now() });
  } finally {
    for (const { object, visible, culled, count, matrices, position } of saved) {
      object.visible = visible; object.frustumCulled = culled; if(position)object.position.copy(position);
      if (object instanceof InstancedMesh && count !== undefined) { object.count = count; matrices!.forEach((matrix, i) => object.setMatrixAt(i, matrix)); object.instanceMatrix.needsUpdate = true; }
    }
    renderer.setSize(size.x, size.y, false);
  }
}
