// Adapted from folio-2025 InstancedGroup.js by Bruno Simon (MIT), commit 41046b5.
import { Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, Vector3 } from 'three/webgpu';

/** One batch per prototype mesh; nested child transforms are preserved. Geometry/material ownership stays with the caller. */
export class InstancedGroup extends Group {
  private readonly batches: { mesh: InstancedMesh; local: Matrix4; base?: Matrix4; door?: string }[] = [];
  private readonly scratch = new Matrix4();
  private readonly tinted: boolean;
  private readonly color = new Color();
  constructor(prototype: Object3D, readonly references: Object3D[], readonly capacity = references.length) {
    super(); this.tinted = references.some(r => typeof r.userData.tint === 'string'); prototype.updateWorldMatrix(true, true);
    const inverse = prototype.matrixWorld.clone().invert();
    prototype.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      for (let parent: Object3D | null = child; parent; parent = parent.parent) if (!parent.visible) return;
      const mesh = new InstancedMesh(child.geometry, child.material, capacity);
      mesh.count = references.length;
      if (this.tinted) mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
      mesh.name = child.name; mesh.castShadow = child.castShadow; mesh.receiveShadow = child.receiveShadow;
      const local = new Matrix4().multiplyMatrices(inverse, child.matrixWorld), door = child.userData.door as string | undefined;
      this.batches.push({ mesh, local, ...(door ? { door, base: local.clone() } : {}) }); this.add(mesh);
    });
    this.update();
  }
  private points?: Vector3[];
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
      if (indices) {
        for (const i of indices) this.write(batch, i);
      } else for (let i = 0; i < this.references.length; i++) this.write(batch, i);
      batch.mesh.instanceMatrix.needsUpdate = true; if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true; batch.mesh.computeBoundingSphere();
    }
  }
  /** Swing a split door leaf (staticBatch `splitDoors`) on every instance: yaw about its hinge's +Y. */
  pose(door: string, yaw: number): void {
    const indices: number[] = [];
    for (let i = 0; i < this.references.length; i++) indices.push(i);
    for (const batch of this.batches) if (batch.door === door && batch.base) {
      batch.local.copy(batch.base).multiply(this.scratch.makeRotationY(yaw));
      for (const i of indices) this.write(batch, i);
      batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.computeBoundingSphere();
    }
  }
  get doors(): string[] { return this.batches.flatMap(b => b.door ? [b.door] : []); }
  private write(batch: { mesh: InstancedMesh; local: Matrix4 }, i: number): void {
    this.references[i].updateWorldMatrix(true, false);
    this.scratch.multiplyMatrices(this.references[i].matrixWorld, batch.local); batch.mesh.setMatrixAt(i, this.scratch);
    const tint = this.references[i].userData.tint; if (batch.mesh.instanceColor && typeof tint === 'string') batch.mesh.setColorAt(i, this.color.set(tint));
  }
  dispose(): void { for (const batch of this.batches) batch.mesh.dispose(); this.clear(); this.batches.length = 0; }
}
