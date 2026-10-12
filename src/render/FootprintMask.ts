import type { WeatherSystem } from '../sim/weather/WeatherSystem';

export const TRACK_SIZE = 1024;
export const TRACK_SPAN = 16;
export const TRACK_HEIGHT = 16;
export const TRACK_LIFETIME = 3600;

/** Analytic sole/paw coverage, in foot-local metres (+X toes). No downloaded atlas. */
export function footprintCoverage(x: number, z: number, length: number, paw: boolean, side: number): number {
  const u = x / length, v = z / length * side;
  const ellipse = (cx: number, cz: number, rx: number, rz: number) => {
    const d = Math.hypot((u - cx) / rx, (v - cz) / rz);
    return Math.max(0, Math.min(1, (1.08 - d) / .16));
  };
  if (paw) {
    let mask = ellipse(-.16, 0, .26, .28);
    for (const [cx, cz] of [[.18, -.3], [.34, -.11], [.34, .11], [.18, .3]]) mask = Math.max(mask, ellipse(cx, cz, .13, .105));
    return mask;
  }
  // Separated rounded heel and broad asymmetric forefoot, with an inward arch.
  const heel = ellipse(-.32, 0, .16, .19);
  const toe = ellipse(.19, -.025, .3, .235);
  const arch = ellipse(-.08, -.045, .15, .14);
  const sole = Math.max(heel, toe, arch);
  // Shallow transverse tread grooves, kept much softer than the outline.
  const groove = Math.abs(Math.sin((u + .5) * Math.PI * 7));
  return sole * (.76 + .24 * Math.min(1, groove * 3));
}

// Two 64² Float32 masks (32 KiB total), generated once. Raster updates sample the
// atlas rather than evaluating ellipses/tread trigonometry for every track texel.
const ATLAS_SIZE = 64;
const atlas = [false, true].map(paw => Float32Array.from({ length: ATLAS_SIZE ** 2 }, (_, i) =>
  footprintCoverage(i % ATLAS_SIZE / (ATLAS_SIZE - 1) - .5, Math.floor(i / ATLAS_SIZE) / (ATLAS_SIZE - 1) - .5, 1, paw, 1)));
function sampleFootprint(x: number, z: number, length: number, paw: boolean, side: number): number {
  const u = (x / length + .5) * (ATLAS_SIZE - 1), v = (z / length * side + .5) * (ATLAS_SIZE - 1);
  if (u < 0 || v < 0 || u >= ATLAS_SIZE - 1 || v >= ATLAS_SIZE - 1) return 0;
  const ix = Math.floor(u), iz = Math.floor(v), fx = u - ix, fz = v - iz, a = atlas[Number(paw)], i = iz * ATLAS_SIZE + ix;
  const top = a[i] * (1 - fx) + a[i + 1] * fx, bottom = a[i + ATLAS_SIZE] * (1 - fx) + a[i + ATLAS_SIZE + 1] * fx;
  return top * (1 - fz) + bottom * fz;
}

/** Two height layers share the previous field's 4 MiB budget (RGBA8 instead of R32F).
 * The camera window is bounded, so prints cannot tile into other streets. */
export function rasterFootprints(data: Uint8Array, tracks: WeatherSystem['tracks'], tick: number, centerX: number, centerZ: number): number {
  data.fill(0);
  const size = Math.sqrt(data.length / 4), texel = TRACK_SPAN / size;
  let pixels = 0;
  for (const t of tracks) {
    const edge = TRACK_SPAN / 2 - Math.max(Math.abs(t.x - centerX), Math.abs(t.z - centerZ));
    const fade = Math.max(0, 1 - (tick - t.tick) / TRACK_LIFETIME) * Math.max(0, Math.min(1, edge / 1.5));
    if (!fade || t.y < 0 || t.y > TRACK_HEIGHT) continue;
    const cx = (t.x - centerX + TRACK_SPAN / 2) / texel, cz = (t.z - centerZ + TRACK_SPAN / 2) / texel;
    const radius = Math.ceil(t.length * .6 / texel) + 1, c = Math.cos(t.yaw), s = Math.sin(t.yaw);
    const height = Math.round(t.y / TRACK_HEIGHT * 255);
    for (let z = Math.max(0, Math.floor(cz) - radius); z <= Math.min(size - 1, Math.ceil(cz) + radius); z++) {
      for (let x = Math.max(0, Math.floor(cx) - radius); x <= Math.min(size - 1, Math.ceil(cx) + radius); x++) {
        const wx = (x + .25 - cx) * texel, wz = (z + .25 - cz) * texel;
        const u = c * wx - s * wz, v = s * wx + c * wz, half = texel * .5;
        const coverage = (sampleFootprint(u, v, t.length, t.paw, t.side)
          + sampleFootprint(u + c * half, v + s * half, t.length, t.paw, t.side)
          + sampleFootprint(u - s * half, v + c * half, t.length, t.paw, t.side)
          + sampleFootprint(u + (c - s) * half, v + (s + c) * half, t.length, t.paw, t.side)) / 4;
        const value = Math.round(coverage * fade * .65 * 255);
        const base = (z * size + x) * 4;
        // Ground and elevated support can both carry tracks at the same X/Z.
        const offset = base + (t.y > .4 ? 2 : 0);
        if (!data[offset]) data[offset + 1] = height;
        if (value > data[offset]) { if (!data[offset]) pixels++; data[offset] = value; data[offset + 1] = height; }
      }
    }
  }
  return pixels;
}
