// Adapted from folio-2025 InstancedGroup.js by Bruno Simon (MIT), commit 41046b5.
import { Group, InstancedMesh, Matrix4, Mesh, Object3D } from 'three/webgpu';

/** One batch per prototype mesh; nested child transforms are preserved. Geometry/material ownership stays with the caller. */
export class InstancedGroup extends Group {
  private readonly batches: { mesh: InstancedMesh; local: Matrix4 }[] = [];
  private readonly scratch = new Matrix4();
  constructor(prototype: Object3D, readonly references: Object3D[]) {
    super(); prototype.updateWorldMatrix(true, true);
    const inverse = prototype.matrixWorld.clone().invert();
    prototype.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const mesh = new InstancedMesh(child.geometry, child.material, references.length);
      mesh.name = child.name; mesh.castShadow = child.castShadow; mesh.receiveShadow = child.receiveShadow;
      this.batches.push({ mesh, local: new Matrix4().multiplyMatrices(inverse, child.matrixWorld) }); this.add(mesh);
    });
    this.update();
  }
  /** Call only for dirty placements; no work in the render loop for static props. */
  update(indices?: readonly number[]): void {
    for (const batch of this.batches) {
      if (indices) {
        for (const i of indices) this.write(batch, i);
      } else for (let i = 0; i < this.references.length; i++) this.write(batch, i);
      batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.computeBoundingSphere();
    }
  }
  private write(batch: { mesh: InstancedMesh; local: Matrix4 }, i: number): void {
    this.references[i].updateWorldMatrix(true, false);
    this.scratch.multiplyMatrices(this.references[i].matrixWorld, batch.local); batch.mesh.setMatrixAt(i, this.scratch);
  }
  dispose(): void { for (const batch of this.batches) batch.mesh.dispose(); this.clear(); this.batches.length = 0; }
}
