import { Matrix4, Vector3 } from 'three';
import type { CrowdPosePalette } from './CrowdPosePalette';

/** World points of a drawn body: feet midpoint, hips, head centre (metres). */
export interface PickBody { feet: Vector3; hip: Vector3; head: Vector3 }

interface Entry { frame: number; instance: Matrix4; palette: CrowdPosePalette; pose: number; outgoing: number; weight: number }

/** The bodies the crowd renderers drew last frame, for click picking against what the player sees (not the sim
 * capsule): a lunging, hunched or lying infected is clicked where it is drawn. Recording copies one matrix per
 * figure; the rig joints are evaluated only when a click asks for them (the palette rows stay valid until the next
 * render, which runs after input sampling). */
export class PickBodies {
  private readonly entries = new Map<number, Entry>();
  private frame = 0;
  private readonly part = new Matrix4();
  private readonly world = new Matrix4();
  private readonly point = new Vector3();
  begin(): void { this.frame++; if (this.entries.size > 2048) this.entries.clear(); }
  add(id: number, instance: Matrix4, palette: CrowdPosePalette, pose: number, outgoing: number, weight: number): void {
    let entry = this.entries.get(id);
    if (!entry) { entry = { frame: 0, instance: new Matrix4(), palette, pose, outgoing, weight }; this.entries.set(id, entry); }
    entry.frame = this.frame; entry.instance.copy(instance); entry.palette = palette; entry.pose = pose; entry.outgoing = outgoing; entry.weight = weight;
  }
  /** The drawn body of `id` in the last rendered frame, or null when it was not drawn. */
  body(id: number, out: PickBody): PickBody | null {
    const entry = this.entries.get(id);
    if (!entry || entry.frame !== this.frame) return null;
    const parts = entry.palette.clip.parts, head = parts.indexOf('head'), hip = parts.indexOf('hip'), footL = parts.indexOf('footL'), footR = parts.indexOf('footR');
    if (head < 0 || hip < 0 || footL < 0 || footR < 0) return null;
    this.joint(entry, hip, out.hip); this.joint(entry, head, out.head);
    this.joint(entry, footL, out.feet); this.joint(entry, footR, this.point); out.feet.add(this.point).multiplyScalar(.5);
    // The head pivot is the neck: the visible head centre sits ~0.12 m further along the hip-to-head axis.
    this.point.subVectors(out.head, out.hip); const length = this.point.length();
    if (length > 1e-6) out.head.addScaledVector(this.point, .12 / length);
    return out;
  }
  private joint(entry: Entry, part: number, out: Vector3): void {
    entry.palette.part(entry.pose, entry.outgoing, entry.weight, part, this.part);
    out.setFromMatrixPosition(this.world.multiplyMatrices(entry.instance, this.part));
  }
}

/** One game view draws one crowd; the input system reads it on click. */
export const pickBodies = new PickBodies();
