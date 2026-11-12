import { Box3, BoxGeometry, Color, Group, InstancedMesh, Matrix4, Quaternion, Ray, Vector3 } from 'three/webgpu';
import { l8PathWalls, l8ConnectorGates, l8EncounterGates, l8GateClosed, l8PlazaGates, l8Route, l8YardGates, l8YardWalls } from '../data/l8Bosses';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';

/** Keeper fences draw the same boxes that own physical route admission (r33-l8route: the cell doors follow `l8GateClosed`, the same rule as the sim barriers). */
export class L8Gates extends Group {
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly rods: { p: Vector3; s: Vector3; gate: boolean; breach: boolean; key?: string; panel: number }[] = [];
  private readonly mesh: InstancedMesh;
  private readonly poseMatrix = new Matrix4();
  private readonly poseRotation = new Quaternion();
  private readonly hiddenScale = new Vector3();
  /** One drawn panel per gate/wall (its rods share the flag), for the courier x-ray test. */
  private readonly panels: { bounds: Box3; shown: boolean }[] = [];
  private readonly ray = new Ray();
  private readonly target = new Vector3();
  private readonly hit = new Vector3();
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'l8-keeper-gates';
    const fence = (box: { x: number; z: number; halfX: number; halfZ: number }, gate: boolean, breach = false, key?: string) => {
      const horizontal = box.halfX > box.halfZ, length = 2 * (horizontal ? box.halfX : box.halfZ);
      const panel = this.panels.length;
      this.panels.push({ bounds: new Box3(new Vector3(box.x - (horizontal ? box.halfX : .09), 0, box.z - (horizontal ? .09 : box.halfZ)), new Vector3(box.x + (horizontal ? box.halfX : .09), 2.8, box.z + (horizontal ? .09 : box.halfZ))), shown: true });
      const add = (along: number, y: number, width: number, height: number) => this.rods.push({
        p: new Vector3(box.x + (horizontal ? along : 0), y, box.z + (horizontal ? 0 : along)),
        s: new Vector3(horizontal ? width : .18, height, horizontal ? .18 : width), gate, breach, key, panel,
      });
      for (const y of [.65, 1.55, 2.5]) add(0, y, length, .16);
      for (let along = -length / 2; along <= length / 2; along += 1) add(along, 1.4, .12, 2.8);
    };
    l8PathWalls.forEach(box => fence(box, false));
    l8YardWalls.forEach((box, i) => { if (i !== 2) fence(box, false); });
    l8YardGates.forEach(box => fence(box, true));
    for (const stage of l8Route) { if (stage.entry) fence(stage.entry, true, false, `${stage.id}.entry`); if (stage.exit) fence(stage.exit, true, false, `${stage.id}.exit`); }
    for (const [side, box] of Object.entries(l8PlazaGates)) fence(box, true, false, `plaza.${side}`);
    l8ConnectorGates.forEach((box, i) => fence(box, true, false, `connector.${i}`));
    fence(l8EncounterGates.elephant, true, false, 'elephant');
    fence(l8EncounterGates.elephantEntry, true, false, 'elephantEntry');
    fence(l8EncounterGates.elephantExit, true, false, 'elephantExit');
    this.mesh = new InstancedMesh(this.geometry, materials.fromColor('l8-keeper-fence', new Color('#b7a269'), 0, true), this.rods.length);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.add(this.mesh); this.update();
  }
  update(): void {
    const arenas = this.world.missions?.l8?.state.arenas;
    const closed = !arenas || l8Route.some(stage => stage.id !== 'elephant' && arenas.find(a => a.id === stage.id)?.phase !== 3);
    const ctx = { arenas: arenas ?? [], sealed: !!this.world.missions?.l8?.state.sealedAt };
    this.rods.forEach((rod, i) => {
      const hidden = rod.key === 'elephant' ? !this.world.missions?.state.states.breached || arenas?.find(a => a.id === 'elephant')?.phase === 3
        : rod.key === 'elephantEntry' ? !!arenas && arenas.every(a => a.id === 'elephant' || a.phase === 3) && !(arenas.find(a => a.id === 'elephant')?.phase && arenas.find(a => a.id === 'elephant')?.armed)
        : rod.key === 'elephantExit' ? arenas?.find(a => a.id === 'elephant')?.phase === 3
        : rod.key ? !arenas || !l8GateClosed(rod.key, ctx)
        : rod.gate && !closed || rod.breach && !!arenas?.some(a => a.id === 'elephant' && a.phase > 0);
      this.panels[rod.panel].shown = !hidden;
      this.poseMatrix.compose(rod.p, this.poseRotation, hidden ? this.hiddenScale : rod.s); this.mesh.setMatrixAt(i, this.poseMatrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  /** r36-l8gates (QA P2 "L8 gate panels are drawn through the courier"): the panels stand inside the sim barrier, so she never
   * overlaps one, but a 2.8 m lattice between the camera and her chest or head hides her behind its rods. Like a vehicle hull,
   * the caller then draws her in the foreground slice with the gold contour. */
  courierOccluded(camera: Vector3, courier: { x: number; y: number; z: number }): boolean {
    for (const height of [.35, .85]) {
      this.target.set(courier.x, courier.y + height, courier.z);
      const distance = camera.distanceTo(this.target);
      this.ray.origin.copy(camera); this.ray.direction.copy(this.target).sub(camera).normalize();
      for (const panel of this.panels) if (panel.shown && this.ray.intersectBox(panel.bounds, this.hit) && this.hit.distanceTo(camera) < distance) return true;
    }
    return false;
  }
  dispose(): void { this.geometry.dispose(); this.mesh.dispose(); }
}
