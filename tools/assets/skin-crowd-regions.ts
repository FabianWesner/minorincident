/** Crowd texture regions (crowd-texture-quality): per-texel classes in the atlas alpha plus build-time flattening.
 * Hair, skin, shirt and trousers are found per body part from the TRELLIS paint, cleaned of mottling, and their mean
 * luminance is moved to the shader's reference so a per-person tint (src/render/characters/crowdRegions.ts) can
 * replace the hue while keeping the paint's own shading. Uniforms keep their colours: only skin is tagged, for the
 * infection mask. Usage (diagnosis): node --import tsx tools/assets/skin-crowd-regions.ts <raw.glb> <out-prefix> [--garments] */
import type { Document } from '@gltf-transform/core';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { crowdRegion, crowdRegionLuminance } from '../../src/render/characters/crowdRegionData';

type Lab = [number, number, number];
const toLinear = (c: number) => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
const toSrgb = (c: number) => Math.round(255 * Math.max(0, Math.min(1, c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055)));
const LINEAR = Float64Array.from({ length: 256 }, (_, i) => toLinear(i));
function lab(r: number, g: number, b: number): Lab {
  const R = LINEAR[r], G = LINEAR[g], B = LINEAR[b];
  const f = (t: number) => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const x = f((.4124 * R + .3576 * G + .1805 * B) / .95047), y = f(.2126 * R + .7152 * G + .0722 * B), z = f((.0193 * R + .1192 * G + .9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dE = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const luminance = (r: number, g: number, b: number) => .2126 * LINEAR[r] + .7152 * LINEAR[g] + .0722 * LINEAR[b];

const GROUP: Record<string, 'head' | 'upper' | 'lower' | 'hand' | 'foot'> = {
  head: 'head', torso: 'upper', armL: 'upper', armR: 'upper', foreArmL: 'upper', foreArmR: 'upper', hip: 'lower',
  legL: 'lower', legR: 'lower', shinL: 'lower', shinR: 'lower', handL: 'hand', handR: 'hand', footL: 'foot', footR: 'foot', root: 'upper',
};

export interface RegionReport { width: number; height: number; garments: boolean; shares: Record<string, number>; absorbed: number; colours: Record<string, number[]> }

/** Classify and flatten the body atlas of a raw crowd figure in place (PNG source atlas expected). */
export function classifyCrowdAtlas(doc: Document, garments: boolean): RegionReport | undefined {
  const body = doc.getRoot().listNodes().find(n => n.getName() === 'skin_body'), prim = body?.getMesh()?.listPrimitives()[0];
  const map = prim?.getMaterial()?.getBaseColorTexture();
  if (!prim || !map || map.getMimeType() !== 'image/png') return undefined;
  const joints = body!.getSkin()!.listJoints().map(j => j.getName());
  const uv = prim.getAttribute('TEXCOORD_0')!, part = prim.getAttribute('_CROWD_PART')!, region = prim.getAttribute('_CROWD_REGION'), indices = prim.getIndices();
  const count = indices?.getCount() ?? uv.getCount(), vertex = (t: number) => indices ? indices.getScalar(t) : t;
  const png = decodePng(map.getImage()!), { width: w, height: h, data } = png;
  // 0 none, 1 head, 2 upper, 3 lower, 4 hand, 5 foot; skinTri marks triangles whose corners were all tagged as skin paint.
  const groups = ['none', 'head', 'upper', 'lower', 'hand', 'foot'] as const;
  const owner = new Uint8Array(w * h), skinSeed = new Uint8Array(w * h);
  // Face band: below the brows and in front of the eyes, painted frames, pupils and beards are never hair.
  const eyes = doc.getRoot().listNodes().find(n => n.getName() === 'skin_eyes')?.getMesh()?.listPrimitives()[0]?.getAttribute('POSITION');
  const position = prim.getAttribute('POSITION')!, eye = [0, 0, 0];
  if (eyes) { for (let i = 0; i < eyes.getCount(); i++) { const q = eyes.getElement(i, []); for (let c = 0; c < 3; c++) eye[c] += q[c] / eyes.getCount(); } }
  const face = new Uint8Array(w * h);
  const p: number[][] = [[0, 0], [0, 0], [0, 0]];
  for (let t = 0; t < count; t += 3) {
    const v = [vertex(t), vertex(t + 1), vertex(t + 2)];
    const names = v.map(i => joints[part.getScalar(i)] ?? 'torso');
    const name = names[0] === names[1] || names[0] === names[2] ? names[0] : names[1];
    const g = groups.indexOf(GROUP[name] ?? 'upper') as number, skin = !!region && v.every(i => Math.abs(region.getScalar(i) - 1) < .01);
    const centre = v.map(i => position.getElement(i, [])).reduce((a, q) => a.map((n, c) => n + q[c] / 3), [0, 0, 0]);
    const inFace = !!eyes && g === 1 && centre[1] < eye[1] + .045 && centre[0] > eye[0] - .05;
    for (let k = 0; k < 3; k++) { p[k][0] = uv.getElement(v[k], [])[0] * w - .5; p[k][1] = uv.getElement(v[k], [])[1] * h - .5; }
    const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      // Conservative coverage (half-texel slack), so the bilinear footprint of every island edge is classified.
      const e = [0, 1, 2].map(k => { const a = p[k], b = p[(k + 1) % 3]; return ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / area; });
      const lengths = [0, 1, 2].map(k => Math.hypot(p[(k + 1) % 3][0] - p[k][0], p[(k + 1) % 3][1] - p[k][1]) / Math.abs(area));
      if (e.every((s, k) => s >= -.75 * lengths[k])) { owner[y * w + x] = g; if (skin) skinSeed[y * w + x] = 1; if (inFace) face[y * w + x] = 1; }
    }
  }
  const labs = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) if (owner[i]) { const c = lab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]); labs.set(c, i * 3); }
  const at = (i: number): Lab => [labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2]];
  // Dominant colour of a texel set: the fullest 6-unit Lab bin, refined to the mean of everything within 12 units.
  const dominant = (pick: (i: number) => boolean): { colour: Lab; share: number } | undefined => {
    const bins = new Map<number, number>(); let total = 0;
    for (let i = 0; i < w * h; i++) if (owner[i] && pick(i)) { total++; const key = Math.floor(labs[i * 3] / 6) * 1e6 + Math.floor(labs[i * 3 + 1] / 6 + 50) * 1e3 + Math.floor(labs[i * 3 + 2] / 6 + 50); bins.set(key, (bins.get(key) ?? 0) + 1); }
    if (total < 64) return undefined;
    // Neighbouring bins vote together; a soft gradient otherwise splits its mass.
    let best = -1, bestKey = 0;
    for (const key of bins.keys()) {
      const L = Math.floor(key / 1e6), A = Math.floor(key / 1e3) % 1e3, B = key % 1e3; let votes = 0;
      for (let dl = -1; dl <= 1; dl++) for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) votes += bins.get((L + dl) * 1e6 + (A + da) * 1e3 + B + db) ?? 0;
      if (votes > best) { best = votes; bestKey = key; }
    }
    let colour: Lab = [(Math.floor(bestKey / 1e6) + .5) * 6, (Math.floor(bestKey / 1e3) % 1e3 - 50 + .5) * 6, (bestKey % 1e3 - 50 + .5) * 6];
    for (let pass = 0; pass < 3; pass++) {
      const sum = [0, 0, 0]; let n = 0;
      for (let i = 0; i < w * h; i++) if (owner[i] && pick(i) && dE(at(i), colour) < 12) { sum[0] += labs[i * 3]; sum[1] += labs[i * 3 + 1]; sum[2] += labs[i * 3 + 2]; n++; }
      if (!n) break; colour = [sum[0] / n, sum[1] / n, sum[2] / n];
    }
    let near = 0; for (let i = 0; i < w * h; i++) if (owner[i] && pick(i) && dE(at(i), colour) < 16) near++;
    return { colour, share: near / total };
  };
  const cls = new Uint8Array(w * h).fill(crowdRegion.authored);
  const skin = dominant(i => skinSeed[i] === 1) ?? dominant(i => owner[i] === 4);
  const colours: Record<string, Lab> = {};
  if (skin) {
    colours.skin = skin.colour;
    for (let i = 0; i < w * h; i++) if (owner[i] && dE(at(i), skin.colour) < (owner[i] === 1 || owner[i] === 4 ? 14 : 10)) cls[i] = garments ? crowdRegion.skin : crowdRegion.skinMask;
  }
  if (garments) {
    const free = (i: number) => cls[i] === crowdRegion.authored;
    const assign = (name: string, value: number, where: (i: number) => boolean, tolerance: number, minShare: number) => {
      const found = dominant(i => where(i) && free(i)); if (!found || found.share < minShare) return undefined;
      colours[name] = found.colour;
      for (let i = 0; i < w * h; i++) if (owner[i] && where(i) && free(i) && dE(at(i), found.colour) < tolerance) cls[i] = value;
      return found.colour;
    };
    // Painted frames, brows and pupils are darker than the hair mass and stay authored.
    const hair = dominant(i => owner[i] === 1 && free(i));
    if (hair && hair.share >= .3) assign('hair', crowdRegion.hair, i => owner[i] === 1 && !face[i] && labs[i * 3] > hair.colour[0] - 9, 15, .3);
    const shirt = assign('shirt', crowdRegion.shirt, i => owner[i] === 2, 18, .3);
    // A dress continues the shirt over the legs; otherwise the lower body's own dominant colour is the trousers.
    if (shirt) for (let i = 0; i < w * h; i++) if (owner[i] === 3 && free(i) && dE(at(i), shirt) < 14) cls[i] = crowdRegion.shirt;
    assign('trousers', crowdRegion.trousers, i => owner[i] === 3, 18, .3);
  }
  // Mottling: small authored specks enclosed by one region join it (glasses, eyes, prints and straps stay: they differ strongly or are large).
  let absorbed = 0;
  for (let pass = 0; pass < 2; pass++) {
    const next = cls.slice();
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      const i = y * w + x; if (!owner[i] || cls[i] !== crowdRegion.authored) continue;
      const counts = new Map<number, number>(); let n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = i + dy * w + dx; if (!owner[j]) continue; n++; counts.set(cls[j], (counts.get(cls[j]) ?? 0) + 1); }
      let best: number = crowdRegion.authored, votes = 0; for (const [c, v] of counts) if (c !== crowdRegion.authored && v > votes) { best = c; votes = v; }
      const name = Object.entries(crowdRegion).find(([, v]) => v === best)?.[0] ?? '', reference = colours[name === 'skinMask' ? 'skin' : name];
      if (!reference || votes < n * (best === crowdRegion.shirt || best === crowdRegion.trousers ? .6 : .72)) continue;
      if (dE(at(i), reference) < (best === crowdRegion.shirt || best === crowdRegion.trousers ? 42 : 26)) { next[i] = best; absorbed++; }
    }
    cls.set(next);
  }
  // Bake bleed: an enclosed authored patch that carries another region's paint (or nearly its own) joins its surround.
  // Features keep their own colours (red lanyard, black frames, badge) and survive; so do patches touching two regions.
  const seen = new Uint8Array(w * h), stack: number[] = [];
  const regionColour = (c: number) => colours[Object.entries(crowdRegion).find(([, v]) => v === c)?.[0] === 'skinMask' ? 'skin' : Object.entries(crowdRegion).find(([, v]) => v === c)?.[0] ?? ''];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !owner[start] || cls[start] !== crowdRegion.authored) continue;
    const members: number[] = [], border = new Map<number, number>(); let edge = 0; const mean = [0, 0, 0];
    seen[start] = 1; stack.push(start);
    while (stack.length) {
      const i = stack.pop()!; members.push(i); for (let c = 0; c < 3; c++) mean[c] += labs[i * 3 + c];
      const x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || !owner[j]) continue;
        if (cls[j] === crowdRegion.authored && owner[j] === owner[start]) { if (!seen[j]) { seen[j] = 1; stack.push(j); } }
        else if (cls[j] !== crowdRegion.authored) { edge++; border.set(cls[j], (border.get(cls[j]) ?? 0) + 1); }
      }
    }
    if (!edge) continue;
    const [surround, votes] = [...border].sort((a, b) => b[1] - a[1])[0], reference = regionColour(surround);
    if (!reference || votes < edge * .8 || members.length > 6000 * w * h / (1024 * 1024)) continue;
    const colour: Lab = [mean[0] / members.length, mean[1] / members.length, mean[2] / members.length];
    const bleed = Object.entries(colours).some(([name, c]) => name !== (Object.entries(crowdRegion).find(([, v]) => v === surround)?.[0]) && dE(colour, c) < 22);
    if (!bleed && dE(colour, reference) >= 42) continue;
    for (const i of members) cls[i] = surround;
    absorbed += members.length;
  }
  // Flatten each region to its own hue, keeping a third of the paint's lightness variation (toy masses, not TRELLIS noise); garments move to the tint reference.
  const shares: Record<string, number> = {};
  for (const [name, value] of Object.entries(crowdRegion)) {
    let n = 0, mean = 0;
    for (let i = 0; i < w * h; i++) if (owner[i] && cls[i] === value) { n++; mean += labs[i * 3]; }
    shares[name] = n;
    const reference = colours[name === 'skinMask' ? 'skin' : name];
    if (!n || !reference || value === crowdRegion.authored) continue;
    mean /= n;
    const target = crowdRegionLuminance[name as keyof typeof crowdRegionLuminance];
    for (let i = 0; i < w * h; i++) if (owner[i] && cls[i] === value) {
      const L = reference[0] + Math.max(-8, Math.min(8, (labs[i * 3] - mean) * .3));
      const rgb = labToSrgb([L, reference[1], reference[2]]);
      const scale = target && garments ? target / Math.max(1e-4, luminance(...labToSrgb(reference))) : 1;
      for (let c = 0; c < 3; c++) data[i * 4 + c] = toSrgb(LINEAR[rgb[c]] * scale);
    }
  }
  // Ragged single-texel class noise along region borders: a texel outvoted 6:2 by one neighbouring class joins it.
  {
    const next = cls.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (!owner[i]) continue;
      const votes = new Map<number, number>();
      for (const j of [i - w - 1, i - w, i - w + 1, i - 1, i + 1, i + w - 1, i + w, i + w + 1]) if (owner[j]) votes.set(cls[j], (votes.get(cls[j]) ?? 0) + 1);
      for (const [c, v] of votes) if (c !== cls[i] && v >= 6) { next[i] = c; break; }
    }
    cls.set(next);
  }
  // Gutters take their nearest island's class: whole 4x4 blocks then carry one value, which keeps the alpha slice small.
  const out = cls.slice(), queue: number[] = [];
  for (let i = 0; i < w * h; i++) if (owner[i]) queue.push(i);
  const filled = owner.map(v => v ? 1 : 0);
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head], x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && !filled[j]) { filled[j] = 1; out[j] = out[i]; queue.push(j); }
  }
  // ETC1S pays per distinct block pattern: classes are written per CELL x CELL cell (majority, ties to the tinted class).
  const cell = Number(process.env.CROWD_REGION_CELL ?? 4);
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    const votes = new Map<number, number>();
    for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) { const c = out[(y + dy) * w + x + dx]; votes.set(c, (votes.get(c) ?? 0) + (owner[(y + dy) * w + x + dx] ? 4 : 1) + (c === crowdRegion.authored ? 0 : .5)); }
    const value = [...votes].sort((a, b) => b[1] - a[1])[0][0];
    for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) data[((y + dy) * w + x + dx) * 4 + 3] = Math.round((value + 1) * 255 / 7);
  }
  // Gear (props) shares the body's atlas; every copy of the source image takes the classed one.
  const original = Buffer.from(map.getImage()!), classed = new Uint8Array(PNG.sync.write(png));
  for (const texture of doc.getRoot().listTextures()) if (texture === map || Buffer.from(texture.getImage() ?? []).equals(original)) texture.setImage(classed).setMimeType('image/png');
  const total = Object.values(shares).reduce((a, b) => a + b, 0) || 1;
  return { width: w, height: h, garments, absorbed, shares: Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, +(v / total).toFixed(4)])), colours: Object.fromEntries(Object.entries(colours).map(([k, v]) => [k, v.map(n => +n.toFixed(1))])) };
}
/** Some L1 sources carry PNG bytes pngjs rejects; CoreGraphics reads them (opaque, so its premultiplication is harmless). */
function decodePng(image: Uint8Array): PNG {
  try { return PNG.sync.read(Buffer.from(image)); } catch {
    const directory = mkdtempSync(join(tmpdir(), 'crowd-regions-')), path = join(directory, 'atlas.png');
    try { writeFileSync(path, image); execFileSync('sips', ['-s', 'format', 'png', path, '--out', join(directory, 'out.png')], { stdio: 'ignore' }); return PNG.sync.read(readFileSync(join(directory, 'out.png'))); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
}
function labToSrgb([L, A, B]: Lab): [number, number, number] {
  const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
  const inv = (t: number) => t ** 3 > .008856 ? t ** 3 : (t - 16 / 116) / 7.787;
  const X = inv(fx) * .95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const R = 3.2406 * X - 1.5372 * Y - .4986 * Z, G = -.9689 * X + 1.8758 * Y + .0415 * Z, Bl = .0557 * X - .204 * Y + 1.057 * Z;
  return [toSrgb(R), toSrgb(G), toSrgb(Bl)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { assetIO } = await import('./io');
  const [input, prefix] = process.argv.slice(2), doc = await (await assetIO()).read(input);
  const report = classifyCrowdAtlas(doc, process.argv.includes('--garments'));
  console.log(JSON.stringify(report));
  const map = doc.getRoot().listNodes().find(n => n.getName() === 'skin_body')!.getMesh()!.listPrimitives()[0].getMaterial()!.getBaseColorTexture()!;
  const png = PNG.sync.read(Buffer.from(map.getImage()!)), rgb = new PNG({ width: png.width, height: png.height }), classes = new PNG({ width: png.width, height: png.height });
  const palette = [[200, 120, 40], [255, 200, 170], [80, 140, 255], [40, 60, 120], [255, 120, 200], [0, 0, 0], [40, 40, 40]];
  for (let i = 0; i < png.width * png.height; i++) {
    for (let c = 0; c < 3; c++) rgb.data[i * 4 + c] = png.data[i * 4 + c]; rgb.data[i * 4 + 3] = 255;
    const k = Math.round(png.data[i * 4 + 3] * 7 / 255) - 1; for (let c = 0; c < 3; c++) classes.data[i * 4 + c] = palette[k][c]; classes.data[i * 4 + 3] = 255;
  }
  writeFileSync(`${prefix}.rgb.png`, PNG.sync.write(rgb)); writeFileSync(`${prefix}.classes.png`, PNG.sync.write(classes));
}
