import { writeCrowdAppearance, renderedCrowdLook, resolveCrowdAppearance } from './CrowdAppearance';
import { BufferAttribute, BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Uint16BufferAttribute, Uint32BufferAttribute, MeshLambertNodeMaterial, Vector3 } from 'three/webgpu';
import type { CrowdClip } from '../../assets/crowd';
import type { EntitySnapshot } from '../../sim/world/types';
import { CrowdFigureProbe } from './CrowdFigureProbe';
import { PaletteMaterial } from '../PaletteMaterial';
import { staticInstanceAttributes } from '../StaticInstanceAttributes';

const CELL = 40;
interface Chunk { mesh: InstancedMesh; tint: InstancedBufferAttribute; overlay: InstancedBufferAttribute; probe: CrowdFigureProbe; keys: string[] }
/** Frozen, baked death geometry in growing 128-body pages within 40 m cells. No per-frame pose
 * texture uploads, AI, physics or population cap for settled bodies. */
export class StaticCorpses extends Group {
  private readonly bodies = new Map<string, EntitySnapshot>();
  private readonly slots = new Map<string, { page: Chunk; index: number }>();
  private readonly moved = new Matrix4();
  private readonly chunks = new Map<string, Chunk[]>();
  private readonly frozen = new Map<string, { geometry: BufferGeometry; material: MeshLambertNodeMaterial }>();
  private readonly frozenMaterials = new Map<string, MeshLambertNodeMaterial>();
  private readonly partMatrix = new Matrix4();
  private readonly point = new Vector3();
  has(id: number): boolean { return this.bodies.has(String(id)); }
  /** Scene Lab probe: where each frozen body is drawn (matrix translation = the figure's feet). */
  drawn(): { id: number; x: number; y: number; z: number }[] {
    const out: { id: number; x: number; y: number; z: number }[] = [], m = new Matrix4();
    for (const [key, body] of this.bodies) { const slot = this.slots.get(key); if (!slot) continue; slot.page.mesh.getMatrixAt(slot.index, m); out.push({ id: body.id, x: m.elements[12], y: m.elements[13], z: m.elements[14] }); }
    return out;
  }
  begin(get: (id: number) => EntitySnapshot | undefined): void {
    // Checkpoint restore replaces the records (revives a body or re-uses its ID at a new pose): rebuild. A body that is
    // hidden or deleted (L4 keeps a corpse budget) leaves its page alone: swap-remove, no frozen-geometry rebuild (frame hitch).
    let gone: string[] | null = null;
    for (const [key, body] of this.bodies) {
      const current = get(body.id);
      if (current && current !== body) { this.reset(); gone = null; break; }
      if (!current || current.hidden) (gone ??= []).push(key);
    }
    if (gone) for (const key of gone) this.drop(key);
    for (const [id, body] of this.bodies) if (body.corpseThrown) {
      const slot = this.slots.get(id)!;
      slot.page.mesh.getMatrixAt(slot.index, this.moved);
      if (this.moved.elements[12] !== body.transform.x || this.moved.elements[13] !== body.transform.y - .7 || this.moved.elements[14] !== body.transform.z) {
        this.moved.setPosition(body.transform.x, body.transform.y - .7, body.transform.z);
        slot.page.mesh.setMatrixAt(slot.index, this.moved); slot.page.mesh.instanceMatrix.needsUpdate = true; slot.page.mesh.computeBoundingSphere();
      }
    }
    for (const pages of this.chunks.values()) for (const page of pages) for (const figure of page.probe.figures) figure.drawn = false;
  }
  place(e: EntitySnapshot, key: string, source: BufferGeometry, material: MeshLambertNodeMaterial, clip: CrowdClip, frame: number, instance: Matrix4, tint: Color, overlay: number[], instanceKey = String(e.id), hiddenParts: readonly string[] = [], look?: ReturnType<typeof resolveCrowdAppearance>): void {
    if (this.bodies.has(instanceKey)) return;
    this.bodies.set(instanceKey, e);
    // Keep distant bodies in separate bounds so ordinary frustum culling skips their geometry. 40 m cells (l4-collapse-2; was 16 m): every
    // page is its own InstancedMesh and three builds a node program per InstancedMesh (its uuid is in the cache key), so each new page
    // compiled mid-fight (~60 builds in the L4 war, the line-break hitches).
    const appearanceKey = look?.accessory ? `${key}:${look.accessory}` : key;
    const cellKey = `${appearanceKey}/${Math.floor(instance.elements[12] / CELL)}/${Math.floor(instance.elements[14] / CELL)}`;
    const prepared = this.chunks.get(appearanceKey);
    if (!this.chunks.has(cellKey) && prepared?.every(page => page.mesh.count === 0)) {
      this.chunks.delete(appearanceKey); this.chunks.set(cellKey, prepared);
    }
    let page = this.chunks.get(cellKey)?.at(-1);
    if (!page || page.mesh.count >= 128) {
      page = this.createPage(cellKey, source, material, clip, frame, hiddenParts, look?.hidesHair);
    }
    const index = page.mesh.count++;
    this.slots.set(instanceKey, { page, index }); page.keys[index] = instanceKey;
    page.mesh.setMatrixAt(index, instance); writeCrowdAppearance(page.tint, index, e.id, tint, 1, look?.slot, look?.hidesHair);
    page.overlay.setXYZ(index, overlay[0], overlay[1], overlay[2]);
    page.mesh.instanceMatrix.needsUpdate = page.tint.needsUpdate = page.overlay.needsUpdate = true;
    // Frozen pages need no per-frame bounds work. Recompute when a body joins,
    // covering every final death vertex so culling cannot drop a visible body.
    page.mesh.computeBoundingSphere();
    page.probe.figures.push({ id: e.id, instanceKey, clip: 'death-back', phase: 1, drawn: false, feet: [], ...(look ? { appearance: renderedCrowdLook(e.id, look.model, source, tint, look.accessory) } : {}) });
  }
  /** Drop one body: the page's last instance moves into its slot (matrix, tint, overlay), bounds refit. */
  private drop(instanceKey: string): void {
    const slot = this.slots.get(instanceKey); this.bodies.delete(instanceKey); this.slots.delete(instanceKey);
    if (!slot) return;
    const { page, index } = slot, mesh = page.mesh, last = mesh.count - 1;
    if (index !== last) {
      mesh.getMatrixAt(last, this.moved); mesh.setMatrixAt(index, this.moved);
      for (const attribute of [page.tint, page.overlay]) for (let c = 0; c < attribute.itemSize; c++) attribute.array[index * attribute.itemSize + c] = attribute.array[last * attribute.itemSize + c];
      const moved = page.keys[last]; page.keys[index] = moved; this.slots.get(moved)!.index = index;
    }
    page.keys.length = last; mesh.count = last;
    const figure = page.probe.figures.findIndex(f => f.instanceKey === instanceKey); if (figure >= 0) page.probe.figures.splice(figure, 1);
    mesh.instanceMatrix.needsUpdate = page.tint.needsUpdate = page.overlay.needsUpdate = true;
    if (last > 0) mesh.computeBoundingSphere();
  }
  /** L6 prepares the fixed cast's frozen death pages before shader warm-up. */
  prepare(key: string, source: BufferGeometry, material: MeshLambertNodeMaterial, clip: CrowdClip, frame: number): void {
    if (![...this.chunks.keys()].some(k => k === key || k.startsWith(`${key}/`))) this.createPage(key, source, material, clip, frame, []);
  }
  private createPage(key: string, source: BufferGeometry, material: MeshLambertNodeMaterial, clip: CrowdClip, frame: number, hiddenParts: readonly string[], hidesHair = false): Chunk {
    let pages = this.chunks.get(key);
    if (!pages) { pages = []; this.chunks.set(key, pages); }
    const frozenKey = `${source.uuid}/${material.uuid}/${frame}/${hiddenParts.join(',')}/${hidesHair}`;
    let frozen = this.frozen.get(frozenKey);
    if (!frozen) {
      const geometry = new BufferGeometry(), parts = source.getAttribute('_parts');
      const hidden = new Set(hiddenParts.map(name => clip.parts.indexOf(name)));
      const visible = (i: number) => !hidden.has(parts.getX(i)) && !(hidesHair && (parts.getY(i) === -2 || parts.getW(i) >= 4));
      // Colour tags may differ at vertices of one triangle. Keep whole triangles
      // in triangle soup; indexed geometry is filtered through its index below.
      const kept = source.index ? Array.from({ length: parts.count }, (_, i) => i).filter(visible)
        : Array.from({ length: Math.floor(parts.count / 3) }, (_, triangle) => triangle * 3).flatMap(i => [i, i + 1, i + 2].every(visible) ? [i, i + 1, i + 2] : []);
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
      // The shared crowd geometry is indexed: keep triangles whose vertices all survive, renumbered.
      const index = source.getIndex();
      if (index) {
        const renumber = new Map(kept.map((old, i) => [old, i])), triangles: number[] = [];
        for (let i = 0; i < index.count; i += 3) {
          const a = renumber.get(index.getX(i)), b = renumber.get(index.getX(i + 1)), c = renumber.get(index.getX(i + 2));
          if (a !== undefined && b !== undefined && c !== undefined) triangles.push(a, b, c);
        }
        geometry.setIndex(kept.length > 65535 ? new Uint32BufferAttribute(triangles, 1) : new Uint16BufferAttribute(triangles, 1));
      }
      // One frozen material per source material: every death frame / gore mask shares its shader (l4-collapse-2: a copy per mask
      // compiled a new pipeline mid-fight for each new dismemberment combination).
      let frozenMaterial = this.frozenMaterials.get(material.uuid);
      if (!frozenMaterial) {
        frozenMaterial = material instanceof PaletteMaterial ? material.frozenCopy() : new MeshLambertNodeMaterial().copy(material);
        frozenMaterial.positionNode = null; frozenMaterial.normalNode = null; this.frozenMaterials.set(material.uuid, frozenMaterial);
      }
      frozen = { geometry, material: frozenMaterial }; this.frozen.set(frozenKey, frozen);
    }
    // Static vertex buffers and shader are shared; only instance attributes differ per spatial page.
    const geometry = new BufferGeometry();
    for (const name of ['position', 'normal', 'color', '_parts']) geometry.setAttribute(name, frozen.geometry.getAttribute(name));
    geometry.setIndex(frozen.geometry.getIndex());
    const state = new InstancedBufferAttribute(new Float32Array(128 * 4), 4);
    const colors = new InstancedBufferAttribute(new Float32Array(128 * 4), 4);
    const stains = new InstancedBufferAttribute(new Float32Array(128 * 4), 4); // crowd overlay layout (w: pose row, unused when frozen)
    geometry.setAttribute('_state', state); geometry.setAttribute('_variant', colors); geometry.setAttribute('_overlay', stains);
    const mesh = new InstancedMesh(geometry, frozen.material, 128); mesh.count = 0;
    if (frozen.material instanceof PaletteMaterial) {
      // Spatial/death/gore pages share the layout, while their matrices,
      // appearance and bounds remain independent. Avoid a node build per UUID.
      frozen.material.userData.batchFeatures = 'corpses';
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(128 * 3).fill(1), 3);
      if (staticInstanceAttributes(mesh)) geometry.dispose();
    }
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.preRenderSolo = true;
    const probe = new CrowdFigureProbe(); mesh.onAfterRender = () => probe.draw();
    const page = { mesh, tint: mesh.geometry.getAttribute('_variant') as InstancedBufferAttribute, overlay: mesh.geometry.getAttribute('_overlay') as InstancedBufferAttribute, probe, keys: [] as string[] }; pages.push(page); this.add(mesh);
    return page;
  }
  snapshot() { return { instances: this.bodies.size, draws: [...this.chunks.values()].reduce((n, pages) => n + pages.filter(page => page.mesh.count > 0).length, 0), figures: [...this.chunks.values()].flatMap(pages => pages.flatMap(page => page.probe.figures)) }; }
  reset(): void {
    for (const pages of this.chunks.values()) for (const { mesh } of pages) { mesh.geometry.dispose(); mesh.dispose(); }
    for (const frozen of this.frozen.values()) frozen.geometry.dispose();
    for (const material of this.frozenMaterials.values()) material.dispose();
    this.frozen.clear(); this.frozenMaterials.clear(); this.chunks.clear(); this.bodies.clear(); this.slots.clear(); this.clear();
  }
  dispose(): void { this.reset(); }
}
