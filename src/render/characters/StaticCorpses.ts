import { BufferAttribute, BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshLambertNodeMaterial, Vector3 } from 'three/webgpu';
import type { CrowdClip } from '../../assets/crowd';
import type { EntitySnapshot } from '../../sim/world/types';
import { CrowdFigureProbe } from './CrowdFigureProbe';

interface Chunk { mesh: InstancedMesh; tint: InstancedBufferAttribute; overlay: InstancedBufferAttribute; probe: CrowdFigureProbe }
/** Frozen, baked death geometry in growing 128-body pages. No per-frame pose
 * texture uploads, AI, physics or population cap for settled bodies. */
export class StaticCorpses extends Group {
  private readonly bodies = new Map<string, EntitySnapshot>();
  private readonly chunks = new Map<string, Chunk[]>();
  private readonly partMatrix = new Matrix4();
  private readonly point = new Vector3();
  has(id: number): boolean { return this.bodies.has(String(id)); }
  begin(get: (id: number) => EntitySnapshot | undefined): void {
    // Checkpoint restore may remove/revive a body or re-use its ID at a new pose.
    if ([...this.bodies.values()].some(body => get(body.id) !== body)) this.reset();
    for (const pages of this.chunks.values()) for (const page of pages) for (const figure of page.probe.figures) figure.drawn = false;
  }
  place(e: EntitySnapshot, key: string, source: BufferGeometry, material: MeshLambertNodeMaterial, clip: CrowdClip, frame: number, instance: Matrix4, tint: Color, overlay: number[], instanceKey = String(e.id), hiddenParts: readonly string[] = []): void {
    if (this.bodies.has(instanceKey)) return;
    this.bodies.set(instanceKey, e);
    let pages = this.chunks.get(key);
    if (!pages) { pages = []; this.chunks.set(key, pages); }
    let page = pages.at(-1);
    if (!page || page.mesh.count >= 128) {
      const geometry = new BufferGeometry(), parts = source.getAttribute('_parts');
      const hidden = new Set(hiddenParts.map(name => clip.parts.indexOf(name)));
      const kept = Array.from({ length: parts.count }, (_, i) => i).filter(i => !hidden.has(parts.getX(i)));
      for (const name of ['position', 'normal', 'color', '_parts']) {
        const original = source.getAttribute(name), data = new Float32Array(kept.length * original.itemSize);
        for (const [output, i] of kept.entries()) {
          if (name === 'position' || name === 'normal') {
            this.partMatrix.fromArray(clip.matrices, (Math.floor(frame) * clip.parts.length + parts.getX(i)) * 16);
            this.point.fromBufferAttribute(original, i);
            if (name === 'position') this.point.applyMatrix4(this.partMatrix); else this.point.transformDirection(this.partMatrix);
            this.point.toArray(data, output * 3);
          } else for (let c = 0; c < original.itemSize; c++) data[output * original.itemSize + c] = original.getComponent(i, c);
        }
        geometry.setAttribute(name, new BufferAttribute(data, original.itemSize));
      }
      const state = new InstancedBufferAttribute(new Float32Array(128 * 4), 4);
      const colors = new InstancedBufferAttribute(new Float32Array(128 * 4), 4);
      const stains = new InstancedBufferAttribute(new Float32Array(128 * 3), 3);
      geometry.setAttribute('_state', state); geometry.setAttribute('_variant', colors); geometry.setAttribute('_overlay', stains);
      const frozen = new MeshLambertNodeMaterial().copy(material); frozen.positionNode = null; frozen.normalNode = null;
      const mesh = new InstancedMesh(geometry, frozen, 128); mesh.count = 0;
      mesh.castShadow = false; mesh.receiveShadow = true;
      const probe = new CrowdFigureProbe(); mesh.onAfterRender = () => probe.draw();
      page = { mesh, tint: colors, overlay: stains, probe }; pages.push(page); this.add(mesh);
    }
    const index = page.mesh.count++;
    page.mesh.setMatrixAt(index, instance); page.tint.setXYZW(index, tint.r, tint.g, tint.b, 1);
    page.overlay.setXYZ(index, overlay[0], overlay[1], overlay[2]);
    page.mesh.instanceMatrix.needsUpdate = page.tint.needsUpdate = page.overlay.needsUpdate = true;
    // Frozen pages need no per-frame bounds work. Recompute when a body joins,
    // covering every final death vertex so culling cannot drop a visible body.
    page.mesh.computeBoundingSphere();
    page.probe.figures.push({ id: e.id, instanceKey, clip: 'death-back', phase: 1, drawn: false, feet: [] });
  }
  snapshot() { return { instances: this.bodies.size, draws: [...this.chunks.values()].reduce((n, pages) => n + pages.length, 0), figures: [...this.chunks.values()].flatMap(pages => pages.flatMap(page => page.probe.figures)) }; }
  private reset(): void {
    for (const pages of this.chunks.values()) for (const { mesh } of pages) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); }
    this.chunks.clear(); this.bodies.clear(); this.clear();
  }
  dispose(): void { this.reset(); }
}
