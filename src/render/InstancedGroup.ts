// Adapted from folio-2025 InstancedGroup.js by Bruno Simon (MIT), commit 41046b5.
import { type BufferGeometry, type Raycaster, type Intersection, Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, Vector3 } from 'three/webgpu';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { staticInstanceAttributes } from './StaticInstanceAttributes';
import { prepareOcclusionGeometry, geometryOccludes } from './OcclusionGeometry';

// Shared scratch, like Three's InstancedMesh.raycast; queries are synchronous.
const raycastMesh = new Mesh();
const raycastHits: Intersection[] = [];
const emptyRaycastGeometry = raycastMesh.geometry, emptyRaycastMaterial = raycastMesh.material;

const raycastTrees = new WeakMap<BufferGeometry, MeshBVH>();

/** One batch per prototype mesh; nested child transforms are preserved. Geometry/material ownership stays with the caller. */
export class InstancedGroup extends Group {
  private readonly batches: { mesh: InstancedMesh; source: BufferGeometry; local: Matrix4; occlusion?: ReturnType<typeof prepareOcclusionGeometry>; base?: Matrix4; door?: string; interior?: boolean; indices?: number[] }[] = [];
  private readonly scratch = new Matrix4();
  private readonly color = new Color();
  private frozenWorld = false;
  constructor(prototype: Object3D, readonly references: Object3D[], readonly capacity = references.length) {
    super(); prototype.updateWorldMatrix(true, true);
    this.userData.placeholder = prototype.userData.placeholder === true;
    const inverse = prototype.matrixWorld.clone().invert();
    prototype.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      for (let parent: Object3D | null = child; parent; parent = parent.parent) if (!parent.visible) return;
      const powered = child.geometry.hasAttribute('_lightBase');
      const cut = (Array.isArray(child.material) ? child.material : [child.material]).some(m => m.userData.seeThrough === true);
      const geometry = powered ? child.geometry.clone() : child.geometry;
      // Windows already use all eight portable vertex buffers: share one instance buffer for power and occlusion.
      if (powered && cut) {
        const state = new InstancedInterleavedBuffer(new Float32Array(capacity * 2), 2, 1).setUsage(DynamicDrawUsage);
        geometry.setAttribute('_lightBase', new InterleavedBufferAttribute(state, 1, 0));
        geometry.setAttribute('_occluder', new InterleavedBufferAttribute(state, 1, 1));
      } else if (powered) geometry.setAttribute('_lightBase', new InstancedBufferAttribute(new Float32Array(capacity), 1));
      // Bar occlusion uses exact mesh boxes; prepare them with the asset, before play.
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const mesh = new InstancedMesh(geometry, child.material, capacity);
      // Warm-up and LOD repartition both rewrite these transforms. Three's
      // generated interleaved matrix buffer must upload after either change.
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.userData.ownedPowerGeometry = powered;
      mesh.count = references.length;
      // White is the identity tint. One vertex-input layout warms the same
      // pipeline for untinted and charred/tinted placements and every LOD.
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
      if (staticInstanceAttributes(mesh)) {
        if (powered) geometry.dispose();
        // The batch already owns attribute wrappers; keep immutable vertex arrays shared with its prototype.
        if (cut && !powered) mesh.geometry.setAttribute('_occluder', new InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage));
      }
      mesh.name = child.name; mesh.castShadow = child.castShadow; mesh.receiveShadow = child.receiveShadow;
      const local = new Matrix4().multiplyMatrices(inverse, child.matrixWorld), door = child.userData.door as string | undefined;
      this.batches.push({ mesh, source: child.geometry, local, occlusion: prepareOcclusionGeometry(child.geometry), interior: child.userData.interior === true, ...(door ? { door, base: local.clone() } : {}) }); this.add(mesh);
    });
    this.update();
  }
  /** Exact drawn-geometry occlusion for one placement selected by the district broad phase.
   * Respect compact interior indices and animated door/roof matrices without testing sibling placements. */
  occludesReference(ray: Raycaster, reference: Object3D): boolean {
    const referenceIndex = this.references.indexOf(reference);
    if (referenceIndex < 0) return false;
    try {
      for (const batch of this.batches) {
        const mesh = batch.mesh;
        const index = batch.indices ? batch.indices.indexOf(referenceIndex) : referenceIndex;
        if (index < 0 || index >= mesh.count) continue;
        mesh.getMatrixAt(index, this.scratch);
        raycastMesh.geometry = mesh.geometry; raycastMesh.material = mesh.material;
        raycastMesh.matrixWorld.multiplyMatrices(mesh.matrixWorld, this.scratch);
        if (batch.occlusion) {
          if (geometryOccludes(batch.occlusion, raycastMesh.matrixWorld, mesh.material, ray)) return true;
          continue;
        }
        raycastHits.length = 0; raycastMesh.raycast(ray, raycastHits);
        if (raycastHits.length) { raycastHits.length = 0; return true; }
      }
      return false;
    } finally { raycastMesh.geometry = emptyRaycastGeometry; raycastMesh.material = emptyRaycastMaterial; raycastHits.length = 0; }
  }
  private raycastMesh?: Mesh;
  private readonly raycastHits: Intersection[] = [];
  /** Exact static-prototype queries, reusing a triangle BVH across placement/LOD wrappers.
   * Indirect trees leave shared vertex/index buffers and material groups untouched. */
  intersectsRay(raycaster: Raycaster): boolean {
    const probe = this.raycastMesh ??= new Mesh();
    for (const batch of this.batches) {
      const mesh = batch.mesh;
      if (!mesh.count || !mesh.layers.test(raycaster.layers)) continue;
      let tree = raycastTrees.get(batch.source);
      if (!tree) { tree = new MeshBVH(batch.source, { indirect: true }); raycastTrees.set(batch.source, tree); }
      mesh.geometry.boundsTree = tree;
      probe.geometry = mesh.geometry; probe.material = mesh.material;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, this.scratch); probe.matrixWorld.multiplyMatrices(mesh.matrixWorld, this.scratch);
        this.raycastHits.length = 0;
        acceleratedRaycast.call(probe, raycaster, this.raycastHits);
        if (this.raycastHits.length) return true;
      }
    }
    return false;
  }
  private points?: Vector3[];
  /** District origins and batch-local transforms stay fixed; animated placements
   * live in the instance buffers. Cache the entire matrix walk after attachment. */
  freezeWorld(): void {
    this.updateWorldMatrix(true, true);
    this.traverse(node => { node.matrixAutoUpdate = false; node.matrixWorldAutoUpdate = false; });
    this.frozenWorld = true;
  }
  override updateMatrixWorld(force?: boolean): void {
    if (!this.frozenWorld) super.updateMatrixWorld(force);
  }
  /** Prototype vertices in placement space, cached for drawn-ground contact probes. */
  contactPoints(): readonly Vector3[] {
    if (!this.points) {
      this.points = [];
      for (const batch of this.batches) {
        const position = batch.mesh.geometry.getAttribute('position');
        for (let i = 0; i < position.count; i++) this.points.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(batch.local));
      }
    }
    return this.points;
  }
  /** Call only for dirty placements; no work in the render loop for static props. */
  update(indices?: readonly number[]): void {
    for (const batch of this.batches) {
      if (batch.interior) { this.updateInterior(batch); continue; }
      if (indices) {
        for (const i of indices) this.write(batch, i);
      } else for (let i = 0; i < this.references.length; i++) this.write(batch, i);
      batch.mesh.instanceMatrix.needsUpdate = true; if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true; batch.mesh.computeBoundingSphere();
    }
  }
  /** Compact only interior draws when a building opens/closes; exterior instance counts stay fixed. */
  interiorVisible(visible: boolean, reference: Object3D): void {
    reference.userData.interiorsVisible = visible;
    for (const batch of this.batches) if (batch.interior) this.updateInterior(batch);
  }
  private updateInterior(batch: (typeof this.batches)[number]): void {
    batch.indices = [];
    for (let i = 0; i < this.references.length; i++) if (this.references[i].userData.interiorsVisible !== false) batch.indices.push(i);
    batch.mesh.count = batch.indices.length;
    batch.mesh.visible = batch.mesh.count > 0;
    for (let i = 0; i < batch.indices.length; i++) this.write(batch, i);
    batch.mesh.instanceMatrix.needsUpdate = true;
    if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    batch.mesh.computeBoundingSphere();
  }
  /** Swing a split door leaf (staticBatch `splitDoors`): yaw about its hinge's +Y, on one placement or on every instance.
   * The yaw lives on the placement reference, so it survives LOD repartitions between the hero/near/far groups. */
  pose(door: string, yaw: number, reference?: Object3D, axis: 'y' | 'x' | 'z' = 'y'): void {
    for (const ref of reference ? [reference] : this.references) (ref.userData.doorAxis ??= {})[door] = axis;
    for (const ref of reference ? [reference] : this.references) (ref.userData.doorYaw ??= {} as Record<string, number>)[door] = yaw;
    for (const batch of this.batches) if (batch.door === door && batch.base) {
      for (let i = 0; i < this.references.length; i++) if (!reference || this.references[i] === reference) this.write(batch, i);
      batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.computeBoundingSphere();
    }
  }
  get doors(): string[] { return this.batches.flatMap(b => b.door ? [b.door] : []); }
  /** Move an authored sliding leaf vertically in asset space; the offset survives LOD repartitions. */
  slide(door: string, height: number, reference: Object3D): void {
    const shifts = reference.userData.doorHeight ??= {} as Record<string, number>;
    shifts[door] = height;
    for (const batch of this.batches) if (batch.door === door && batch.base) {
      const index = this.references.indexOf(reference);
      if (index < 0) continue;
      this.write(batch, index); batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.computeBoundingSphere();
    }
  }
  private readonly leaf = new Matrix4();
  private readonly axisX = new Vector3(1, 0, 0);
  private readonly axisY = new Vector3(0, 1, 0);
  private readonly axisZ = new Vector3(0, 0, 1);
  private readonly hiddenRoofScale = new Vector3(0, 0, 0);
  /** Only placements intersecting the camera-to-courier view may dissolve; siblings keep their opaque surfaces. */
  seeThrough(enabled: boolean, reference: Object3D, lens = false): void {
    reference.userData.occluder = enabled; reference.userData.lensOccluder = enabled && lens;
    const mode = enabled ? lens ? 2 : 1 : 0;
    const index = this.references.indexOf(reference);
    if (index < 0) return;
    for (const batch of this.batches) {
      if (batch.interior) { this.updateInterior(batch); continue; }
      const attr = batch.mesh.geometry.getAttribute('_occluder');
      if (attr && attr.getX(index) !== mode) { attr.setX(index, mode); attr.needsUpdate = true; }
    }
  }
  /** Hide only this placement's roof; reference state survives streaming and LOD repartition. */
  roofVisible(visible: boolean, reference: Object3D): void {
    reference.userData.roofHidden = !visible;
    const index = this.references.indexOf(reference);
    if (index < 0) return;
    for (const batch of this.batches) if (/^roof(?:$|-|_)/.test(batch.mesh.name)) {
      this.write(batch, index); batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.computeBoundingSphere();
    }
  }
  private write(batch: { mesh: InstancedMesh; local: Matrix4; base?: Matrix4; door?: string; indices?: number[] }, i: number): void {
    const reference = this.references[batch.indices?.[i] ?? i];
    const occluder = batch.mesh.geometry.getAttribute('_occluder');
    if (occluder) { occluder.setX(i, reference.userData.occluder === true ? reference.userData.lensOccluder ? 2 : 1 : 0); occluder.needsUpdate = true; }
    const lightBase = batch.mesh.geometry.getAttribute('_lightBase');
    if (batch.mesh.userData.ownedPowerGeometry) { lightBase.setX(i, reference.userData.lightBase ?? 0); lightBase.needsUpdate = true; }
    reference.updateWorldMatrix(true, false);
    const yaw = batch.door ? (reference.userData.doorYaw as Record<string, number> | undefined)?.[batch.door] ?? 0 : 0;
    const height = batch.door ? (reference.userData.doorHeight as Record<string, number> | undefined)?.[batch.door] ?? 0 : 0;
    const local = batch.base && (yaw || height) ? this.leaf.copy(batch.base).multiply(this.scratch.makeRotationAxis(batch.door && reference.userData.doorAxis?.[batch.door] === 'x' ? this.axisX : batch.door && reference.userData.doorAxis?.[batch.door] === 'z' ? this.axisZ : this.axisY, yaw)) : batch.local;
    if (height) local.elements[13] += height;
    this.scratch.multiplyMatrices(reference.matrixWorld, local);
    if (reference.userData.roofHidden && /^roof(?:$|-|_)/.test(batch.mesh.name)) this.scratch.scale(this.hiddenRoofScale);
    batch.mesh.setMatrixAt(i, this.scratch);
    const tint = reference.userData.tint; batch.mesh.setColorAt(i, this.color.set(typeof tint === 'string' ? tint : '#ffffff'));
  }
  dispose(): void { for (const batch of this.batches) { if (batch.mesh.userData.ownedPowerGeometry || batch.mesh.userData.staticInstanceAttributes) batch.mesh.geometry.dispose(); batch.mesh.dispose(); } this.clear(); this.batches.length = 0; this.raycastMesh = undefined; this.raycastHits.length = 0; }
}
