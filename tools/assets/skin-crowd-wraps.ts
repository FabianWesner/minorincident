/** Paint medical dressings on the continuous limb surface, so they cannot float in motion. */
import type { Document } from '@gltf-transform/core';
import { PNG } from 'pngjs';
import { Vector3 } from 'three';
import { crowdRegion } from '../../src/render/characters/crowdRegionData';
import { classifyCrowdAtlas } from './skin-crowd-regions';

export interface CrowdWrap { joint: string; colour: string; stain?: boolean }
const END: Record<string, string> = { armL: 'foreArmL', armR: 'foreArmR', foreArmL: 'handL', foreArmR: 'handR', shinL: 'footL', shinR: 'footR' };
const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));

/** Derive an authored shirt colour from the source's measured garment mask. */
export function paintCrowdShirt(document: Document, colour: string): number {
  const texture = document.getRoot().listNodes().find(n => n.getName() === 'skin_body')!.getMesh()!.listPrimitives()[0].getMaterial()!.getBaseColorTexture()!;
  const original = PNG.sync.read(Buffer.from(texture.getImage()!));
  classifyCrowdAtlas(document, true);
  const mask = PNG.sync.read(Buffer.from(texture.getImage()!)), target = rgb(colour);
  let painted = 0;
  for (let i = 0; i < mask.data.length; i += 4) if (Math.round(mask.data[i + 3] / 255 * 7) - 1 === crowdRegion.shirt) {
    const shade = Math.max(.75, Math.min(1.1, (mask.data[i] + mask.data[i + 1] + mask.data[i + 2]) / 420));
    for (let c = 0; c < 3; c++) original.data[i + c] = Math.min(255, Math.round(target[c] * shade));
    painted++;
  }
  if (painted < 64) throw Error('Authored shirt mask disappeared');
  texture.setImage(PNG.sync.write(original));
  return painted;
}

