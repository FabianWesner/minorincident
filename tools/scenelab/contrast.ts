import { existsSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

/** E31-AC16 navigation contrast: the lit route surface against the off-route ground, read from the presented canvas.
 * Samples sit on the authored route (from layouts/<district>/routes.json or `contrast.route`) and on the verge beside it
 * (`halfWidthM` + `vergeM`, default 1.5 m, from the centre line); each pair gives a ratio (hi + .02) / (lo + .02) of relative
 * luminance (see `flare`). The scene's value is the median pair over the visible route, so one dark corner cannot hide a black road. */
type Point = [number, number];
export interface ContrastSpec { district?: string; route?: Point[][]; halfWidthM?: number; vergeM?: number; stepM?: number; /** Building facade samples [x, z, height] compared with the verge ground. */ landmarks?: [number, number, number][] }
const lum = (r: number, g: number, b: number) => { const f = (c: number) => { const s = c / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
/** Luminance ratio with a viewing-flare offset. WCAG uses .05 (a bright office); the night scenes are judged with .02 (display black level plus room light), since .05 alone demands a daylight-bright road at 3:1. `wcag` keeps the .05 value in the report. */
export const flare = .02;
const ratio = (a: number, b: number, offset = flare) => (Math.max(a, b) + offset) / (Math.min(a, b) + offset);
/** Both sides at least this bright (a lamp or fire pool, sRGB ~ 66): plainly readable by brightness, not by contrast; the pair counts as the 3:1 target. */
export const litFloor = .06;
const pairRatio = (a: number, b: number, offset = flare) => Math.min(a, b) >= litFloor ? Math.max(ratio(a, b, offset), 3) : ratio(a, b, offset);
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };

/** Route polylines (world x, z) and their half width for a district. */
export function routesOf(c: ContrastSpec): { lines: Point[][]; halfWidthM: number } {
  if (c.route) return { lines: c.route, halfWidthM: c.halfWidthM ?? 4 };
  const file = `layouts/${c.district}/routes.json`;
  if (!existsSync(file)) throw new Error(`contrast: no routes for ${c.district}`);
  const d = JSON.parse(readFileSync(file, 'utf8')) as { regions?: { route: Point[] }[]; routes?: { id: string; width: number; points: Point[] }[] };
  if (d.regions) return { lines: d.regions.map(r => r.route), halfWidthM: c.halfWidthM ?? 4 };
  const road = d.routes?.find(r => r.id === 'road') ?? d.routes?.[0];
  if (!road) throw new Error(`contrast: ${file} has no routes`);
  return { lines: [road.points], halfWidthM: c.halfWidthM ?? road.width / 2 };
}

export interface ContrastSample { routeL: number; vergeL: number; ratio: number; wcag: number; at: Point }
export interface ContrastResult { candidates: number; pairs: number; median: number; /** Median pair with the WCAG .05 offset (report only). */ wcag: number; min: number; routeL: number; vergeL: number; player?: number; landmarks?: number; samples: ContrastSample[] }

/** Dense route sample set in world metres: [route x, z, unit normal x, z, verge side] per sample, both sides. */
export function samplePairs(c: ContrastSpec, bbox?: [Point, Point]): [number, number, number, number, number][] {
  const { lines } = routesOf(c), step = c.stepM ?? 2, pairs: [number, number, number, number, number][] = [];
  const inside = (x: number, z: number) => !bbox || (x >= bbox[0][0] && x <= bbox[1][0] && z >= bbox[0][1] && z <= bbox[1][1]);
  for (const line of lines) for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], d = Math.hypot(bx - ax, bz - az); if (d < 1e-6) continue;
    const nx = -(bz - az) / d, nz = (bx - ax) / d;
    for (let s = 1; s < d - .5; s += step) {
      const x = ax + (bx - ax) * s / d, z = az + (bz - az) * s / d;
      if (inside(x, z)) for (const side of [-1, 1]) pairs.push([x, z, nx, nz, side]);
    }
  }
  return pairs;
}

