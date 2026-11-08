import { Box3, Vector3, Matrix4 } from 'three/webgpu';
import { isFollower, barEligible } from '../../src/render/HealthBars';
import { pickBodies } from '../../src/render/characters/PickBodies';
import type { Game } from '../../src/Game';
export function inspectL6Bars(game: Game, ids: number[]) {
  const view = game.view as unknown as { camera: import('three/webgpu').PerspectiveCamera; healthBars: { heroScreen: unknown } };
  return { heroScreen: view.healthBars.heroScreen, actors: ids.map(id => {
    const e = game.world.entities.get(id)!, box = new Box3(), projected = new Matrix4().multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse), visibleBounds = pickBodies.bounds(id, box);
    const entry = (pickBodies as unknown as { entries: Map<number, { vertices?: Float32Array; geometry?: import('three/webgpu').BufferGeometry; worldParts?: Matrix4[]; instance: Matrix4; pose: number; outgoing: number; weight: number }> }).entries.get(id);
    const bad: unknown[] = []; if (entry?.vertices && entry.geometry) for (let v = 0; v < entry.vertices.length / 3; v++) { if (Number.isFinite(entry.vertices[v * 3]) && Number.isFinite(entry.vertices[v * 3 + 1]) && Number.isFinite(entry.vertices[v * 3 + 2])) continue; const g=entry.geometry, parts=g.getAttribute('_parts'), skin=g.getAttribute('_skin'); if(bad.length<3)bad.push({ v, parts:[parts.getX(v),parts.getY(v),parts.getZ(v),parts.getW(v)],skin:[skin.getX(v),skin.getY(v),skin.getZ(v),skin.getW(v)] }); }
    const p = visibleBounds ? box.getCenter(new Vector3()).project(view.camera).toArray() : null;
    return { id, bad, pose: entry && { pose: entry.pose, outgoing: entry.outgoing, weight: entry.weight, instance: entry.instance.elements, badMatrices: entry.worldParts?.map((m,i)=>({i, finite:m.elements.every(Number.isFinite)})).filter(m=>!m.finite) }, isFollower: isFollower(e), eligible: barEligible(e, game.world.entities.get(1)!.transform, false, true), hidden: e.hidden, infection: e.infection, civilianState: e.civilian?.state, corpse: e.corpse, visibleBounds, bounds: box, projectedCenter: p, projectedTop: pickBodies.top(id, projected) };
  }) };
}
