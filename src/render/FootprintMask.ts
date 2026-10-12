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

type Track = WeatherSystem['tracks'][number];
interface TrackStamp { size: number; cx: number; cz: number; yaw: number; length: number; paw: boolean; side: number; x0: number; z0: number; width: number; coverage: Float64Array }
// A footprint does not change shape while it fades. Retain its four-probe
// coverage while the snapped camera window stays put. Weak keys release stamps
// with expired tracks; the weather system retains at most 1024 tracks.
const stamps = new WeakMap<Track, TrackStamp>();
function trackStamp(t: Track, size: number, texel: number, cx: number, cz: number): TrackStamp {
  const cached = stamps.get(t);
  if (cached && cached.size === size && cached.cx === cx && cached.cz === cz && cached.yaw === t.yaw && cached.length === t.length && cached.paw === t.paw && cached.side === t.side) return cached;
  const radius = Math.ceil(t.length * .6 / texel) + 1, c = Math.cos(t.yaw), s = Math.sin(t.yaw), half = texel * .5;
  const x0 = Math.max(0, Math.floor(cx) - radius), z0 = Math.max(0, Math.floor(cz) - radius);
  const width = Math.max(0, Math.min(size - 1, Math.ceil(cx) + radius) - x0 + 1);
  const height = Math.max(0, Math.min(size - 1, Math.ceil(cz) + radius) - z0 + 1);
  const coverage = new Float64Array(width * height);
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    const wx = (x0 + x + .25 - cx) * texel, wz = (z0 + z + .25 - cz) * texel;
    const u = c * wx - s * wz, v = s * wx + c * wz;
    coverage[z * width + x] = (sampleFootprint(u, v, t.length, t.paw, t.side)
      + sampleFootprint(u + c * half, v + s * half, t.length, t.paw, t.side)
      + sampleFootprint(u - s * half, v + c * half, t.length, t.paw, t.side)
      + sampleFootprint(u + (c - s) * half, v + (s + c) * half, t.length, t.paw, t.side)) / 4;
  }
  const stamp = { size, cx, cz, yaw: t.yaw, length: t.length, paw: t.paw, side: t.side, x0, z0, width, coverage };
  stamps.set(t, stamp); return stamp;
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
    const stamp = trackStamp(t, size, texel, cx, cz), height = Math.round(t.y / TRACK_HEIGHT * 255);
    let i = 0;
    for (let z = stamp.z0; i < stamp.coverage.length; z++) {
      let base = (z * size + stamp.x0) * 4;
      for (let x = 0; x < stamp.width; x++, i++, base += 4) {
        const value = Math.round(stamp.coverage[i] * fade * .65 * 255);
        // Ground and elevated support can both carry tracks at the same X/Z.
        const offset = base + (t.y > .4 ? 2 : 0);
        if (!data[offset]) data[offset + 1] = height;
        if (value > data[offset]) { if (!data[offset]) pixels++; data[offset] = value; data[offset + 1] = height; }
      }
    }
  }
  return pixels;
}
