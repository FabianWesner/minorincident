import { Mesh, type Object3D, Matrix4, Vector3, type BufferGeometry } from 'three';
import type { CrowdPosePalette } from './CrowdPosePalette';
import { pickBodies } from './PickBodies';

/** Draw-submission and ankle probes, read only by the query-gated test API. */
export class CrowdFigureProbe {
  private readonly enabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
  /** Detail tier of the batch that drew the figure (guards against close figures in the far silhouette tier). */
  lod?: 'lod0' | 'lod1' | 'lod2';
  readonly figures: { id: number; instanceKey?: string; lod?: 'lod0' | 'lod1' | 'lod2'; clip: string; phase: number; drawn: boolean; feet: number[][]; scale?: number[]; soles?: number[][]; joints?: Record<string, number[]>; forward?: number[] }[] = [];
  /** Scene Lab: also record every rig part pivot (world metres) and the figure's forward axis. */
  static joints = false;
  private readonly matrix = new Matrix4();
  private readonly point = new Vector3();
  begin(): void { this.figures.length = 0; }
  draw(): void { for (const figure of this.figures) figure.drawn = true; }
  /** Sole (heel/toe) points need the rest ankle height in foot-local units (CrowdLocomotion.sole). */
  sole = 0;
  private animalSoles: { part: string; heel: Vector3; toe: Vector3 }[] = [];
  /** Probe actual paw/hoof geometry, never the animal rig's dummy humanoid feet. */
  animal(model: Object3D): void {
    model.updateMatrixWorld(true);
    this.animalSoles = ['FL', 'FR', 'BL', 'BR'].flatMap(side => {
      const part = model.getObjectByName(`paw${side}`) ?? model.getObjectByName(`leg${side}`);
      if (!part) return [];
      const vertices: Vector3[] = [];
      part.traverse(node => {
        if (!(node instanceof Mesh)) return;
        const positions = node.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) vertices.push(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld));
      });
      if (!vertices.length) return [];
      const bottom = Math.min(...vertices.map(point => point.y));
      const sole = vertices.filter(point => point.y <= bottom + .002).sort((a, b) => a.x - b.x);
      return [{ part: part.name, heel: part.worldToLocal(sole[0].clone()), toe: part.worldToLocal(sole[sole.length - 1].clone()) }];
    });
  }
  add(id: number, clip: string, phase: number, instance: Matrix4, palette: CrowdPosePalette, frame: number, outgoing: number, weight: number, geometry?: BufferGeometry): void {
    pickBodies.add(id, instance, palette, frame, outgoing, weight, geometry);
    if (!this.enabled) return;
    // Ordinary test/perf snapshots need two feet, not a newly allocated full
    // skeleton per figure per frame. Scene Lab still records every requested joint.
    const pose = CrowdFigureProbe.joints ? palette.pose(frame, outgoing, weight) : undefined;
    const partMatrix = (part: number) => pose ? this.matrix.fromArray(pose, part * 16) : palette.part(frame, outgoing, weight, part, this.matrix);
    const feet = ['footL', 'footR'].map(name => {
      const part = palette.clip.parts.indexOf(name);
      if (part < 0) return [];
      partMatrix(part);
      return this.point.setFromMatrixPosition(this.matrix).applyMatrix4(instance).toArray();
    });
    // Heel and toe contact points per foot (same offsets as the footwork solver), for model-free slide probes.
    const soles = this.animalSoles.length ? this.animalSoles.flatMap(({ part, heel, toe }) => {
      const index = palette.clip.parts.indexOf(part);
      if (index < 0) return [];
      this.matrix.fromArray(pose, index * 16).premultiply(instance);
      return [heel, toe].map(point => this.point.copy(point).applyMatrix4(this.matrix).toArray());
    }) : this.sole ? ['footL', 'footR'].flatMap(name => {
      const part = palette.clip.parts.indexOf(name);
      if (part < 0) return [];
      partMatrix(part).premultiply(instance);
      return [-.05, .085].map(x => this.point.set(x, -this.sole, 0).applyMatrix4(this.matrix).toArray());
    }) : undefined;
    let joints: Record<string, number[]> | undefined, forward: number[] | undefined;
    if (pose) {
      joints = {};
      for (const [part, name] of palette.clip.parts.entries()) joints[name] = this.point.setFromMatrixPosition(this.matrix.fromArray(pose, part * 16)).applyMatrix4(instance).toArray();
      forward = this.point.set(1, 0, 0).transformDirection(instance).toArray();
    }
    const scale = this.point.setFromMatrixScale(instance).toArray();
    this.figures.push({ id, lod: this.lod, clip, phase, drawn: false, feet, scale, soles, joints, forward });
  }
}
