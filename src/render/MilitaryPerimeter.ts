import { BoxGeometry, CanvasTexture, Color, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, MeshStandardNodeMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three/webgpu';
import { l4PerimeterSegments, l4Wall, l4WallSlots } from '../data/l4Perimeter';
import type { EntitySnapshot } from '../sim/world/types';
import type { SimWorld } from '../sim/world/SimWorld';

/** Three batched draws at both tiers. Geometry shares l4PerimeterSegments with the wall's E26 slots (PO 10-23): each segment shows its
 * damage stage (intact, cracked, sagging inward, fallen) and shakes when hit. */
export class MilitaryPerimeter extends Group {
  private readonly concrete = new MeshStandardNodeMaterial({ color: '#c8c4ae', roughness: .95 });
  private readonly wireMaterial = new MeshStandardNodeMaterial({ color: '#4d5350', metalness: .6, roughness: .5 });
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly barrierBox = new BoxGeometry(1, 1, 1);
  private readonly plane = new PlaneGeometry(1.8, .65);
  private readonly texture: CanvasTexture;
  private readonly signMaterial: MeshBasicNodeMaterial;
  private readonly barriers = new InstancedMesh(this.barrierBox, this.concrete, l4PerimeterSegments.length);
  private readonly wire = new InstancedMesh(this.box, this.wireMaterial, l4PerimeterSegments.length * 7);
  private readonly signs: InstancedMesh;
  private readonly normal = new Color('#ffffff');
  private readonly highlight = new Color('#ffd166');
  constructor(private readonly world: SimWorld) {
    super();
    const vertices = this.barrierBox.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) if (vertices.getY(i) > 0) vertices.setZ(i, vertices.getZ(i) * .45);
    this.barrierBox.computeVertexNormals();
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#e9c957'; c.fillRect(0, 0, 512, 192); c.strokeStyle = '#252b25'; c.lineWidth = 12; c.strokeRect(8, 8, 496, 176);
    c.fillStyle = '#252b25'; c.textAlign = 'center'; c.font = 'bold 48px sans-serif'; c.fillText('MILITARY ZONE', 256, 80); c.font = 'bold 36px sans-serif'; c.fillText('STAY INSIDE', 256, 140);
    this.texture = new CanvasTexture(canvas); this.signMaterial = new MeshBasicNodeMaterial({ map: this.texture, side: DoubleSide });
    const signSegments = l4PerimeterSegments.filter((_, i) => i % 4 === 1);
    this.signs = new InstancedMesh(this.plane, this.signMaterial, signSegments.length);
    l4PerimeterSegments.forEach((_, i) => { this.place(i, 0, 0); this.barriers.setColorAt(i, this.normal); });
    this.barriers.castShadow = this.barriers.receiveShadow = true;
    this.add(this.barriers, this.wire, this.signs);
  }
  private readonly m = new Matrix4(); private readonly part = new Matrix4(); private readonly q = new Quaternion(); private readonly tilt = new Quaternion();
  private readonly pos = new Vector3(); private readonly size = new Vector3(); private readonly axis = new Vector3(); private readonly upDir = new Vector3();
  private readonly yAxis = new Vector3(0, 1, 0);
  /** Damage stage per segment (0 intact, 1 cracked, 2 sagging, 3 fallen) and the shake offset last drawn; -1 = not drawn yet. */
  private readonly drawn = l4PerimeterSegments.map(() => ({ stage: -1, shake: 0, color: undefined as Color | undefined }));
  private readonly segmentIds: number[] = [];
  /**
   * One segment's barrier, wire strands/barbs and sign as a rigid group pivoting on the outer foot of the wall: cracked leans 4 degrees
   * inward, sagging 14 degrees and 8 cm lower with the wire drooping, fallen lies 82 degrees over on the camp side (the wire torn away).
   */
  private place(i: number, stage: number, shake: number): void {
    const s = l4PerimeterSegments[i], slot = l4WallSlots[i], inward = slot.inward;
    const angle = [0, .07, .24, 1.43][stage], drop = [0, 0, .08, .05][stage];
    // Lean axis: the segment's own length axis; the sign makes the top fall toward the camp.
    this.axis.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    const sign = Math.sign(-this.axis.z * inward.x + this.axis.x * inward.z) || 1;
    this.tilt.setFromAxisAngle(this.axis, sign * angle); this.q.setFromAxisAngle(this.yAxis, s.yaw).premultiply(this.tilt);
    // Pivot on the outer foot (0.2 m outside the centre line), shaken along the inward normal on a hit.
    const fx = s.x - inward.x * .2 + inward.x * shake, fz = s.z - inward.z * .2 + inward.z * shake;
    const at = (lx: number, ly: number, lz: number) => this.pos.set(lx, ly, lz).applyQuaternion(this.q).add(this.upDir.set(fx, -drop, fz));
    this.m.compose(at(0, .4, .2), this.q, this.size.set(s.length - .025, .8, .4)); this.barriers.setMatrixAt(i, this.m);
    for (let j = 0; j < 7; j++) {
      const offset = j < 3 ? 0 : (j - 4.5) * s.length / 4, droop = stage >= 2 && j < 3 ? .12 * (3 - j) : 0;
      const visible = stage < 3;
      this.part.compose(at(offset, (j < 3 ? .88 + j * .1 : .99) - droop, .2), this.q, this.size.set(visible ? j < 3 ? s.length : .04 : 0, visible ? j < 3 ? .018 : .26 : 0, visible ? j < 3 ? .018 : .2 : 0));
      this.wire.setMatrixAt(i * 7 + j, this.part);
    }
    if (i % 4 === 1) { this.part.compose(at(0, 1.25, .2), this.q, this.size.setScalar(stage < 3 ? 1 : 0)); this.signs.setMatrixAt((i - 1) / 4, this.part); }
  }
  private segment(i: number): EntitySnapshot | undefined {
    const cached = this.world.entities.get(this.segmentIds[i]);
    if (cached?.barricade?.slot.id === l4WallSlots[i].id) return cached;
    const e = this.world.entities.values().find(x => x.barricade?.slot.id === l4WallSlots[i].id);
    if (e) this.segmentIds[i] = e.id;
    return e;
  }
  update(): void {
    const s = this.world.missions?.state.l4;
    this.visible = !!s && s.phase === 'war';
    if (!this.visible) return;
    const feedback = this.world.controls.blockedMove, active = feedback && feedback.until > this.world.tick, tick = this.world.tick;
    let moved = false, colored = false;
    l4PerimeterSegments.forEach((seg, i) => {
      const e = this.segment(i), b = e?.barricade, f = !e || !b ? 1 : b.intact ? e.health.current / Math.max(1, e.health.max) : 0;
      const stage = f <= 0 ? 3 : f <= l4Wall.sag ? 2 : f <= l4Wall.crack ? 1 : 0, age = b ? tick - b.hitTick : 99;
      const shake = stage < 3 && age < 12 ? Math.sin(age * 2) * .05 * (1 - age / 12) : 0, last = this.drawn[i];
      if (last.stage !== stage || last.shake !== shake) { this.place(i, stage, shake); last.stage = stage; last.shake = shake; moved = true; }
      const color = active && Math.hypot(seg.x - feedback.point.x, seg.z - feedback.point.z) < 4 ? this.highlight : stage ? this.damaged[stage - 1] : this.normal;
      if (last.color !== color) { this.barriers.setColorAt(i, color); last.color = color; colored = true; }
    });
    if (colored) this.barriers.instanceColor!.needsUpdate = true;
    if (moved) { this.barriers.instanceMatrix.needsUpdate = true; this.wire.instanceMatrix.needsUpdate = true; this.signs.instanceMatrix.needsUpdate = true; this.barriers.computeBoundingSphere(); }
  }
  /** Cracked, sagging and fallen concrete read darker and dustier. */
  private readonly damaged = [new Color('#d9d2c4'), new Color('#a8a090'), new Color('#7d7668')];
  dispose(): void {
    this.barriers.dispose(); this.wire.dispose(); this.signs.dispose(); this.box.dispose(); this.barrierBox.dispose(); this.plane.dispose();
    this.concrete.dispose(); this.wireMaterial.dispose(); this.signMaterial.dispose(); this.texture.dispose();
  }
}