export function paintCrowdWraps(document: Document, recipes: CrowdWrap[]): { joint: string; paintedTexels: number }[] {
  const node = document.getRoot().listNodes().find(n => n.getName() === 'skin_body')!;
  const primitive = node.getMesh()!.listPrimitives()[0], texture = primitive.getMaterial()!.getBaseColorTexture()!;
  if (texture.getMimeType() !== 'image/png') throw Error('Crowd dressings require the pre-compression PNG atlas');
  const png = PNG.sync.read(Buffer.from(texture.getImage()!));
  const position = primitive.getAttribute('POSITION')!, uv = primitive.getAttribute('TEXCOORD_0')!;
  const indices = primitive.getIndices(), joints = node.getSkin()!.listJoints();
  // Reserve actual triangle interiors before adding any texture padding. Only
  // empty gutters may borrow paint; adjacent UV islands own their own surface.
  const owner = new Int32Array(png.width * png.height).fill(-1);
  for (let t = 0; t < (indices?.getCount() ?? position.getCount()); t += 3) {
    const u = [0, 1, 2].map(k => uv.getElement(indices ? indices.getScalar(t + k) : t + k, []).map((n, c) => n * (c ? png.height : png.width) - .5));
    const area = (u[1][0] - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (u[1][1] - u[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = Math.max(0, Math.ceil(Math.min(...u.map(v => v[1])))); y <= Math.min(png.height - 1, Math.floor(Math.max(...u.map(v => v[1])))); y++) {
      for (let x = Math.max(0, Math.ceil(Math.min(...u.map(v => v[0])))); x <= Math.min(png.width - 1, Math.floor(Math.max(...u.map(v => v[0])))); x++) {
        const w1 = ((x - u[0][0]) * (u[2][1] - u[0][1]) - (y - u[0][1]) * (u[2][0] - u[0][0])) / area;
        const w2 = ((u[1][0] - u[0][0]) * (y - u[0][1]) - (u[1][1] - u[0][1]) * (x - u[0][0])) / area;
        if (Math.min(1 - w1 - w2, w1, w2) >= -1e-6) owner[y * png.width + x] = t;
      }
    }
  }
  const receipts = [];
  for (const recipe of recipes) {
    const headband = recipe.joint === 'head';
    const start = joints.find(j => j.getName() === recipe.joint), end = joints.find(j => j.getName() === END[recipe.joint]);
    if (!start || !end && !headband) throw Error(`Unknown dressing limb ${recipe.joint}`);
    const a = new Vector3().fromArray(start.getWorldMatrix(), 12), axis = headband ? new Vector3(0, .06, 0) : new Vector3().fromArray(end!.getWorldMatrix(), 12).sub(a);
    if (headband) {
      const eyes = document.getRoot().listNodes().find(n => n.getName() === 'skin_eyes')?.getMesh()?.listPrimitives()[0].getAttribute('POSITION');
      if (!eyes) throw Error('Head dressing requires measured eye landmarks');
      a.y = eyes.getMax([])[1] + .006;
    }
    const length = axis.length(), colour = rgb(recipe.colour), marked = new Set<number>();
    if (length < .01) throw Error(`Degenerate dressing limb ${recipe.joint}`);
    for (let t = 0; t < (indices?.getCount() ?? position.getCount()); t += 3) {
      const vertices = [0, 1, 2].map(k => indices ? indices.getScalar(t + k) : t + k);
      if (headband && !vertices.every(i => joints[primitive.getAttribute('_CROWD_PART')!.getScalar(i)]?.getName() === 'head')) continue;
      const p = vertices.map(i => new Vector3().fromArray(position.getElement(i, [])));
      const u = vertices.map(i => uv.getElement(i, []).map((n, c) => n * (c ? png.height : png.width) - .5));
      const area = (u[1][0] - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (u[1][1] - u[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      const low = [0, 1].map(c => Math.max(0, Math.floor(Math.min(...u.map(v => v[c]))) - 2));
      const high = [0, 1].map(c => Math.min((c ? png.height : png.width) - 1, Math.ceil(Math.max(...u.map(v => v[c]))) + 2));
      for (let y = low[1]; y <= high[1]; y++) for (let x = low[0]; x <= high[0]; x++) {
        const pixel = y * png.width + x;
        if (owner[pixel] !== -1 && owner[pixel] !== t) continue;
        const w1 = ((x - u[0][0]) * (u[2][1] - u[0][1]) - (y - u[0][1]) * (u[2][0] - u[0][0])) / area;
        const w2 = ((u[1][0] - u[0][0]) * (y - u[0][1]) - (u[1][1] - u[0][1]) * (x - u[0][0])) / area, w0 = 1 - w1 - w2;
        // At most 1.5 texels of padding per edge, and only into empty gutters.
        // A shared barycentric slack grows without bound on sliver triangles.
        const weights = [w0, w1, w2];
        if (weights.some((w, k) => w * Math.abs(area) < -1.5 * Math.hypot(u[(k + 1) % 3][0] - u[(k + 2) % 3][0], u[(k + 1) % 3][1] - u[(k + 2) % 3][1]))) continue;
        const point = p[0].clone().multiplyScalar(w0).addScaledVector(p[1], w1).addScaledVector(p[2], w2), offset = point.clone().sub(a);
        const along = offset.dot(axis) / (length * length);
        // A head dressing covers the crown above its brow wrap. A thin stripe
        // across the source's lumpy hair reads as a disconnected halo from the
        // steep game camera, even with correct non-emissive cloth shading.
        if (along < .23 || !headband && (along > .77 || offset.clone().addScaledVector(axis, -along).length() > length * .55)) continue;
        const stain = recipe.stain && Math.abs(along - .54) < .11 && offset.x > .015 && (!headband || offset.z > .035 && offset.z < .11);
        // Limb folds repeat over a short wrap. Extending that oscillation over
        // the whole crown makes contour rings instead of broad matte gauze.
        const shade = headband ? .98 : 1 - .045 * Math.cos(along * Math.PI * 22);
        for (let c = 0; c < 3; c++) png.data[pixel * 4 + c] = Math.round((stain ? [184, 113, 101][c] : colour[c]) * shade);
        png.data[pixel * 4 + 3] = Math.round((crowdRegion.authored + 1) / 7 * 255); marked.add(pixel);
      }
    }
    if (marked.size < 16) throw Error(`${recipe.joint}: dressing disappeared from the atlas (${marked.size} texels)`);
    receipts.push({ joint: recipe.joint, paintedTexels: marked.size });
  }
  texture.setImage(PNG.sync.write(png));
  return receipts;
}
