import { skinnedBrow } from './headMeasurements';
import { crowdSurfaceBindings } from './crowdTexture';
export { skinnedBrow } from './headMeasurements';
import { Box3, Vector3, BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, StreamDrawUsage } from 'three/webgpu';
import { attribute, instanceColor } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crowdShirt, crowdVertexLayout, resolveCrowdAppearance, crowdAccessoryIds } from './CrowdAppearance';
import { batchRigidParts } from './batchRigidParts';
import { AssetRegistry } from '../../assets/registry';
import manifest from '../../assets/manifest.json' with { type: 'json' };
import { hairTones, crowdAppearance } from '../../data/crowdAppearance';
import type { EntitySnapshot } from '../../sim/world/types';
import type { CrowdPosePalette } from './CrowdPosePalette';
import { characterNodes } from '../../data/survivor';
import type { Materials } from '../Materials';
type Fit = { scale: number[]; offset: number[]; hasHeadwear?: boolean };
type Accessory = { slot: string; tint?: string; fits?: Record<string, Fit> };
const definitions = new Map((manifest as unknown as { id: string; accessory?: Accessory }[]).map(a => [a.id, a.accessory]));
const hairColors = hairTones.map(c => new Color(c));
/** Base whose authored fits are retargeted to unauthored (ordinary infected) heads. */
const referenceBase = 'npc.civilian-man-a';
/** Its baked LOD1 skin skull in head-local metres (bakeInfected path; pinned by tests/unit/render/crowd-accessory-fit.test.ts). */
export const referenceSkull = { size: new Vector3(.301, .334, .381), centre: new Vector3(.009, .118, 0) };
/** Skin height/width in head-local space. Painted faces cover only the front;
 * retain the full head depth so a hat stays centred over the skull, not the nose. */
export function bakedSkull(geometry: BufferGeometry): { size: Vector3; centre: Vector3 } | null {
  const parts = geometry.getAttribute('_parts'), position = geometry.getAttribute('position'), bounds = new Box3(), depth = new Box3(), point = new Vector3();
  const binds = geometry.userData.crowdBinds as number[] | undefined, inverse = binds ? new Matrix4().fromArray(binds, characterNodes.indexOf('head') * 16) : undefined;
  for (let i = 0; i < parts.count; i++) if (parts.getX(i) === characterNodes.indexOf('head') && parts.getY(i) !== -6 && parts.getW(i) < 1024 && !parts.getZ(i)) {
    point.fromBufferAttribute(position, i); if (inverse) point.applyMatrix4(inverse);
    if (parts.getY(i) === -1) bounds.expandByPoint(point);
    if (inverse) depth.expandByPoint(point);
  }
  if (!bounds.isEmpty() && !depth.isEmpty()) { bounds.min.x = depth.min.x; bounds.max.x = depth.max.x; }
  return bounds.isEmpty() ? null : { size: bounds.getSize(new Vector3()), centre: bounds.getCenter(new Vector3()) };
}
/** Head-local height of a spectacle frame: near-black neutral, untagged head vertices in front of the skull centre
 * that reach the temples (eyes, brows and mouths stay inside the face). null without glasses. */
export function glassesTop(geometry: BufferGeometry): number | null {
  if (geometry.userData.crowdBinds) {
    const position = geometry.getAttribute('position'), parts = geometry.getAttribute('_parts');
    const inverse = new Matrix4().fromArray(geometry.userData.crowdBinds, characterNodes.indexOf('head') * 16), point = new Vector3();
    let top = -Infinity;
    for (let i = 0; i < position.count; i++) if (parts.getY(i) === -6) top = Math.max(top, point.fromBufferAttribute(position, i).applyMatrix4(inverse).y);
    return Number.isFinite(top) ? top : null;
  }
  const skull = bakedSkull(geometry); if (!skull) return null;
  const parts = geometry.getAttribute('_parts'), position = geometry.getAttribute('position'), color = geometry.getAttribute('color');
  if (!color) return null;
  const head = characterNodes.indexOf('head'), temple = skull.size.z / 2 * .75;
  let top = -Infinity, temples = false;
  for (let i = 0; i < parts.count; i++) {
    if (parts.getX(i) !== head || parts.getY(i) !== 0 || parts.getW(i) % 128 >= 4 || position.getX(i) <= skull.centre.x) continue;
    const r = color.getX(i), g = color.getY(i), b = color.getZ(i), max = Math.max(r, g, b);
    if (max >= .05 || max - Math.min(r, g, b) >= .02) continue;
    top = Math.max(top, position.getY(i)); if (Math.abs(position.getZ(i) - skull.centre.z) > temple) temples = true;
  }
  return temples ? top : null;
}
/** Authored head-local frame tops of the spectacled civilian bases (measured from the shipped LOD0 bakes; pinned
 * against the GLBs by tests/unit/render/crowd-hat-glasses.test.ts). Runtime bakes recolour the frames, so this is data. */
