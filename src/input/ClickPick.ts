import { Vector3, type Camera } from 'three';
import type { EntitySnapshot } from '../sim/world/types';
import { downed } from '../sim/combat/Damage';
import { pickBodies, type PickBody } from '../render/characters/PickBodies';

/** Body half-width of the click capsule (metres); ~29 px at the default zoom, scaled with zoom. */
export const pickRadius = .28;

/** A plain click targets live infected and downed ones (ground hits restart their down time, PO 10-08); props,
 * cars and civilians never turn a click-to-move into a fight (PO, after respawn). */
export function clickable(e: EntitySnapshot): boolean {
  return e.faction === 'infected' && !e.hidden && !e.infected?.hidden && !e.corpse && (e.health.current > 0 || downed(e));
}

/** Diablo-style hover pick (combat proposal 1.3): the click is tested against a screen-space capsule through the
 * infected's drawn feet, hips and head (the pose the player sees: lunging, hunched or lying), not the sim origin.
 * The best normalised distance wins; near-ties go to the body nearer the camera (the one drawn in front). */
export class ClickPick {
  private readonly body: PickBody = { feet: new Vector3(), hip: new Vector3(), head: new Vector3() };
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly c = new Vector3();
  private readonly top = new Vector3();
  private wasDrawn = false;
  /** Candidates of the last click (id, normalised distance, camera depth, drawn or sim capsule); test probes only. */
  readonly last: { id: number; score: number; depth: number; drawn: boolean }[] = [];
  constructor(private readonly camera: Camera, private readonly canvas: HTMLElement) {}
  pick(x: number, y: number, targets: Iterable<EntitySnapshot>): EntitySnapshot | null {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const fov = (this.camera as Camera & { fov?: number }).fov ?? 25;
    const focal = rect.height / (2 * Math.tan(fov * Math.PI / 360));
    let best: EntitySnapshot | null = null, bestScore = Infinity, bestDepth = Infinity; this.last.length = 0;
    for (const target of targets) {
      if (!clickable(target)) continue;
      const body = this.drawn(target);
      // Top of the head: the capsule reaches a little past the head centre along the body axis.
      this.top.subVectors(body.head, body.hip); const length = this.top.length();
      this.top.multiplyScalar(length > 1e-6 ? .1 / length : 0).add(body.head);
      const depth = this.camera.position.distanceTo(body.hip);
      const radius = Math.max(14, pickRadius * focal / Math.max(.5, depth));
      this.screen(body.feet, rect, this.a); this.screen(body.hip, rect, this.b); this.screen(this.top, rect, this.c);
      if (this.a.z > 1 || this.b.z > 1 || this.c.z > 1) continue;
      const distance = Math.min(segment(x, y, this.a, this.b), segment(x, y, this.b, this.c)), score = distance / radius;
      if (score > 1) continue;
      this.last.push({ id: target.id, score, depth, drawn: this.wasDrawn });
      if (score < bestScore - .08 || (score < bestScore + .08 && depth < bestDepth)) { best = target; bestScore = score; bestDepth = depth; }
    }
    return best;
  }
  /** The rendered body, or a standing capsule over the sim origin (transforms sit 0.7 m above the feet). */
  private drawn(e: EntitySnapshot): PickBody {
    this.wasDrawn = !!pickBodies.body(e.id, this.body);
    if (this.wasDrawn) return this.body;
    const t = e.transform, lying = e.health.current <= 0;
    this.body.feet.set(t.x, t.y - .7, t.z);
    if (lying) { this.body.hip.set(t.x, t.y - .55, t.z); this.body.head.set(t.x - Math.cos(t.yaw) * .9, t.y - .55, t.z + Math.sin(t.yaw) * .9); }
    else { this.body.hip.set(t.x, t.y + .25, t.z); this.body.head.set(t.x, t.y + .95, t.z); }
    return this.body;
  }
  private screen(point: Vector3, rect: DOMRect, out: Vector3): void {
    out.copy(point).project(this.camera);
    const z = out.z; out.set(rect.left + (out.x + 1) * rect.width / 2, rect.top + (1 - out.y) * rect.height / 2, z);
  }
}

function segment(x: number, y: number, a: Vector3, b: Vector3): number {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length > 1e-9 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length)) : 0;
  return Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
}
