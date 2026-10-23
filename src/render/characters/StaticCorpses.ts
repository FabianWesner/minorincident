import { frozenToneNames, writeFrozenCrowdTones, writeCrowdAppearance, renderedCrowdLook, resolveCrowdAppearance } from './CrowdAppearance';
import { BufferAttribute, BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute, InstancedMesh, Matrix4, Sphere, Uint16BufferAttribute, Uint32BufferAttribute, MeshLambertNodeMaterial } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CrowdClip } from '../../assets/crowd';
import type { EntitySnapshot } from '../../sim/world/types';
import { CrowdFigureProbe } from './CrowdFigureProbe';
import { PaletteMaterial } from '../PaletteMaterial';
import { staticInstanceAttributes } from '../StaticInstanceAttributes';
import { SpatialHash } from '../../sim/spatial/SpatialHash';
import { corpseLod } from '../lodPolicy';

const CELL = 40;
// Civilian model/LOD pools already share their source material. Keep one frozen
// graph too: copies per pool rebuilt identical shaders as new blast victims
// settled. Pages still own their geometry and per-instance appearance buffers.
const sharedFrozenMaterials = new WeakMap<PaletteMaterial, { material: PaletteMaterial; users: number }>();
type AppearanceAttribute = InstancedBufferAttribute | InterleavedBufferAttribute;
interface Chunk { mesh: InstancedMesh; tint: AppearanceAttribute; overlay: AppearanceAttribute; tones: AppearanceAttribute[]; probe: CrowdFigureProbe; keys: string[] }
interface CorpseSurface { source: BufferGeometry; material: MeshLambertNodeMaterial; clip: CrowdClip; frame: number }
interface DetailBody {
  e: EntitySnapshot; key: string; far: CorpseSurface; near: CorpseSurface; x: number; z: number; detailed: boolean;
  tint: Color; overlay: number[]; hiddenParts: readonly string[]; look?: ReturnType<typeof resolveCrowdAppearance>;
}
/** Frozen, baked death geometry in growing 128-body pages within 40 m cells. No per-frame pose
 * texture uploads, AI, physics or population cap for settled bodies. */
