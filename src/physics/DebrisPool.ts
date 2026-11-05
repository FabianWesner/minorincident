// Adapted from Bruno Simon folio-2025 Objects.js (MIT): disable/reset sleeping bodies.
import * as RAPIER from '@dimforge/rapier3d-compat';
import type { Physics } from './Physics';
import type { Vec2 } from '../input/InputFrame';
interface Piece { body: RAPIER.RigidBody; until: number; sourceId: number }
/** At most 32 reusable physics pieces (below the 60-body low-tier budget); eight per break. */
export class DebrisPool {
  readonly pieces: Piece[] = [];
  constructor(private readonly physics: Physics) {}
  spawn(sourceId: number, pos: Vec2, tick: number): number {
    let count = 0;
    for (let i = 0; i < 8; i++) {
      let piece = this.pieces.find(p => p.until === 0);
      if (!piece && this.pieces.length < 32) {
        const body = this.physics.world!.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setLinearDamping(.8).setAngularDamping(.8));
        // Cosmetic physics debris does not obstruct characters or damage targets (E26/E27 own that).
        this.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(.12, .1, .22).setCollisionGroups(0x00020002), body);
        piece = { body, until: 0, sourceId }; this.pieces.push(piece);
      }
      if (!piece) break;
      piece.until = tick + 480; piece.sourceId = sourceId; piece.body.setEnabled(true);
      piece.body.setTranslation({ x: pos.x + (i % 4 - 1.5) * .15, y: .6 + Math.floor(i / 4) * .2, z: pos.z }, true);
      piece.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      piece.body.setLinvel({ x: (i % 4 - 1.5) * 1.5, y: 2 + i * .15, z: (Math.floor(i / 4) - .5) * 3 }, true);
      piece.body.setAngvel({ x: i * .2, y: .5, z: 1 }, true); count++;
    }
    return count;
  }
  /** Physics-world replacement invalidates every pooled body; checkpoints discard cosmetic debris. */
  reset(worldReset = false): void {
    if (!worldReset) for (const piece of this.pieces) this.physics.world!.removeRigidBody(piece.body);
    this.pieces.length = 0;
  }
  update(tick: number): void {
    for (const p of this.pieces) if (p.until && tick >= p.until) { p.until = 0; p.body.setEnabled(false); }
  }
  snapshot() { return this.pieces.filter(p => p.until > 0).map(p => ({ sourceId: p.sourceId, until: p.until, position: p.body.translation(), rotation: p.body.rotation() })); }
}
