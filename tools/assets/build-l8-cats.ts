/**
 * r36-lion: assemble the lion / lioness GLBs from the Blender big-cat meshes (assets/amb.lion/build_cat.py).
 *
 * Keeps everything of the SHIPPED GLBs except the body surface: same skeleton and bind pose, skin joint order, stump caps,
 * node names, materials and eye quads (re-seated on the new face). Replaces skin_body (positions, normals, UVs, joints,
 * weights, part ids, indices) and the atlas (palette gradient strips). Then compresses with the production crowd codec.
 *
 *   python3 tools/blender/run.py assets/amb.lion/build_cat.py --out <dir>
 *   BASIS=<pipeline>/vendor/basis-encoder-2.1 node --import tsx tools/assets/build-l8-cats.ts <dir>
 *   node --import tsx tools/assets/bake-l8-cats.ts      (bakes + civilianBakes.json)
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import type { Document } from '@gltf-transform/core';
import { assetIO } from './io';
import { compressSkin } from './skin-crowd-compress';

const dir = resolve(process.argv[2] ?? ''), basis = process.env.BASIS ?? resolve('../minorincident_3dpipeline/vendor/basis-encoder-2.1');
const io = await assetIO();
const SIZE = 512, CELL_W = 256, CELL_H = 32, SWATCHES = ['coat', 'cream', 'mane', 'dark', 'tooth', 'tuft', 'ear', 'pad', 'wound', 'earIn'];
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function atlas(palette: Record<string, string[]>): Buffer {
  const png = new PNG({ width: SIZE, height: SIZE });
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const col = Math.floor(x / CELL_W), row = Math.floor(y / CELL_H), name = SWATCHES[row * 2 + col] ?? 'dark', stops = palette[name].map(hex);
    const t = Math.max(0, Math.min(1, ((x % CELL_W) - 2) / (CELL_W - 4))) * (stops.length - 1), k = Math.min(Math.floor(t), stops.length - 2), f = t - k, o = (y * SIZE + x) * 4;
    for (let c = 0; c < 3; c++) png.data[o + c] = Math.round(stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f);
    png.data[o + 3] = 255;
  }
  return PNG.sync.write(png);
}

interface Eye { p: number[]; n: number[] }
interface CatData { P: number[][]; N: number[][]; S: string[]; T: number[]; B: [string, number][][]; I: number[]; eyes: Eye[]; palette: Record<string, Record<string, string[]>> }

function cross(a: number[], b: number[]) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
const unit = (a: number[]) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function replaceBody(d: Document, cat: CatData, infected: boolean): void {
  const root = d.getRoot(), buffer = root.listBuffers()[0];
  const bodyNode = root.listNodes().find(n => n.getName() === 'skin_body')!, prim = bodyNode.getMesh()!.listPrimitives()[0];
  const joints = bodyNode.getSkin()!.listJoints().map(j => j.getName()), index = new Map(joints.map((n, i) => [n, i]));
  const count = cat.P.length;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), jnt = new Uint16Array(count * 4), wgt = new Float32Array(count * 4), part = new Uint16Array(count);
  for (let i = 0; i < count; i++) {
    pos.set(cat.P[i], i * 3); nor.set(cat.N[i], i * 3);
    const sw = SWATCHES.indexOf(cat.S[i]); if (sw < 0) throw Error(`unknown swatch ${cat.S[i]}`);
    const col = sw % 2, row = Math.floor(sw / 2);
    uv[i * 2] = (col * CELL_W + 2 + cat.T[i] * (CELL_W - 4)) / SIZE; uv[i * 2 + 1] = (row * CELL_H + CELL_H / 2) / SIZE;
    const ws = [...cat.B[i]].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = ws.reduce((s, w) => s + w[1], 0);
    ws.forEach(([name, w], k) => { const j = index.get(name); if (j === undefined) throw Error(`missing joint ${name}`); jnt[i * 4 + k] = j; wgt[i * 4 + k] = w / sum; });
    part[i] = jnt[i * 4];
  }
  const acc = (type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4', array: Float32Array | Uint16Array) => d.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const old = new Set(prim.listSemantics().map(s => prim.getAttribute(s)!));
  prim.setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', nor)).setAttribute('TEXCOORD_0', acc('VEC2', uv))
    .setAttribute('JOINTS_0', acc('VEC4', jnt)).setAttribute('WEIGHTS_0', acc('VEC4', wgt)).setAttribute('_CROWD_PART', acc('SCALAR', part));
  prim.setIndices(acc('SCALAR', Uint16Array.from(cat.I)));
  for (const a of old) if (!a.listParents().some(p => p.propertyType !== 'Root')) a.dispose();
  // the atlas
  const tex = prim.getMaterial()!.getBaseColorTexture()!;
  tex.setImage(new Uint8Array(atlas(cat.palette[String(infected)]))).setMimeType('image/png').setURI('');
}

function reseatEyes(d: Document, cat: CatData): void {
  const root = d.getRoot(), prim = root.listNodes().find(n => n.getName() === 'skin_eyes')!.getMesh()!.listPrimitives()[0];
  const position = prim.getAttribute('POSITION')!, h = .02;
  // Two template quads of 4 vertices in the order (up-lo, side-lo), (up-hi, side-lo), (up-hi, side-hi), (up-lo, side-hi); quad 0 is +z.
  const cu = [-1, 1, 1, -1], cs = [-1, -1, 1, 1];
  for (const q of [0, 1]) {
    const eye = cat.eyes[q], n = unit(eye.n), dotY = n[1];
    const up = unit([-n[0] * dotY, 1 - n[1] * dotY, -n[2] * dotY]), side = cross(n, up), at = eye.p.map((v, i) => v + n[i] * .006);
    for (let k = 0; k < 4; k++) position.setElement(q * 4 + k, at.map((v, i) => v + up[i] * h * cu[k] + side[i] * h * cs[k]) as [number, number, number]);
  }
}

for (const species of ['lion', 'lioness']) for (const infected of [false, true]) {
  const id = `${infected ? 'inf' : 'amb'}.${species}`;
  for (const lod of [0, 1, 2]) {
    const cat = JSON.parse(readFileSync(join(dir, `cat.${species}.lod${lod}.json`), 'utf8')) as CatData;
    const out = `public/assets/models/skinned/${id}.lod${lod}.glb`;
    // Template = the pre-r36 GLB (skeleton, stump caps, eye quads). It is copied to <dir>/templates on the first run so a
    // rebuild never starts from its own output (restore the originals from version control before a first run).
    mkdirSync(join(dir, 'templates'), { recursive: true });
    const template = join(dir, 'templates', `${id}.lod${lod}.glb`);
    if (!existsSync(template)) copyFileSync(out, template);
    const d = await io.read(template);
    replaceBody(d, cat, infected); reseatEyes(d, cat);
    const work = mkdtempSync(join(tmpdir(), 'l8cats-')), tmp = join(work, 'in.glb');
    try {
      await io.write(tmp, d);
      await compressSkin(tmp, out, basis, SIZE);
    } finally { rmSync(work, { recursive: true, force: true }); }
    if (lod === 0) copyFileSync(out, out.replace('.lod0.glb', '.lod0.low.glb'));
    else copyFileSync(out, out.replace(`.lod${lod}.glb`, `.lod${lod}.low.glb`));
    console.log(id, `lod${lod}`, 'tris', cat.I.length / 3);
  }
}