export const spectacleTops: Readonly<Record<string, number>> = { 'npc.civilian-woman-b': .2204, 'npc.civilian-elderly': .2088 };
/** Gap between the frame top and the hat's lowest point (metres, head-local). */
export const glassesClearance = .012;
function authoredFit(fit: Fit, out: Matrix4): Matrix4 {
  return out.makeScale(...fit.scale as [number, number, number]).setPosition(...fit.offset as [number, number, number]);
}
export type AccessoryLod = 'lod0' | 'lod1' | 'lod2';
/** Head-local assets, shared across both human crowds: at most one draw per accessory/LOD, never per figure/model.
 * LOD2 reuses the <=80 triangle LOD1 head piece so pose and quality changes preserve headwear. */
export class CrowdAccessories extends Group {
  readonly ids: string[];
  private readonly registry = new AssetRegistry(() => {});
  private readonly batches = new Map<string, InstancedMesh>();
  private readonly headTransform = new Matrix4();
  private disposed = false;
  private loading: Promise<void> | null = null;
  private readonly infectedBatches = new Set<InstancedMesh>();
  // Identity is stable during a render; slot, hair masking and placement all
  // ask for it. End the cache with the frame so later sim/editor changes show.
  private resolvingFrame = false;
  private readonly frameLooks = new Map<EntitySnapshot, ReturnType<typeof resolveCrowdAppearance>>();
  private look(e: EntitySnapshot): ReturnType<typeof resolveCrowdAppearance> {
    if (!this.resolvingFrame) return resolveCrowdAppearance(e, this.ids);
    let look = this.frameLooks.get(e);
    if (!look) { look = resolveCrowdAppearance(e, this.ids); this.frameLooks.set(e, look); }
    return look;
  }
  private readonly corpseSources = new Map<string, BufferGeometry>();
  private readonly fits = new Map<string, Matrix4>();
  private readonly accessoryFits = new Map<string, Matrix4>();
  private readonly skinnedModels = new Set<string>();
  private readonly brows = new Map<string, ReturnType<typeof skinnedBrow>>();
  private readonly skullLods = new Map<string, number>();
  private readonly measuredGlasses = new Map<string, number>();
  private readonly minimumHatY = new Map<string, number>();
  private readonly fitTransform = new Matrix4();
  constructor(private readonly shading?: Materials) {
    super(); this.name = 'crowd-accessories';
    this.ids = [...crowdAccessoryIds];
    if (!this.ids.length) this.ids.push('acc.placeholder-hat', 'acc.placeholder-hair');
  }
  slot(e: EntitySnapshot): number {
    return this.look(e).slot;
  }
  hidesHair(e: EntitySnapshot, lod: string): boolean {
    const id = this.drawnSlot(e, lod); if (!id) return false;
    const kind = definitions.get(id)?.slot;
    return kind === 'hat' || kind === 'hair' || id.startsWith('acc.placeholder-');
  }
  /** Authored civilian fits win. Ordinary infected retarget the reference base's authored fit from its baked skin
   * skull to theirs (spec audit 10-16: the old fixed shell sat ~10 cm below the measured reference skull and
   * ignored the authored per-accessory proportions, so infected hats grew to 1.5-2x and swallowed face and
   * shoulders, reading as multicoloured patches over the horde). */
  registerSkull(model: string, geometry: BufferGeometry): void {
    const rank = geometry.userData.crowdLod === 'lod1' ? 0 : geometry.userData.crowdLod === 'lod0' ? 1 : 2;
    const skull = bakedSkull(geometry); if (!skull) return;
    const frames = glassesTop(geometry);
    if (geometry.userData.crowdBinds) {
      // One immutable fit serves all LODs. Their skin bounds can differ by a few
      // millimetres; keep even a shallow beanie above every LOD's upper face.
      const brow = skinnedBrow(geometry);
      if (brow) {
        const previous = this.brows.get(model);
        if (previous) { brow.width = Math.min(previous.width, brow.width); brow.depth = Math.min(previous.depth, brow.depth); }
        this.brows.set(model, brow);
        if (!previous || brow.width !== previous.width || brow.depth !== previous.depth) for (const cache of [this.lifts, this.accessoryFits]) for (const key of cache.keys()) if (key.endsWith(`/${model}`)) cache.delete(key);
      }
      const minimum = (brow?.y ?? skull.centre.y + skull.size.y * .15) + .018;
      if (minimum > (this.minimumHatY.get(model) ?? -Infinity)) {
        this.minimumHatY.set(model, minimum);
        for (const cache of [this.lifts, this.accessoryFits]) for (const key of cache.keys()) if (key.endsWith(`/${model}`)) cache.delete(key);
      }
      if (frames !== null && frames > (this.measuredGlasses.get(model) ?? -Infinity)) {
        this.measuredGlasses.set(model, frames);
        for (const cache of [this.lifts, this.accessoryFits]) for (const key of cache.keys()) if (key.endsWith(`/${model}`)) cache.delete(key);
      }
    }
    if (this.fits.has(model) && rank >= (this.skullLods.get(model) ?? 2)) return;
    this.skullLods.set(model, rank);
    for (const cache of [this.lifts, this.accessoryFits]) for (const key of cache.keys()) if (key.endsWith(`/${model}`)) cache.delete(key);
    if (geometry.userData.crowdBinds) this.skinnedModels.add(model);
    const scale = skull.size.divide(referenceSkull.size);
    // Map the reference skull onto this skull: centre to centre, per-axis size ratio.
    this.fits.set(model, new Matrix4().makeTranslation(skull.centre.x, skull.centre.y, skull.centre.z)
      .multiply(new Matrix4().makeScale(scale.x, scale.y, scale.z))
      .multiply(new Matrix4().makeTranslation(-referenceSkull.centre.x, -referenceSkull.centre.y, -referenceSkull.centre.z)));
  }
  drawnSlot(e: EntitySnapshot, lod: string): string | null {
    void lod;
    const slot = this.slot(e); return !slot ? null : this.ids[slot - 1];
  }
  init(): Promise<void> {
    return this.loading ??= Promise.all(this.ids.flatMap(id => (['lod0', 'lod1'] as const).map(lod => this.load(id, lod)))).then(() => undefined);
  }
  private async load(id: string, lod: 'lod0' | 'lod1'): Promise<void> {
    const material = this.shading?.shaded(attribute('color', 'vec3').mul(instanceColor)) ?? new MeshLambertNodeMaterial({ vertexColors: true });
    let geometry: BufferGeometry;
    if (id.startsWith('acc.placeholder-')) {
      geometry = new BoxGeometry(.27, id.endsWith('hair') ? .1 : .06, .28); geometry.translate(0, .4, 0);
      // Use the same vertex colour material as authored rigid accessories.
      const color = new Color(id.endsWith('hair') ? '#674431' : '#476678');
      const values = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < values.length; i += 3) color.toArray(values, i);
      geometry.setAttribute('color', new BufferAttribute(values, 3));
    } else {
      const loaded = await this.registry.loadAsset(id, lod) as Group;
      const anchor = new Group(); anchor.name = 'head'; anchor.add(loaded);
      batchRigidParts(anchor, ['head'], material, source => (source as MeshLambertNodeMaterial).color ?? new Color('#674431'));
      anchor.updateMatrixWorld(true);
      // Exporters may retain the attachment bone's rest translation; geometry is attached in that bone's local space.
      const pivot = loaded.getObjectByName('head'), attachment = pivot && !(pivot instanceof Mesh) ? pivot.matrixWorld.clone().invert() : new Matrix4();
      const pieces: BufferGeometry[] = [];
      anchor.traverse(node => { if (node instanceof Mesh && node.visible) {
        const source = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry;
        const g = new BufferGeometry();
        for (const name of ['position', 'normal', 'color']) {
          const input = source.getAttribute(name); if (!input) continue;
          const values = new Float32Array(input.count * input.itemSize);
          for (let i = 0; i < input.count; i++) for (let c = 0; c < input.itemSize; c++) values[i * input.itemSize + c] = input.getComponent(i, c);
          g.setAttribute(name, new BufferAttribute(values, input.itemSize));
        }
        if (source !== node.geometry) source.dispose();
        g.applyMatrix4(new Matrix4().multiplyMatrices(attachment, node.matrixWorld));
        if (!g.hasAttribute('color')) {
          const color = ((Array.isArray(node.material) ? node.material[0] : node.material) as MeshLambertNodeMaterial).color ?? new Color('#674431');
          const values = new Float32Array(g.getAttribute('position').count * 3);
          for (let i = 0; i < values.length; i += 3) color.toArray(values, i);
          // Registry meshes may consist of only one primitive, which batching leaves intact.
          g.setAttribute('color', new BufferAttribute(values, 3));
        }
        pieces.push(g);
      } });
      geometry = mergeGeometries(pieces)!; pieces.forEach(g => g.dispose());
    }
    const mesh = new InstancedMesh(geometry, material, 350); mesh.name = `${id}:${lod}`;
    // Hat rims can share depth with the skull. Keep their overlap independent
    // of asynchronous material creation order during level preparation.
    mesh.renderOrder = 1;
    mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(StreamDrawUsage);
    mesh.setColorAt(0, new Color(1, 1, 1)); mesh.instanceColor!.setUsage(StreamDrawUsage);
    if (this.disposed) { geometry.dispose(); material.dispose(); mesh.dispose(); return; }
    this.batches.set(`${id}:${lod}`, mesh); this.add(mesh);
  }
  begin(): void { this.infectedBatches.clear(); this.frameLooks.clear(); this.resolvingFrame = true; for (const mesh of this.batches.values()) { mesh.count = 0; mesh.visible = false; } }
  place(e: EntitySnapshot, lod: AccessoryLod, poses: CrowdPosePalette, frame: number, blend: readonly number[], transform: Matrix4, hiddenHead = false): void {
    const slot = this.slot(e), head = poses.clip.parts.indexOf('head');
    if (!slot || head < 0 || hiddenHead || e.corpse) return;
    const model = this.look(e).model;
    const mesh = this.batches.get(`${this.ids[slot - 1]}:${this.skinnedModels.has(model) && definitions.get(this.ids[slot - 1])?.slot === 'hat' ? 'lod0' : lod === 'lod2' ? 'lod1' : lod}`); if (!mesh || mesh.count >= 350) return;
    poses.part(frame, blend[0], blend[1], head, this.headTransform).premultiply(transform);
    const id = this.ids[slot - 1];
    if (this.skinnedModels.has(model) && definitions.get(id)?.slot === 'hat' && e.faction === 'infected') {
      // Keep the brim level through the infected hunch, rotating about the skull rather than the neck pivot.
      const skull = this.brows.get(model)?.centre ?? new Vector3();
      const centre = skull.clone().applyMatrix4(this.headTransform), scale = new Vector3().setFromMatrixScale(this.headTransform);
      const m = this.headTransform.elements, yaw = Math.atan2(-m[2], m[0]);
      this.headTransform.makeRotationY(yaw).scale(scale);
      this.headTransform.setPosition(centre.sub(skull.clone().applyMatrix4(this.headTransform)));
    }
    this.fit(id, model);
    this.headTransform.multiply(this.fitTransform);
    mesh.setMatrixAt(mesh.count, this.headTransform);
    mesh.setColorAt(mesh.count++, definitions.get(id)?.tint === 'hair' ? hairColors[crowdAppearance(e.id).hair] : crowdShirt(e.id + 503));
    mesh.visible = true;
    if (e.faction === 'infected') this.infectedBatches.add(mesh);
  }
  infectedDrawCalls(): number { return this.infectedBatches.size; }
  private fit(id: string, model: string): void {
    const key = `${id}/${model}`, cached = this.accessoryFits.get(key);
    if (cached) { this.fitTransform.copy(cached); return; }
    this.authoredOrRetargeted(id, model);
    const lift = this.glassesLift(id, model);
    if (lift) this.fitTransform.premultiply(this.liftMatrix.makeTranslation(0, lift, 0));
    // Both immutable pieces contribute to width/clearance; wait until both exist.
    if (this.batches.has(`${id}:lod0`) && this.batches.has(`${id}:lod1`)) this.accessoryFits.set(key, this.fitTransform.clone());
  }
  private authoredOrRetargeted(id: string, model: string): void {
    const base = model.replace(/\.aftermath$/, ''), authored = definitions.get(id)?.fits?.[base];
    if (authored && !this.skinnedModels.has(model)) { authoredFit(authored, this.fitTransform); return; }
    const skull = this.fits.get(model);
    if (!skull) { this.fitTransform.identity(); return; }
    // Retargeted reference fit: skull mapping x the reference base's authored fit of this accessory.
    const reference = definitions.get(id)?.fits?.[referenceBase];
    this.fitTransform.copy(skull); if (reference) this.fitTransform.multiply(authoredFit(reference, this.referenceFit));
    if (this.skinnedModels.has(model) && definitions.get(id)?.slot === 'hat') {
      const scale = new Vector3().setFromMatrixScale(skull), centre = new Vector3(referenceSkull.centre.x, referenceSkull.centre.y, referenceSkull.centre.z).applyMatrix4(skull);
      const limit = 1.15, skullDepth = this.brows.get(model)?.depth ?? referenceSkull.size.x * scale.x, skullWidth = this.brows.get(model)?.width ?? referenceSkull.size.z * scale.z;
      let width = 0, depth = 0, height = 0;
      for (const lod of ['lod0', 'lod1']) {
        const geometry = this.batches.get(`${id}:${lod}`)?.geometry; if (!geometry) continue;
        if (!geometry.boundingBox) geometry.computeBoundingBox(); width = Math.max(width, geometry.boundingBox!.clone().applyMatrix4(this.fitTransform).getSize(new Vector3()).z);
        depth = Math.max(depth, geometry.boundingBox!.clone().applyMatrix4(this.fitTransform).getSize(new Vector3()).x);
        height = Math.max(height, geometry.boundingBox!.clone().applyMatrix4(this.fitTransform).getSize(new Vector3()).y);
      }
      this.fitTransform.premultiply(new Matrix4().makeTranslation(centre.x, 0, centre.z).multiply(new Matrix4().makeScale(Math.min(1, skullDepth * limit / depth), Math.min(1, referenceSkull.size.y * scale.y * .42 / height), Math.min(1, skullWidth * limit / width))).multiply(new Matrix4().makeTranslation(-centre.x, 0, -centre.z)));
      const bounds = new Box3();
      for (const lod of ['lod0', 'lod1']) {
        const geometry = this.batches.get(`${id}:${lod}`)?.geometry; if (geometry?.boundingBox) bounds.union(geometry.boundingBox.clone().applyMatrix4(this.fitTransform));
      }
      if (!bounds.isEmpty()) {
        const offset = bounds.getCenter(new Vector3()).x - centre.x, allowance = referenceSkull.size.x * scale.x * .2;
        if (Math.abs(offset) > allowance) this.fitTransform.premultiply(new Matrix4().makeTranslation(Math.sign(offset) * allowance - offset, 0, 0));
        this.fitTransform.premultiply(new Matrix4().makeTranslation(centre.x, centre.y, 0).multiply(new Matrix4().makeRotationZ(.45)).multiply(new Matrix4().makeTranslation(-centre.x, -centre.y, 0)));

      }
    }
  }
  /** PO 10-22 #108 "Glasses are on the hat": hats were fitted to the bare skull, so a brim sat below the frames of
   * a spectacled head (civilian-woman-b, elderly) and the temples poked out through the crown. Seat such a hat with
   * its lowest point just above the frames, the way people wear a hat over glasses. Cached per hat/model. */
  private glassesLift(id: string, model: string): number {
    let top = this.measuredGlasses.get(model) ?? spectacleTops[model.replace(/\.aftermath$/, '')];
    const seat = this.minimumHatY.get(model);
    if (definitions.get(id)?.slot !== 'hat' || top === undefined && seat === undefined) return 0;
    if (top !== undefined && this.skinnedModels.has(model) && !this.measuredGlasses.has(model)) top = this.glassesPoint.set(0, top, 0).applyMatrix4(this.fits.get(model)!).y;
    const key = `${id}/${model}`, cached = this.lifts.get(key); if (cached !== undefined) return cached;
    // One lift for both LOD pieces, so a LOD change never moves the hat.
    const meshes = [this.batches.get(`${id}:lod0`), this.batches.get(`${id}:lod1`)].filter(mesh => !!mesh); if (!meshes.length) return 0;
    const point = new Vector3();
    let bottom = Infinity;
    for (const mesh of meshes) { const position = mesh.geometry.getAttribute('position'); for (let i = 0; i < position.count; i++) bottom = Math.min(bottom, point.fromBufferAttribute(position, i).applyMatrix4(this.fitTransform).y); }
    const lift = Math.max(0, Math.max(top === undefined ? -Infinity : top + glassesClearance, seat ?? -Infinity) - bottom); this.lifts.set(key, lift); return lift;
  }
  private readonly lifts = new Map<string, number>();
  private readonly glassesPoint = new Vector3();
  private readonly liftMatrix = new Matrix4();
  private readonly referenceFit = new Matrix4();
  private headPiece(id: string, model: string, head: number, slot = 0): BufferGeometry {
    this.fit(id, model);
    // Render backends may pad colours/normals to vec4 in place. Read the semantic
    // channels from both sources rather than borrowing their GPU attribute layout.
    const piece = new BufferGeometry(), original = this.batches.get(`${id}:lod1`)!.geometry;
    for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3]] as const) {
      const input = original.getAttribute(name); if (!input) continue;
      const values = new Float32Array(input.count * size);
      for (let i = 0; i < input.count; i++) for (let c = 0; c < size; c++) values[i * size + c] = input.getComponent(i, c);
      piece.setAttribute(name, new BufferAttribute(values, size));
    }
    piece.setIndex(original.index?.clone() ?? Array.from({ length: original.getAttribute('position').count }, (_, i) => i));
    piece.applyMatrix4(this.fitTransform);
    const count = piece.getAttribute('position').count, parts = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { parts[i * 4] = head; parts[i * 4 + 3] = slot ? 128 + slot * 8 : 0; parts[i * 4 + 1] = definitions.get(id)?.tint === 'hair' ? -5 : -4; }
    piece.setAttribute('_parts', new BufferAttribute(parts, 4));
    return piece;
  }
  /** Transfer source ownership to one body draw; each optional head piece retains its exact fitted geometry. */
  livingSource(source: BufferGeometry, model: string, head: number): BufferGeometry {
    if (head < 0 || !this.ids.every(id => this.batches.has(`${id}:lod1`))) return source;
    const body = source.clone(), parts = body.getAttribute('_parts');
    for (let i = 0; i < parts.count; i++) parts.setW(i, parts.getW(i) + 128);
    const pieces = this.ids.map((id, i) => this.headPiece(id, model, head, i + 1));
    const geometry = mergeGeometries([body, ...pieces])!;
    body.dispose(); pieces.forEach(piece => piece.dispose());
    geometry.userData = { ...source.userData, inlineAccessories: true, inlineBody: source };
    geometry.addEventListener('dispose', () => source.dispose());
    return geometry;
  }
  /** Freeze the selected accessory into the body's head part and spatial pages, with no separate head draw. */
  corpseSource(e: EntitySnapshot, source: BufferGeometry, model: string, head: number): BufferGeometry {
    const look = this.look(e);
    if (!look.accessory || head < 0) return source;
    const accessory = this.batches.get(`${look.accessory}:lod1`);
    if (!accessory) return source;
    const key = `${source.uuid}/${model}/${look.accessory}/${head}`;
    const cached = this.corpseSources.get(key); if (cached) return cached;
    const piece = this.headPiece(look.accessory, model, head);
    // Keep the large live buffers shared. StaticCorpses reuses their frozen
    // body pose and merges only after the small head piece has been posed.
    const merged = new BufferGeometry();
    for (const name of ['position', 'normal', 'color', '_parts']) merged.setAttribute(name, source.getAttribute(name));
    merged.setIndex(source.index);
    merged.userData.corpseBody = source; merged.userData.corpseAccessory = piece;
    merged.userData.appearanceTags = source.userData.appearanceTags;
    const surface = crowdSurfaceBindings.get(source);
    if (surface) crowdSurfaceBindings.set(merged, surface);
    this.corpseSources.set(key, merged); return merged;
  }
  finish(): void {
    this.resolvingFrame = false; this.frameLooks.clear();
    for (const mesh of this.batches.values()) if (mesh.count) { mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, mesh.count * 16); mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.clearUpdateRanges(); mesh.instanceColor!.addUpdateRange(0, mesh.count * 3); mesh.instanceColor!.needsUpdate = true; }
  }
  snapshot() { return [...this.batches].map(([id, mesh]) => {
    const raw = crowdVertexLayout(mesh.geometry, mesh.instanceMatrix), buffers = raw.buffers + Number(!!mesh.instanceColor), locations = raw.locations + Number(!!mesh.instanceColor);
    return { id, instances: mesh.count, draws: mesh.count ? 1 : 0, triangles: mesh.count * (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3,
      layout: { buffers, locations, webgpu: buffers <= 8, webgl2: locations <= 16 } };
  }); }
  dispose(): void { this.infectedBatches.clear(); this.resolvingFrame = false; this.frameLooks.clear(); this.disposed = true; for (const mesh of this.batches.values()) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); } void this.registry.dispose(); this.batches.clear(); for (const geometry of this.corpseSources.values()) { (geometry.userData.corpseAccessory as BufferGeometry|undefined)?.dispose(); geometry.dispose(); } this.corpseSources.clear(); this.clear(); }
}
