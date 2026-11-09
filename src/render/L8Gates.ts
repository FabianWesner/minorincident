import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { l8BossArenas, l8EncounterGates, l8YardGates, l8YardWalls } from '../data/l8Bosses';
import type { L8BossId } from '../data/l8Bosses';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';

/** Keeper fences draw the same boxes that own physical route admission. */
export class L8Gates extends Group {
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly rods: { p: Vector3; s: Vector3; gate: boolean; breach: boolean; arena?: L8BossId }[] = [];
  private readonly mesh: InstancedMesh;
  private readonly poseMatrix = new Matrix4();
  private readonly poseRotation = new Quaternion();
  private readonly hiddenScale = new Vector3();
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'l8-keeper-gates';
    const fence = (box: { x: number; z: number; halfX: number; halfZ: number }, gate: boolean, breach = false, arena?: L8BossId) => {
      const horizontal = box.halfX > box.halfZ, length = 2 * (horizontal ? box.halfX : box.halfZ);
      const add = (along: number, y: number, width: number, height: number) => this.rods.push({
        p: new Vector3(box.x + (horizontal ? along : 0), y, box.z + (horizontal ? 0 : along)),
        s: new Vector3(horizontal ? width : .18, height, horizontal ? .18 : width), gate, breach, arena,
      });
      for (const y of [.65, 1.55, 2.5]) add(0, y, length, .16);
      for (let along = -length / 2; along <= length / 2; along += 1) add(along, 1.4, .12, 2.8);
    };
    l8YardWalls.forEach((box, i) => { if (i !== 2) fence(box, false); });
    l8YardGates.forEach(box => fence(box, true));
    for (const def of l8BossArenas) fence(l8EncounterGates[def.id], true, false, def.id);
    this.mesh = new InstancedMesh(this.geometry, materials.fromColor('l8-keeper-fence', new Color('#b7a269'), 0, true), this.rods.length);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.add(this.mesh); this.update();
  }
  update(): void {
    const arenas = this.world.missions?.l8?.state.arenas;
    const closed = !arenas || l8BossArenas.some(def => def.id !== 'elephant' && arenas.find(a => a.id === def.id)?.phase !== 3);
    this.rods.forEach((rod, i) => {
      const arena = arenas?.find(a => a.id === rod.arena);
      const unturned = arena?.ids.some(id => { const e = this.world.entities.get(id); return !!e?.civilian && e.health.current > 0; });
      const hidden = rod.arena ? !arena || (rod.arena === 'elephant' ? !this.world.missions?.state.states.breached || arena.phase === 3 : arena.phase === 0 || arena.phase === 3 || unturned)
        : rod.gate && !closed || rod.breach && !!arenas?.some(a => a.id === 'elephant' && a.phase > 0);
      this.poseMatrix.compose(rod.p, this.poseRotation, hidden ? this.hiddenScale : rod.s); this.mesh.setMatrixAt(i, this.poseMatrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.geometry.dispose(); this.mesh.dispose(); }
}
