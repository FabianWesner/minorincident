import { BufferAttribute, Group, Matrix4, Mesh, MeshLambertNodeMaterial, Quaternion, Vector3, type Object3D } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { batchRigidParts } from './batchRigidParts';
import { courierBones, driveHelpers, type CourierBones } from './CourierRig';
import { alignSkeleton } from './skin';
import { disposeCharacter, loadTierGear, type CharacterRig } from './rig';
import { characterNodes } from '../../data/survivor';
import type { Materials } from '../Materials';
import { sampleClip } from './clips';
import { LimbIK } from './LimbIK';
import type { AssetRegistry } from '../../assets/registry';
import { prepareCivilianRig } from '../npc/prepareCivilianGeometry';
import { useCourierDepth } from './courierDepth';

/** A seated render copy; its hidden simulation actor continues to own boarding and exits. */
export class VehicleOccupant extends Group {
  private readonly hip: Object3D;
  private readonly bones?: CourierBones;
  private readonly rig: CharacterRig;
  private readonly arms: LimbIK[];
  private readonly point = new Vector3();
  private readonly pole = new Vector3();
  private readonly orientation = new Quaternion();
  private readonly parentRotation = new Quaternion();
  private readonly seatRotation = new Quaternion();
  private readonly matrixPosition = new Vector3();
  private readonly matrixScale = new Vector3();
  private readonly inverseParent = new Matrix4();
  private readonly grip = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
  private readonly torso: Object3D;
  private readonly torsoRest = new Quaternion();
  readonly handGapM = [0, 0];
  private readonly hand = new Vector3();
  private readonly hipOffset = new Vector3();
  private constructor(readonly actorId: number, readonly asset: string, readonly model: Object3D, private readonly ownsModel = false, private readonly tierGear?: Awaited<ReturnType<typeof loadTierGear>>) {
    super(); this.add(model);
    sampleClip(model, 'npc-sit', 0); this.bones = courierBones(model);
    this.rig = Object.fromEntries(characterNodes.map(name => [name, model.getObjectByName(name)!])) as CharacterRig;
    this.hip = model.getObjectByName('hip')!;
    this.torso = model.getObjectByName('torso')!; this.torsoRest.copy(this.torso.quaternion);
    this.arms = (['L', 'R'] as const).map(side => new LimbIK(model.getObjectByName(`arm${side}`)!, model.getObjectByName(`foreArm${side}`)!, model.getObjectByName(`hand${side}`)!));
    model.updateMatrixWorld(true);
    // The civilian's standing fit lives on the model root. Seat offsets are in
    // this group's metres, so retain that scale when bringing the hip to zero.
    this.hipOffset.copy(this.hip.getWorldPosition(this.point)); this.worldToLocal(this.hipOffset);
    model.position.sub(this.hipOffset);
  }
  static async load(registry: AssetRegistry, actorId: number, asset: string, materials: Materials, low = false): Promise<VehicleOccupant> {
    if (asset.startsWith('char.courier-')) {
      const url = registry.definition(asset).glb.replace(/\.glb$/, '.skin.glb').replace(/^public\//, '/');
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const model = (await loader.loadAsync(url)).scene;
      alignSkeleton(model);
      const material = materials.fromVertexColors(`vehicle:${asset}`); material.movingFigure.value = 1; material.userData.sharedPalette = true;
      const old = new Set<import('three').Material>(), releases: (() => void)[] = [];
      const body = new Set<Mesh>();
      model.traverse(node => {
        if (!(node instanceof Mesh)) return;
        body.add(node);
        const source = (Array.isArray(node.material) ? node.material[0] : node.material) as import('three').MeshStandardMaterial;
        for (const m of Array.isArray(node.material) ? node.material : [node.material]) old.add(m);
        // Textured bodies (female courier) keep their map through the shared texture route.
        const map = source.name === 'tex_baseColor' ? source.map as import('three/webgpu').Texture | null : null;
        if (map) {
          const textured = materials.fromTexture(`vehicle:${asset}:tex`, map); textured.movingFigure.value = 1; textured.userData.sharedPalette = true;
          node.material = textured; releases.push(() => { materials.releaseTexture(map); map.dispose(); });
        } else node.material = material;
        for (const m of Array.isArray(node.material) ? node.material : [node.material]) useCourierDepth(m);
        node.castShadow = node.receiveShadow = true;
      });
      for (const m of old) m.dispose();
      const tierGear = await loadTierGear(loader, asset === 'char.courier-male' ? 'male' : 'female', low, body, material, map => {
        const textured = materials.fromTexture(`vehicle:${asset}:gear`, map);
        textured.movingFigure.value = 1; textured.userData.sharedPalette = true;
        useCourierDepth(textured);
        releases.push(() => { materials.releaseTexture(map); map.dispose(); });
        return textured;
      });
      const occupant = new VehicleOccupant(actorId, asset, model, true, tierGear); occupant.releases = releases;
      return occupant;
    }
    const model = await registry.loadAsset(asset, 'lod1');
    // Match the on-foot body size and restore sitting/lying exports before
    // sampling the common seated clip. Otherwise the vehicle copy uses a
    // different body frame (or applies a second sitting pose).
    prepareCivilianRig(model as Group, asset);
    // Registry clones share their source resources; batching owns copies only.
    // Textured figures (registry atlas route) keep the registry's shared textured material, exactly as on foot; recolouring them to
    // plain swatches made them pale. Only untextured parts take the vertex-colour route below.
    const textured = (m: import('three').Material) => !!(m as import('three').MeshStandardMaterial).map;
    model.traverse(node => { if (node instanceof Mesh) { node.geometry = node.geometry.clone(); if ((Array.isArray(node.material) ? node.material : [node.material]).some(textured)) { for (const m of Array.isArray(node.material) ? node.material : [node.material]) (m as import('../PaletteMaterial').PaletteMaterial).movingFigure.value = 1; return; } const copy = (m: import('three').Material) => new MeshLambertNodeMaterial({ color: (m as import('three').MeshStandardMaterial).color }); node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material); } });
    const material = materials.fromVertexColors(`vehicle:${asset}`); material.movingFigure.value = 1; material.userData.sharedPalette = true;
    batchRigidParts(model, characterNodes, material, source => (source as import('three').MeshStandardMaterial).color);
    model.traverse(node => {
      if (!(node instanceof Mesh) || node.material === material || (Array.isArray(node.material) ? node.material : [node.material]).some(textured)) return;
      const source = Array.isArray(node.material) ? node.material[0] : node.material;
      const color = (source as MeshLambertNodeMaterial).color.toArray(), count = node.geometry.getAttribute('position').count, colors = new Float32Array(count * 3);
      // Skinned palette pieces retain their authored paint (e.g. red firefighter helmets).
      const authored = node.geometry.getAttribute('color');
      for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) colors[i * 3 + c] = color[c] * (authored ? authored.getComponent(i, c) : 1);
      node.geometry.setAttribute('color', new BufferAttribute(colors, 3));
      for (const m of Array.isArray(node.material) ? node.material : [node.material]) m.dispose();
      node.material = material;
    });
    return new VehicleOccupant(actorId, asset, model, true);
  }
  private releases: (() => void)[] = [];
  dispose(): void { if (this.ownsModel) disposeCharacter(this.model as Group); for (const release of this.releases.splice(0)) release(); this.removeFromParent(); }
  /** Hip at the seat node, both shoes forward in the footwell; drivers grip the authored wheel. */
  pose(seat: Object3D, wheel?: Vector3, fit = 1, driverLean = -.5, driverSlide = .2, gearTier = 0): void {
    if (this.tierGear) {
      const { mesh, tierTris } = this.tierGear;
      const count = gearTier > 0 ? tierTris[Math.min(gearTier, tierTris.length) - 1] ?? 0 : 0;
      mesh.visible = count > 0; mesh.geometry.setDrawRange(0, count * 3);
    }
    // Compact car cushions/roofs are authored for smaller seated figures than the standing hero.
    this.scale.setScalar(fit);
    seat.updateWorldMatrix(true, false);
    this.parent!.updateWorldMatrix(true, false);
    this.parent!.matrixWorld.decompose(this.matrixPosition, this.parentRotation, this.matrixScale);
    seat.matrixWorld.decompose(this.matrixPosition, this.seatRotation, this.matrixScale);
    this.position.setFromMatrixPosition(seat.matrixWorld).applyMatrix4(this.inverseParent.copy(this.parent!.matrixWorld).invert());
    this.quaternion.copy(this.parentRotation).invert().multiply(this.seatRotation);
    if (wheel) this.position.x += Math.max(0, Math.min(driverSlide, wheel.x - this.position.x - .35 * fit)); // stay within the cushion
    this.torso.quaternion.copy(this.torsoRest);
    this.torso.rotateZ(wheel ? driverLean : -.25);
    this.updateWorldMatrix(true, true);
    for (let i = 0; i < 2; i++) {
      if (wheel) { this.point.copy(wheel).add(new Vector3(-.04, .025, i === 0 ? -.12 : .12)); this.point.applyMatrix4(this.parent!.matrixWorld); }
      else this.point.set(.2, .1, i === 0 ? -.11 : .11).applyMatrix4(this.matrixWorld);
      this.pole.set(.15, -.8, i === 0 ? -.3 : .3).transformDirection(this.parent!.matrixWorld);
      this.orientation.copy(this.parentRotation).multiply(this.grip);
      this.arms[i].solve(this.point, this.pole, this.orientation, 1, true);
      this.handGapM[i] = this.hand.setFromMatrixPosition(this.arms[i].end.matrixWorld).distanceTo(this.point);
    }
    if (this.bones) driveHelpers(this.rig, this.bones);
  }
}