/** Measure at the current frame. Returns null when fewer than 3 samples are on screen (nothing to judge). */
export async function measureContrast(page: Page, spec: SceneSpec & { contrast?: ContrastSpec }): Promise<ContrastResult | null> {
  const c = spec.contrast!, bbox = spec.layout?.bbox as [Point, Point] | undefined;
  // A driven vehicle sits on the route at the screen centre: its hull is not road, so samples near it are skipped.
  const target = (spec.camera as { target?: unknown } | undefined)?.target, skipCentre = typeof target === 'string' && !!spec.vehicles?.some(v => v.id === target);
  const pairs = samplePairs(c, bbox), landmarks = c.landmarks ?? [], half = routesOf(c).halfWidthM, vergeM = c.vergeM ?? 1.5;
  const raw = await page.evaluate(async ({ pairs, landmarks, centre, half, vergeM, skipCentre }) => {
    // tsx wraps named arrows in __name(); the page has no such helper.
    (globalThis as { __name?: <T>(f: T) => T }).__name ??= f => f;
    await window.__SS__!.screenshotReady();
    const canvas = document.querySelector('canvas')!, copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(canvas, 0, 0);
    const sx = canvas.width / innerWidth, sy = canvas.height / innerHeight, R = 3;
    const patch = (p: [number, number, number]) => {
      const q = window.__SCENE__!.project(p), x = Math.round(q.x * sx), y = Math.round(q.y * sy);
      if (skipCentre && Math.hypot(x - copy.width / 2, (y - copy.height / 2) * 1.5) < copy.height * .3) return null;
      if (x < R + 8 || y < R + 8 || x >= copy.width - R - 8 || y >= copy.height - R - 8) return null;
      const d = ctx.getImageData(x - R, y - R, 2 * R + 1, 2 * R + 1).data; let r = 0, g = 0, b = 0; const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      return [r / n, g / n, b / n] as [number, number, number];
    };
    // The route cue is the whole carriageway: centre line, mid lane and both edges (markings and kerbs count in proportion).
    const across = [0, -.5, .5, -.9, .9], mean = (v: ([number, number, number] | null)[]) => { const ok = v.filter((q): q is [number, number, number] => !!q); return ok.length >= 2 ? [0, 1, 2].map(i => ok.reduce((a, q) => a + q[i], 0) / ok.length) as [number, number, number] : null; };
    // The verge is the nearest ground beside the edge that is on screen (1.5 m, 3 m, 4.5 m beyond it), so a close zoom still has one.
    const verge = (p: number[]) => { for (let k = 0; k < 3; k++) { const o = (half + vergeM + k * 1.5) * p[4]; const q = patch([p[0] + p[2] * o, 0, p[1] + p[3] * o]); if (q) return q; } return null; };
    const out = { pairs: pairs.map(p => ({ at: [p[0], p[1]], route: mean(across.map(t => patch([p[0] + p[2] * half * t, 0, p[1] + p[3] * half * t]))), verge: verge(p) })), landmarks: landmarks.map(p => patch([p[0], p[2], p[1]])), player: null as number[][] | null };
    if (centre) { const w = 48, d = ctx.getImageData(Math.round(copy.width / 2 - w / 2), Math.round(copy.height / 2 - w), w, w).data; const px: number[][] = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]); out.player = px; }
    return out;
  }, { pairs, landmarks, half, vergeM, skipCentre, centre: spec.camera?.mode === 'game' || spec.camera?.mode === 'follow' });
  const samples: ContrastSample[] = [];
  for (const p of raw.pairs) if (p.route && p.verge) { const a = lum(...p.route), b = lum(...p.verge); samples.push({ routeL: a, vergeL: b, ratio: pairRatio(a, b), wcag: pairRatio(a, b, .05), at: p.at as Point }); }
  if (samples.length < 3) return null;
  const vergeL = median(samples.map(s => s.vergeL)), result: ContrastResult = { candidates: pairs.length, pairs: samples.length, median: median(samples.map(s => s.ratio)), wcag: median(samples.map(s => s.wcag)), min: Math.min(...samples.map(s => s.ratio)), routeL: median(samples.map(s => s.routeL)), vergeL, samples };
  if (raw.player) { const l = raw.player.map(p => lum(p[0], p[1], p[2])).sort((a, b) => a - b); result.player = ratio(l[Math.floor(l.length * .9)], vergeL); }
  const marks = raw.landmarks.filter((p): p is [number, number, number] => !!p).map(p => ratio(lum(...p), vergeL));
  if (marks.length) result.landmarks = median(marks);
  return result;
}