export class StaticCorpses extends Group {
  /** Frozen membership invalidates caller actor lists after placement, unload or restore. */
  revision = 0;
  private readonly bodies = new Map<string, EntitySnapshot>();
  private readonly slots = new Map<string, { page: Chunk; index: number }>();
  private readonly moved = new Matrix4();
  private readonly placedSphere = new Sphere();
  private readonly chunks = new Map<string, Chunk[]>();
  private readonly frozen = new Map<string, { geometry: BufferGeometry; material: MeshLambertNodeMaterial }>();
  private readonly frozenMaterials = new Map<MeshLambertNodeMaterial, MeshLambertNodeMaterial>();
  private readonly detailBodies = new Map<number, DetailBody>();
  private readonly detailSpatial = new SpatialHash();
  private readonly detailed = new Set<number>();
  private readonly detailNeighbors: number[] = [];
  private readonly detailQuery = { x: Infinity, z: Infinity, r: 8 };
  private detailDirty = false;
  has(id: number): boolean { return this.bodies.has(String(id)); }
  /** Scene Lab probe: where each frozen body is drawn (matrix translation = the figure's feet). */
  drawn(): { id: number; x: number; y: number; z: number }[] {
    const out: { id: number; x: number; y: number; z: number }[] = [], m = new Matrix4();
    for (const [key, body] of this.bodies) { const slot = this.slots.get(key); if (!slot) continue; slot.page.mesh.getMatrixAt(slot.index, m); out.push({ id: body.id, x: m.elements[12], y: m.elements[13], z: m.elements[14] }); }
    return out;
  }
  begin(get: (id: number) => EntitySnapshot | undefined): void {
    // Checkpoint restore replaces the records (revives a body or re-uses its ID at a new pose): rebuild. A body that is
    // hidden or deleted (level unload or restart) leaves its page alone: swap-remove, no frozen-geometry rebuild (frame hitch).
    let gone: string[] | null = null;
    let movedPages: Set<InstancedMesh> | null = null;
    for (const [key, body] of this.bodies) {
      const current = get(body.id);
      if (current && current !== body) { this.reset(); gone = null; movedPages = null; break; }
      if (!current || current.hidden) { (gone ??= []).push(key); continue; }
      // Only thrown bodies change their instance matrix. Handle them during the
      // lifecycle pass instead of walking every permanent body a second time.
      if (body.corpseThrown) {
        const slot = this.slots.get(key)!;
        slot.page.mesh.getMatrixAt(slot.index, this.moved);
        if (this.moved.elements[12] !== Math.fround(body.transform.x) || this.moved.elements[13] !== Math.fround(body.transform.y - .7) || this.moved.elements[14] !== Math.fround(body.transform.z)) {
          this.moved.setPosition(body.transform.x, body.transform.y - .7, body.transform.z);
          slot.page.mesh.setMatrixAt(slot.index, this.moved); slot.page.mesh.instanceMatrix.needsUpdate = true;
          const detail = this.detailBodies.get(body.id);
          if (detail) { detail.x = body.transform.x; detail.z = body.transform.z; this.detailSpatial.set(body.id, detail.x, detail.z); this.detailDirty = true; }
          (movedPages ??= new Set()).add(slot.page.mesh);
        }
      }
    }
    if (movedPages) for (const page of movedPages) page.computeBoundingSphere();
    if (gone) for (const key of gone) this.drop(key);
    for (const pages of this.chunks.values()) for (const page of pages) for (const figure of page.probe.figures) figure.drawn = false;
  }
  place(e: EntitySnapshot, key: string, source: BufferGeometry, material: MeshLambertNodeMaterial, clip: CrowdClip, frame: number, instance: Matrix4, tint: Color, overlay: number[], instanceKey = String(e.id), hiddenParts: readonly string[] = [], look?: ReturnType<typeof resolveCrowdAppearance>, near?: CorpseSurface): void {
    if (this.bodies.has(instanceKey)) return;
    this.bodies.set(instanceKey, e); this.revision++;
    if (near) {
      const x = instance.elements[12], z = instance.elements[14];
      this.detailBodies.set(e.id, { e, key, far: { source, material, clip, frame }, near, x, z, detailed: false, tint: tint.clone(), overlay: overlay.slice(), hiddenParts, look });
      this.detailSpatial.set(e.id, x, z); this.detailDirty = true;
    }
    this.insert(e, key, source, material, clip, frame, instance, tint, overlay, instanceKey, hiddenParts, look);
  }
  private insert(e: EntitySnapshot, key: string, source: BufferGeometry, material: MeshLambertNodeMaterial, clip: CrowdClip, frame: number, instance: Matrix4, tint: Color, overlay: number[], instanceKey: string, hiddenParts: readonly string[], look?: ReturnType<typeof resolveCrowdAppearance>): void {
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
    if (page.tones.length) { writeFrozenCrowdTones(page.tones, index, e.id); for (const tone of page.tones) tone.needsUpdate = true; }
    page.mesh.instanceMatrix.needsUpdate = page.tint.needsUpdate = page.overlay.needsUpdate = true;
    // Frozen pages need no per-frame bounds work. Cover every joining body's
    // final death vertices so culling cannot drop a visible body.
    // Append the new body's stored (float32) transform to the same sphere union
    // used by computeBoundingSphere. Re-scanning the page for every joining
    // blast victim made a simultaneous settlement quadratic in body count.
    page.mesh.getMatrixAt(index, this.moved);
    this.placedSphere.copy(page.mesh.geometry.boundingSphere!).applyMatrix4(this.moved);
    if (index === 0) (page.mesh.boundingSphere ??= new Sphere()).copy(this.placedSphere);
    else page.mesh.boundingSphere!.union(this.placedSphere);
    page.probe.figures.push({ id: e.id, instanceKey, lod: page.probe.lod, clip: 'death-back', phase: 1, drawn: false, feet: [], ...(look ? { appearance: renderedCrowdLook(e.id, look.model, source, tint, look.accessory) } : {}) });
  }
  /** Drop one body: the page's last instance moves into its slot (matrix, tint, overlay), bounds refit. */
  private drop(instanceKey: string): void {
    const body = this.bodies.get(instanceKey);
    if (body && this.detailBodies.delete(body.id)) { this.detailSpatial.delete(body.id); this.detailed.delete(body.id); }
    this.bodies.delete(instanceKey);
    if (this.removeSlot(instanceKey)) this.revision++;
  }
  /** Swap-remove only the GPU slot. Detail changes preserve frozen membership and the caller's actor list. */
  private removeSlot(instanceKey: string): boolean {
    const slot = this.slots.get(instanceKey); this.slots.delete(instanceKey);
    if (!slot) return false;
    const { page, index } = slot, mesh = page.mesh, last = mesh.count - 1;
    if (index !== last) {
      mesh.getMatrixAt(last, this.moved); mesh.setMatrixAt(index, this.moved);
      for (const attribute of [page.tint, page.overlay, ...page.tones]) for (let c = 0; c < attribute.itemSize; c++) attribute.setComponent(index, c, attribute.getComponent(last, c));
      const moved = page.keys[last]; page.keys[index] = moved; this.slots.get(moved)!.index = index;
    }
    page.keys.length = last; mesh.count = last;
    const figure = page.probe.figures.findIndex(f => f.instanceKey === instanceKey); if (figure >= 0) page.probe.figures.splice(figure, 1);
    mesh.instanceMatrix.needsUpdate = page.tint.needsUpdate = page.overlay.needsUpdate = true;
    for (const tone of page.tones) tone.needsUpdate = true;
    if (last > 0) mesh.computeBoundingSphere();
    return true;
  }
  /** Only nearby cells and the previously detailed bodies need work as the player moves. Sources are frozen during load. */
  updateDetail(focus: { x: number; z: number }): void {
    if (!this.detailBodies.size || !this.detailDirty && this.detailQuery.x === focus.x && this.detailQuery.z === focus.z) return;
    this.detailDirty = false; this.detailQuery.x = focus.x; this.detailQuery.z = focus.z;
    for (const id of this.detailed) {
      const body = this.detailBodies.get(id)!;
      if (corpseLod(Math.hypot(body.x - focus.x, body.z - focus.z), 'lod1') === 'lod2') this.switchDetail(body, false);
    }
    this.detailSpatial.query(this.detailQuery, this.detailNeighbors, false);
    for (const id of this.detailNeighbors) {
      const body = this.detailBodies.get(id)!;
      if (!body.detailed && corpseLod(Math.hypot(body.x - focus.x, body.z - focus.z), 'lod2') === 'lod1') this.switchDetail(body, true);
    }
  }
  private switchDetail(body: DetailBody, near: boolean): void {
    const instanceKey = String(body.e.id), slot = this.slots.get(instanceKey)!;
    // removeSlot uses its own scratch matrix during swap-removal.
    const instance = new Matrix4(); slot.page.mesh.getMatrixAt(slot.index, instance);
    this.removeSlot(instanceKey);
    const surface = near ? body.near : body.far;
    this.insert(body.e, near ? `${body.key}:near` : body.key, surface.source, surface.material, surface.clip, surface.frame, instance, body.tint, body.overlay, instanceKey, body.hiddenParts, body.look);
    body.detailed = near;
    if (near) this.detailed.add(body.e.id); else this.detailed.delete(body.e.id);
  }
  /** Prepare a cast member's frozen death page before shader warm-up. */
  prepare(key: string, source: BufferGeometry, material: MeshLambertNodeMaterial, clip: CrowdClip, frame: number, headwear = false): void {
    if (headwear) this.frozenPose(source, material, clip, frame, [], true);
    if (![...this.chunks.keys()].some(k => k === key || k.startsWith(`${key}/`))) this.createPage(key, source, material, clip, frame, []);
  }
  private frozenPose(source: BufferGeometry, material: MeshLambertNodeMaterial, clip: CrowdClip, frame: number, hiddenParts: readonly string[], hidesHair = false) {
    const frozenKey = `${source.uuid}/${material.uuid}/${frame}/${hiddenParts.join(',')}/${hidesHair}`;
    let frozen = this.frozen.get(frozenKey);
    if (!frozen) {
      const base = source.userData.corpseBody as BufferGeometry | undefined, accessory = source.userData.corpseAccessory as BufferGeometry | undefined;
      let geometry: BufferGeometry;
      if (base && accessory) {
        // The large body has already been posed behind the loading card.
        const pieces = [this.frozenPose(base, material, clip, frame, hiddenParts, hidesHair).geometry, this.frozenPose(accessory, material, clip, frame, hiddenParts, hidesHair).geometry];
        // The body keeps the backend's colour layout; give the small piece the same itemSize so the attributes merge.
        for (const name of ['position', 'normal', 'color', '_parts']) {
          const want = pieces[0].getAttribute(name).itemSize, have = pieces[1].getAttribute(name);
          if (have.itemSize === want) continue;
          const values = new Float32Array(have.count * want);
          for (let i = 0; i < have.count; i++) for (let c = 0; c < want; c++) values[i * want + c] = c < have.itemSize ? have.getComponent(i, c) : 1;
          pieces[1].setAttribute(name, new BufferAttribute(values, want));
        }
        const indexed = pieces.map(piece => { if(piece.index)return piece;const wrapper=new BufferGeometry();for(const name of Object.keys(piece.attributes))wrapper.setAttribute(name,piece.getAttribute(name));wrapper.setIndex(Array.from({length:piece.getAttribute('position').count},(_,i)=>i));return wrapper; });
        geometry = mergeGeometries(indexed)!;
        geometry.boundingSphere = pieces[0].boundingSphere!.clone().union(pieces[1].boundingSphere!);
        indexed.forEach((piece,i)=>{if(piece!==pieces[i])piece.dispose();});
      } else {
        geometry = new BufferGeometry(); const parts = source.getAttribute('_parts');
        const hidden = new Set(hiddenParts.map(name => clip.parts.indexOf(name)));
        const visible = (i: number) => !hidden.has(parts.getX(i)) && !(hidesHair && (parts.getY(i) === -2 || parts.getW(i) >= 4));
        // Colour tags may differ at vertices of one triangle. Keep whole triangles
        // in triangle soup; indexed geometry is filtered through its index below.
        const kept: number[] = [];
        if (source.index) { for (let i = 0; i < parts.count; i++) if (visible(i)) kept.push(i); }
        else for (let i = 0; i + 2 < parts.count; i += 3) if (visible(i) && visible(i + 1) && visible(i + 2)) kept.push(i, i + 1, i + 2);
        const matrices = clip.matrices, frameOffset = Math.floor(frame) * clip.parts.length * 16;
        for (const name of ['position', 'normal', 'color', '_parts']) {
          const original = source.getAttribute(name);
          // GPU backends may pad normals to vec4. Frozen geometry retains the
          // semantic xyz layout warmed before combat, including accessory pages.
          const size = name === 'position' || name === 'normal' ? 3 : original.itemSize;
          const data = new Float32Array(kept.length * size);
          for (let output = 0; output < kept.length; output++) {
            const i = kept[output];
            if (name === 'position' || name === 'normal') {
              const m = frameOffset + parts.getX(i) * 16, x = original.getX(i), y = original.getY(i), z = original.getZ(i);
              let nx = matrices[m] * x + matrices[m + 4] * y + matrices[m + 8] * z;
              let ny = matrices[m + 1] * x + matrices[m + 5] * y + matrices[m + 9] * z;
              let nz = matrices[m + 2] * x + matrices[m + 6] * y + matrices[m + 10] * z;
              let scale: number;
              if (name === 'position') {
                nx += matrices[m + 12]; ny += matrices[m + 13]; nz += matrices[m + 14];
                scale = 1 / (matrices[m + 3] * x + matrices[m + 7] * y + matrices[m + 11] * z + matrices[m + 15]);
              } else scale = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
              data[output * 3] = nx * scale; data[output * 3 + 1] = ny * scale; data[output * 3 + 2] = nz * scale;
            } else for (let c = 0; c < size; c++) data[output * size + c] = original.getComponent(i, c);
          }
          geometry.setAttribute(name, new BufferAttribute(data, size));
        }
        // The shared crowd geometry is indexed: keep triangles whose vertices all survive, renumbered.
        const index = source.getIndex();
        if (index) {
          const renumber = new Int32Array(parts.count).fill(-1), triangles: number[] = [];
          for (let i = 0; i < kept.length; i++) renumber[kept[i]] = i;
          for (let i = 0; i < index.count; i += 3) {
            const a = renumber[index.getX(i)], b = renumber[index.getX(i + 1)], c = renumber[index.getX(i + 2)];
            if (a >= 0 && b >= 0 && c >= 0) triangles.push(a, b, c);
          }
          geometry.setIndex(kept.length > 65535 ? new Uint32BufferAttribute(triangles, 1) : new Uint16BufferAttribute(triangles, 1));
        }
      }
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      // One frozen material per source material: every death frame / gore mask shares its shader (l4-collapse-2: a copy per mask
      // compiled a new pipeline mid-fight for each new dismemberment combination).
      let frozenMaterial = this.frozenMaterials.get(material);
      if (!frozenMaterial) {
        if (material instanceof PaletteMaterial) {
          let shared = sharedFrozenMaterials.get(material);
          if (!shared) {
            const copy = material.frozenCopy(); copy.positionNode = null; copy.normalNode = null;
            shared = { material: copy, users: 0 }; sharedFrozenMaterials.set(material, shared);
          }
          shared.users++; frozenMaterial = shared.material;
        } else {
          // Plain fallback materials retain their per-pool value snapshot.
          frozenMaterial = new MeshLambertNodeMaterial().copy(material);
          frozenMaterial.positionNode = null; frozenMaterial.normalNode = null;
        }
        this.frozenMaterials.set(material, frozenMaterial);
      }
      frozen = { geometry, material: frozenMaterial }; this.frozen.set(frozenKey, frozen);
    }
    return frozen;
  }
  private createPage(key: string, source: BufferGeometry, material: MeshLambertNodeMaterial, clip: CrowdClip, frame: number, hiddenParts: readonly string[], hidesHair = false): Chunk {
    let pages = this.chunks.get(key);
    if (!pages) { pages = []; this.chunks.set(key, pages); }
    const frozen = this.frozenPose(source, material, clip, frame, hiddenParts, hidesHair);
    // Static vertex buffers and shader are shared; only instance attributes differ per spatial page.
    const geometry = new BufferGeometry();
    for (const name of ['position', 'normal', 'color', '_parts']) geometry.setAttribute(name, frozen.geometry.getAttribute(name));
    geometry.setIndex(frozen.geometry.getIndex());
    geometry.boundingSphere = frozen.geometry.boundingSphere!.clone();
    const state = new InstancedBufferAttribute(new Float32Array(128 * 4), 4);
    const colors = new InstancedBufferAttribute(new Float32Array(128 * 4), 4);
    const stains = new InstancedBufferAttribute(new Float32Array(128 * 4), 4); // crowd overlay layout (w: pose row, unused when frozen)
    geometry.setAttribute('_state', state); geometry.setAttribute('_variant', colors); geometry.setAttribute('_overlay', stains);
    if (material.userData.frozenCrowd) {
      // One shared instance buffer stays within WebGPU's eight-buffer limit;
      // four palette attributes still fit WebGL2's sixteen attribute locations.
      const appearance = new InstancedInterleavedBuffer(new Float32Array(128 * 20), 20);
      geometry.setAttribute('_variant', new InterleavedBufferAttribute(appearance, 4, 0));
      geometry.setAttribute('_overlay', new InterleavedBufferAttribute(appearance, 4, 4));
      for (const [i, name] of frozenToneNames.entries()) geometry.setAttribute(name, new InterleavedBufferAttribute(appearance, 3, 8 + i * 3));
    }
    const mesh = new InstancedMesh(geometry, frozen.material, 128); mesh.count = 0; mesh.name = `corpses:${key}`;
    if (frozen.material instanceof PaletteMaterial) {
      // Spatial/death/gore pages share the layout, while their matrices,
      // appearance and bounds remain independent. Avoid a node build per UUID.
      frozen.material.userData.batchFeatures = 'corpses';
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(128 * 3).fill(1), 3);
      if (staticInstanceAttributes(mesh)) geometry.dispose();
    }
    // Placement lives in instance matrices. The page transform is permanently identity;
    // avoid composing it again for every retained spatial/appearance page each frame.
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.preRenderSolo = true;
    const probe = new CrowdFigureProbe(); probe.lod = source.userData.crowdLod ?? 'lod2'; mesh.onAfterRender = () => probe.draw();
    const tones = material.userData.frozenCrowd ? frozenToneNames.map(name => mesh.geometry.getAttribute(name) as AppearanceAttribute) : [];
    const page = { mesh, tint: mesh.geometry.getAttribute('_variant') as AppearanceAttribute, overlay: mesh.geometry.getAttribute('_overlay') as AppearanceAttribute, tones, probe, keys: [] as string[] }; pages.push(page); this.add(mesh);
    return page;
  }
  snapshot() { return { instances: this.bodies.size, draws: [...this.chunks.values()].reduce((n, pages) => n + pages.filter(page => page.mesh.count > 0).length, 0), figures: [...this.chunks.values()].flatMap(pages => pages.flatMap(page => page.probe.figures)) }; }
  reset(): void {
    this.revision++;
    for (const pages of this.chunks.values()) for (const { mesh } of pages) { mesh.geometry.dispose(); mesh.dispose(); }
    for (const frozen of this.frozen.values()) frozen.geometry.dispose();
    for (const [source, material] of this.frozenMaterials) {
      if (!(source instanceof PaletteMaterial)) { material.dispose(); continue; }
      const shared = sharedFrozenMaterials.get(source)!;
      if (--shared.users === 0) { material.dispose(); sharedFrozenMaterials.delete(source); }
    }
    this.frozen.clear(); this.frozenMaterials.clear(); this.chunks.clear(); this.bodies.clear(); this.slots.clear(); this.clear();
    this.detailBodies.clear(); this.detailSpatial.reset(); this.detailed.clear(); this.detailDirty = false;
  }
  dispose(): void { this.reset(); }
}
