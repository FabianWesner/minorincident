import { Box3, Vector3, BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, StreamDrawUsage } from 'three/webgpu';
import { attribute, instanceColor } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crowdShirt, crowdVertexLayout } from './CrowdAppearance';
import { batchRigidParts } from './batchRigidParts';
import { AssetRegistry } from '../../assets/registry';
import manifest from '../../assets/manifest.json';
import { hairTones, crowdAppearance } from '../../data/crowdAppearance';
import type { EntitySnapshot } from '../../sim/world/types';
import type { CrowdPosePalette } from './CrowdPosePalette';
import { characterNodes } from '../../data/survivor';
import type { Materials } from '../Materials';
type Fit = { scale: number[]; offset: number[]; hasHeadwear?: boolean };
type Accessory = { slot: string; tint?: string; fits?: Record<string, Fit> };
const definitions = new Map((manifest as unknown as { id: string; accessory?: Accessory }[]).map(a => [a.id, a.accessory]));
const hairColors = hairTones.map(c => new Color(c));
export type AccessoryLod = 'lod0' | 'lod1' | 'lod2';
/** Head-local assets, shared across both human crowds: at most one draw per accessory/LOD, never per figure/model.
 * Zero LOD2 triangles is intentional; phones keep the coloured hair and garments without accessory draws. */
export class CrowdAccessories extends Group {
  readonly ids: string[];
  private readonly registry = new AssetRegistry(() => {});
  private readonly batches = new Map<string, InstancedMesh>();
  private readonly headTransform = new Matrix4();
  private disposed = false;
  private readonly fits = new Map<string, Matrix4>();
  private readonly fitTransform = new Matrix4();
  constructor(private readonly shading?: Materials) {
    super(); this.name = 'crowd-accessories';
    this.ids = manifest.filter(a => a.id.startsWith('acc.') && !a.aliasOf).map(a => a.id).sort();
    if (!this.ids.length) this.ids.push('acc.placeholder-hat', 'acc.placeholder-hair');
  }
  slot(e: EntitySnapshot): number {
    // Uniforms and animals retain their authored headgear.
    if (e.civilian?.zooAnimal || e.archetype.startsWith('healthy.')) return 0;
    if (e.infected && !['infected.runner', 'infected.sprinter'].includes(e.archetype)) return 0;
    const model = e.appearance?.asset ?? e.civilian?.model ?? e.infected?.model ?? e.infected?.variant ?? e.archetype;
    if (/firefighter|police|guard|hazmat|riot|armored|lab-|patient-zero|infected\.(dog|cat|crow|lion|gorilla|elephant|zebra|flamingo)/.test(model)) return 0;
    const explicit = e.appearance?.accessories.find(id => this.ids.includes(id));
    return explicit ? this.ids.indexOf(explicit) + 1 : crowdAppearance(e.id).accessory % (this.ids.length + 1);
  }
  hidesHair(e: EntitySnapshot, lod: string): boolean {
    const id = this.drawnSlot(e, lod); if (!id) return false;
    const kind = definitions.get(id)?.slot;
    return kind === 'hat' || kind === 'hair' || id.startsWith('acc.placeholder-');
  }
  /** Authored civilian fits win. Ordinary infected fit the same reference shell to their baked skin skull. */
  registerSkull(model: string, geometry: BufferGeometry): void {
    if (this.fits.has(model)) return;
    const parts = geometry.getAttribute('_parts'), position = geometry.getAttribute('position'), bounds = new Box3(), point = new Vector3();
    for (let i = 0; i < parts.count; i++) if (parts.getX(i) === characterNodes.indexOf('head') && parts.getY(i) === -1) bounds.expandByPoint(point.fromBufferAttribute(position, i));
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new Vector3()), centre = bounds.getCenter(new Vector3());
    const scale = new Vector3(size.x / .3, size.y / .33, size.z / .444);
    const offset = centre.sub(new Vector3(-.01, .215, 0).multiply(scale));
    this.fits.set(model, new Matrix4().makeScale(scale.x, scale.y, scale.z).setPosition(offset));
  }
  drawnSlot(e: EntitySnapshot, lod: string): string | null {
    if (lod === 'lod2') return null;
    const slot = this.slot(e); return !slot ? null : this.ids[slot - 1];
  }
  async init(): Promise<void> {
    await Promise.all(this.ids.flatMap(id => (['lod0', 'lod1'] as const).map(lod => this.load(id, lod))));
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
    mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(StreamDrawUsage);
    mesh.setColorAt(0, new Color(1, 1, 1)); mesh.instanceColor!.setUsage(StreamDrawUsage);
    if (this.disposed) { geometry.dispose(); material.dispose(); mesh.dispose(); return; }
    this.batches.set(`${id}:${lod}`, mesh); this.add(mesh);
  }
  begin(): void { for (const mesh of this.batches.values()) { mesh.count = 0; mesh.visible = false; } }
  place(e: EntitySnapshot, lod: AccessoryLod, poses: CrowdPosePalette, frame: number, blend: readonly number[], transform: Matrix4, hiddenHead = false): void {
    const slot = this.slot(e), head = poses.clip.parts.indexOf('head');
    if (!slot || lod === 'lod2' || head < 0 || hiddenHead || e.corpse) return;
    const mesh = this.batches.get(`${this.ids[slot - 1]}:${lod}`); if (!mesh || mesh.count >= 350) return;
    poses.part(frame, blend[0], blend[1], head, this.headTransform).premultiply(transform);
    const id = this.ids[slot - 1], model = e.appearance?.asset ?? e.civilian?.model ?? e.infected?.model ?? e.infected?.variant ?? e.archetype;
    const base = model.replace(/\.aftermath$/, ''), authored = definitions.get(id)?.fits?.[base];
    if (authored) this.fitTransform.makeScale(...authored.scale as [number, number, number]).setPosition(...authored.offset as [number, number, number]);
    else { const fit = this.fits.get(model); if (fit) this.fitTransform.copy(fit); else this.fitTransform.identity(); }
    this.headTransform.multiply(this.fitTransform);
    mesh.setMatrixAt(mesh.count, this.headTransform);
    mesh.setColorAt(mesh.count++, definitions.get(id)?.tint === 'hair' ? hairColors[crowdAppearance(e.id).hair] : crowdShirt(e.id + 503));
    mesh.visible = true;
  }
  finish(): void {
    for (const mesh of this.batches.values()) if (mesh.count) { mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, mesh.count * 16); mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.clearUpdateRanges(); mesh.instanceColor!.addUpdateRange(0, mesh.count * 3); mesh.instanceColor!.needsUpdate = true; }
  }
  snapshot() { return [...this.batches].map(([id, mesh]) => {
    const raw = crowdVertexLayout(mesh.geometry, mesh.instanceMatrix), buffers = raw.buffers + Number(!!mesh.instanceColor), locations = raw.locations + Number(!!mesh.instanceColor);
    return { id, instances: mesh.count, draws: mesh.count ? 1 : 0, triangles: mesh.count * (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3,
      layout: { buffers, locations, webgpu: buffers <= 8, webgl2: locations <= 16 } };
  }); }
  dispose(): void { this.disposed = true; for (const mesh of this.batches.values()) { mesh.geometry.dispose(); (mesh.material as MeshLambertNodeMaterial).dispose(); mesh.dispose(); } void this.registry.dispose(); this.batches.clear(); this.clear(); }
}
