import { cameraFraming } from '../../data/cameraFraming';
import { cure } from './district';

/** PO 10-30 "Wider L10 camera": at zoom 1 the follow camera spanned only about ±6 m across the road, so the verges, fields,
 * camps and burning cars stayed out of frame. The road regions R1–R5 use a wider base framing (player zoom scales from it);
 * the corridor (R6), the dispersal complex (R7: console, Mega arrival, finale) and close interactions keep the normal one. */
export const l10RoadFraming: { scale: number; fovDeg: number } = { scale: 1.3, fovDeg: cameraFraming.fovDeg };
/** Interactions framed close: the weapon checkpoints and the lab terminal/canister. Full width again beyond `far`. */
const interactions = ['cure-residential', 'cure-industrial', 'cure-military', 'cure-terminal', 'cure-canister'].map(name => cure.anchors[name]).filter(Boolean);
const near = 5, far = 16;
/** The wide framing ends over the R5 → R6 approach (research exit at x 2807, rocket pickup at x 2937). */
const wideUntil = 2860, normalFrom = 2925;
const smooth = (a: number, b: number, v: number): number => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 0 = normal framing, 1 = full road framing. Pure in position and mission flags; the view eases it over time. */
export function l10RoadWeight(x: number, z: number, finale: boolean): number {
  if (finale) return 0;
  let w = 1 - smooth(wideUntil, normalFrom, x);
  for (const [ax, az] of interactions) if (w > 0) w *= smooth(near, far, Math.hypot(x - ax, z - az));
  return w;
}

export function l10Framing(x: number, z: number, finale: boolean, wide = l10RoadFraming): { scale: number; fovDeg: number } {
  const w = l10RoadWeight(x, z, finale);
  return { scale: 1 + (wide.scale - 1) * w, fovDeg: cameraFraming.fovDeg + (wide.fovDeg - cameraFraming.fovDeg) * w };
}
