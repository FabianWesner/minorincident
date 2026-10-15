import { BoxGeometry, CanvasTexture, Color, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, MeshStandardNodeMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three/webgpu';
import { l4PerimeterSegments } from '../data/l4Perimeter';
import type { SimWorld } from '../sim/world/SimWorld';

/** Three batched draws at both tiers. Geometry and physics share l4PerimeterWalls. */
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
    const m = new Matrix4(), q = new Quaternion(), pos = new Vector3(), scale = new Vector3(), up = new Vector3(0, 1, 0);
    const matrix = (x: number, y: number, z: number, yaw: number, w: number, h: number, d: number) => m.compose(pos.set(x, y, z), q.setFromAxisAngle(up, yaw), scale.set(w, h, d));
    l4PerimeterSegments.forEach((s, i) => {
      this.barriers.setMatrixAt(i, matrix(s.x, .4, s.z, s.yaw, s.length - .025, .8, .4)); this.barriers.setColorAt(i, this.normal);
      // Tensioned strands and diagonal barbs sit above the low concrete line.
      for (let j = 0; j < 7; j++) {
        const offset = j < 3 ? 0 : (j - 4.5) * s.length / 4;
        this.wire.setMatrixAt(i * 7 + j, matrix(s.x + Math.cos(s.yaw) * offset, j < 3 ? .88 + j * .1 : .99, s.z - Math.sin(s.yaw) * offset, s.yaw, j < 3 ? s.length : .04, j < 3 ? .018 : .26, j < 3 ? .018 : .2));
      }
    });
    signSegments.forEach((s, i) => this.signs.setMatrixAt(i, matrix(s.x, 1.25, s.z, s.yaw, 1, 1, 1)));
    this.barriers.castShadow = this.barriers.receiveShadow = true;
    this.add(this.barriers, this.wire, this.signs);
  }
  update(): void {
    const s = this.world.missions?.state.l4;
    this.visible = !!s && s.phase === 'war';
    if (!this.visible) return;
    const feedback = this.world.controls.blockedMove, active = feedback && feedback.until > this.world.tick;
    l4PerimeterSegments.forEach((s, i) => this.barriers.setColorAt(i, active && Math.hypot(s.x - feedback.point.x, s.z - feedback.point.z) < 4 ? this.highlight : this.normal));
    this.barriers.instanceColor!.needsUpdate = true;
  }
  dispose(): void {
    this.barriers.dispose(); this.wire.dispose(); this.signs.dispose(); this.box.dispose(); this.barrierBox.dispose(); this.plane.dispose();
    this.concrete.dispose(); this.wireMaterial.dispose(); this.signMaterial.dispose(); this.texture.dispose();
  }
}
