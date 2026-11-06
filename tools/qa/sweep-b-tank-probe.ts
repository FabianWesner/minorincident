/** Exact renderer shot records against the currently drawn military meshes. */
import { Box3, Matrix4, Raycaster, Vector3, type Group, type InstancedMesh } from 'three/webgpu';
import type { Game } from '../../src/Game';
export function installTankProbe(game: Game) {
  const rows: unknown[] = [];
  const ray = new Raycaster();
  const view = game.view as unknown as { militaryPerimeter: Group | null };
  const hits = (from: number[], to: number[]) => {
    const start = new Vector3(...from), delta = new Vector3(...to).sub(start), length = delta.length();
    ray.set(start, delta.normalize()); ray.near = 1e-5; ray.far = Math.max(0, length - 1e-5);
    const wall = view.militaryPerimeter; if (!wall?.visible) return [];
    return wall.children.flatMap((mesh, index) => ray.intersectObject(mesh).map(h => ({ part: ['concrete', 'wire', 'sign'][index], instance: h.instanceId, distance: h.distance, point: h.point.toArray(), face: h.faceIndex })));
  };
  const off = game.world.events.on('ally.attack', event => {
    if (event.type !== 'ally.attack' || event.role !== 'tank') return;
    const w = game.world, s = w.missions!.state.l4!;
    const rendered = game.view.getState().vfx!.shots.at(-1)!;
    if (rendered.sourceId !== event.sourceId || rendered.tick !== w.tick) throw new Error('Tank event does not match the actual VFX shot');
    // The event already went through Vfx.gunshot. Update presentation only at
    // this exact tick so ray tests use the current damaged wall instance matrices.
    game.view.update(1); game.view.scene.updateMatrixWorld(true);
    const wall = view.militaryPerimeter!;
    let control: unknown = null;
    if (wall.visible) {
      const mesh = wall.children[0] as InstancedMesh, m = new Matrix4(); mesh.getMatrixAt(0, m); m.premultiply(mesh.matrixWorld);
      const from = new Vector3(0, 0, -2).applyMatrix4(m), to = new Vector3(0, 0, 2).applyMatrix4(m);
      control = { from: from.toArray(), to: to.toArray(), intersections: hits(from.toArray(), to.toArray()) };
    }
    rows.push({ tick: w.tick, event: structuredClone(event), phase: s.phase, tankPhase: s.tankPhase, tank: { ...w.entities.get(s.tankId)!.transform },
      actualShot: structuredClone(rendered), visibleWall: wall.visible, wallBounds: new Box3().setFromObject(wall).isEmpty() ? null : { min: new Box3().setFromObject(wall).min.toArray(), max: new Box3().setFromObject(wall).max.toArray() },
      intersections: hits(rendered.tracerStart, rendered.end), positiveGeometryControl: control,
      intactWallIds: [...w.entities.iterate()].filter(e => e.barricade?.intact && e.barricade.slot.groupId === 'l4-wall').map(e => e.id),
      renderedTank: game.view.getState().entityAssets?.actors.find(e => e.id === s.tankId),
    });
  }, 8);
  return { rows, stop: off };
}
