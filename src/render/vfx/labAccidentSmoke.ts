import { BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three/webgpu';
import { Rng } from '../../core/Rng';

/** Opaque accident props that the shared soft particle pool cannot do: dark smoke puffs (alpha-faded billboards with a
 * firm body) and hard glass shards / dark debris with ballistic motion. Pooled plain meshes (about 170 draws at most, only
 * while active; hidden when idle) so no instancing path is involved. They live in the scene from level load, so the
 * pre-render pass compiles their pipelines before the blast. */
const PUFFS = 150, PIECES = 64;
interface Puff { x: number; y: number; z: number; vx: number; vy: number; vz: number; born: number; life: number; size: number; shade: number }
interface Piece { x: number; y: number; z: number; vx: number; vy: number; vz: number; born: number; life: number; size: number; spin: number; rot: number; landed: boolean; glass: boolean }

function puffTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.55, 'rgba(255,255,255,0.92)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export class SmokeColumn extends Group {
  private readonly puffMeshes: Mesh[] = [];
  private readonly pieceMeshes: Mesh[] = [];
  private readonly puffs: Puff[] = [];
  private readonly pieces: Piece[] = [];
  private readonly texture = puffTexture();
  private readonly axis = new Vector3();
  private readonly spin = new Quaternion();
  constructor() {
    super();
    this.name = 'lab-accident-fx';
    const plane = new PlaneGeometry(1, 1), box = new BoxGeometry(1, 1, 0.35);
    for (let i = 0; i < PUFFS; i++) {
      const m = new Mesh(plane, new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, map: this.texture ?? undefined, opacity: 0 }));
      m.visible = false; m.frustumCulled = false; m.renderOrder = 3; this.puffMeshes.push(m); this.add(m);
    }
    const glass = new MeshBasicNodeMaterial({ color: 0xd5f3fa }), dark = new MeshBasicNodeMaterial({ color: 0x25252a });
    for (let i = 0; i < PIECES; i++) {
      const m = new Mesh(box, i % 3 === 0 ? dark : glass); m.visible = false; m.frustumCulled = false; this.pieceMeshes.push(m); this.add(m);
    }
  }
  get puffCount(): number { return this.puffs.length; }
  get pieceCount(): number { return this.pieces.length; }
  spawnPuff(now: number, rng: Rng, x: number, y: number, z: number): void {
    if (this.puffs.length >= PUFFS) this.puffs.shift();
    this.puffs.push({ x: x + (rng.next() - 0.5) * 0.8, y: y + rng.next() * 0.4, z: z + (rng.next() - 0.5) * 0.8, vx: 0.4 + (rng.next() - 0.5) * 0.5, vy: 1.5 + rng.next() * 0.9, vz: (rng.next() - 0.5) * 0.4, born: now, life: 7 + rng.next() * 2, size: 2.4 + rng.next() * 1.8, shade: rng.next() });
  }
  /** Hard shard or debris chunk. `glass` = bright opaque pane fragment, else dark chunk (decided by the mesh slot). */
  spawnPiece(now: number, rng: Rng, x: number, y: number, z: number, dx: number, dz: number, glass: boolean): void {
    if (this.pieces.length >= PIECES) this.pieces.shift();
    const spread = (rng.next() - 0.5) * 2.2, c = Math.cos(spread), s = Math.sin(spread), speed = 3 + rng.next() * 4;
    this.pieces.push({ x, y, z, vx: (dx * c - dz * s) * speed, vy: 2 + rng.next() * 3.5, vz: (dx * s + dz * c) * speed, born: now, life: 8 + rng.next() * 3, size: glass ? 0.14 + rng.next() * 0.18 : 0.2 + rng.next() * 0.25, spin: (rng.next() - 0.5) * 14, rot: rng.next() * 6, landed: false, glass });
  }
  /** Step by render seconds; `now` is the shared fx clock, `facing` the camera orientation for billboarding. */
  advance(now: number, seconds: number, facing: Quaternion): void {
    let n = 0;
    for (let i = 0; i < this.puffs.length;) {
      const p = this.puffs[i], age = now - p.born;
      if (age >= p.life) { this.puffs.splice(i, 1); continue; }
      i++;
      const k = age / p.life, m = this.puffMeshes[n++], grow = p.size * (1 + k * 0.9), shade = 0.16 + p.shade * 0.1;
      m.visible = true; m.position.set(p.x + p.vx * age, p.y + p.vy * age + 0.05 * age * age, p.z + p.vz * age); m.quaternion.copy(facing); m.scale.set(grow, grow, 1);
      const mat = m.material as MeshBasicNodeMaterial;
      mat.opacity = 0.92 * Math.min(1, age / 0.5) * Math.min(1, (1 - k) * 3.5);
      mat.color.setRGB(shade * 0.9, shade * 1.05, shade * 0.92);
    }
    for (let i = n; i < PUFFS; i++) { if (!this.puffMeshes[i].visible) break; this.puffMeshes[i].visible = false; }
    n = 0;
    for (let i = 0; i < this.pieces.length;) {
      const q = this.pieces[i], age = now - q.born;
      if (age >= q.life) { this.pieces.splice(i, 1); continue; }
      i++;
      if (!q.landed) {
        q.vy -= 9.8 * seconds; q.x += q.vx * seconds; q.y += q.vy * seconds; q.z += q.vz * seconds; q.rot += q.spin * seconds;
        if (q.y <= 0.06) { q.y = 0.06; q.landed = true; }
      }
      const m = this.pieceMeshes[n++], size = q.size * Math.min(1, (q.life - age) / 0.6);
      m.visible = true; m.position.set(q.x, q.y, q.z); m.scale.setScalar(size);
      m.quaternion.copy(this.spin.setFromAxisAngle(this.axis.set(0.4, 1, 0.3).normalize(), q.rot));
    }
    for (let i = n; i < PIECES; i++) { if (!this.pieceMeshes[i].visible) break; this.pieceMeshes[i].visible = false; }
  }
  /** Prewarm-safe: leaves nothing alive. */
  reset(): void { this.puffs.length = 0; this.pieces.length = 0; for (const m of [...this.puffMeshes, ...this.pieceMeshes]) m.visible = false; }
  dispose(): void {
    this.reset(); this.texture?.dispose();
    const seen = new Set<unknown>();
    for (const m of [...this.puffMeshes, ...this.pieceMeshes]) { for (const part of [m.geometry, m.material]) if (!seen.has(part)) { seen.add(part); (part as { dispose(): void }).dispose(); } }
  }
}
