// Adapted from folio-2025 InstancedGroup.js by Bruno Simon (MIT), commit 41046b5.
import { Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, Vector3 } from 'three/webgpu';
import { staticInstanceAttributes } from './StaticInstanceAttributes';

/** One batch per prototype mesh; nested child transforms are preserved. Geometry/material ownership stays with the caller. */
export class InstancedGroup extends Group {
  private readonly batches: { mesh: InstancedMesh; local: Matrix4; base?: Matrix4; door?: string }[] = [];
  private readonly scratch = new Matrix4();
  private readonly color = new Color();
  constructor(prototype: Object3D, readonly references: Object3D[], readonly capacity = references.length) {
    super(); prototype.updateWorldMatrix(true, true);
    this.userData.placeholder = prototype.userData.placeholder === true;
    const inverse = prototype.matrixWorld.clone().invert();
    prototype.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      for (let parent: Object3D | null = child; parent; parent = parent.parent) if (!parent.visible) return;
      const powered = child.geometry.hasAttribute('_lightBase');
      const geometry = powered ? child.geometry.clone() : child.geometry;
      if (powered) { const bases = new Float32Array(capacity); references.forEach((reference, index) => { bases[index] = reference.userData.lightBase ?? 0; }); geometry.setAttribute('_lightBase', new InstancedBufferAttribute(bases, 1)); }
      const mesh = new InstancedMesh(geometry, child.material, capacity);
      // Warm-up and LOD repartition both rewrite these transforms. Three's
      // generated interleaved matrix buffer must upload after either change.
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.userData.ownedPowerGeometry = powered;
      mesh.count = references.length;
      // White is the identity tint. One vertex-input layout warms the same
      // pipeline for untinted and charred/tinted placements and every LOD.
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
      if (staticInstanceAttributes(mesh) && powered) geometry.dispose();
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
  /** Hide only this placement's roof; reference state survives streaming and LOD repartition. */
  roofVisible(visible: boolean, reference: Object3D): void {
    reference.userData.roofHidden = !visible;
    const index = this.references.indexOf(reference);
    if (index < 0) return;
    for (const batch of this.batches) if (/^roof(?:$|-|_)/.test(batch.mesh.name)) {
      this.write(batch, index); batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.computeBoundingSphere();
    }
  }
  private write(batch: { mesh: InstancedMesh; local: Matrix4; base?: Matrix4; door?: string }, i: number): void {
    const lightBase = batch.mesh.geometry.getAttribute('_lightBase');
    if (batch.mesh.userData.ownedPowerGeometry) { lightBase.setX(i, this.references[i].userData.lightBase ?? 0); lightBase.needsUpdate = true; }
    this.references[i].updateWorldMatrix(true, false);
    const yaw = batch.door ? (this.references[i].userData.doorYaw as Record<string, number> | undefined)?.[batch.door] ?? 0 : 0;
    const height = batch.door ? (this.references[i].userData.doorHeight as Record<string, number> | undefined)?.[batch.door] ?? 0 : 0;
    const local = batch.base && (yaw || height) ? this.leaf.copy(batch.base).multiply(this.scratch.makeRotationAxis(batch.door && this.references[i].userData.doorAxis?.[batch.door] === 'x' ? this.axisX : batch.door && this.references[i].userData.doorAxis?.[batch.door] === 'z' ? this.axisZ : this.axisY, yaw)) : batch.local;
    if (height) local.elements[13] += height;
    this.scratch.multiplyMatrices(this.references[i].matrixWorld, local);
    if (this.references[i].userData.roofHidden && /^roof(?:$|-|_)/.test(batch.mesh.name)) this.scratch.scale(this.hiddenRoofScale);
    batch.mesh.setMatrixAt(i, this.scratch);
    const tint = this.references[i].userData.tint; batch.mesh.setColorAt(i, this.color.set(typeof tint === 'string' ? tint : '#ffffff'));
  }
  dispose(): void { for (const batch of this.batches) { if (batch.mesh.userData.ownedPowerGeometry || batch.mesh.userData.staticInstanceAttributes) batch.mesh.geometry.dispose(); batch.mesh.dispose(); } this.clear(); this.batches.length = 0; }
}
