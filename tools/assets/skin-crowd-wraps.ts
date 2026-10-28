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
      const slack = 1.5 * Math.max(...u.map((a, k) => Math.hypot(a[0] - u[(k + 1) % 3][0], a[1] - u[(k + 1) % 3][1]))) / Math.abs(area);
      const low = [0, 1].map(c => Math.max(0, Math.floor(Math.min(...u.map(v => v[c]))) - 2));
      const high = [0, 1].map(c => Math.min((c ? png.height : png.width) - 1, Math.ceil(Math.max(...u.map(v => v[c]))) + 2));
      for (let y = low[1]; y <= high[1]; y++) for (let x = low[0]; x <= high[0]; x++) {
        const w1 = ((x - u[0][0]) * (u[2][1] - u[0][1]) - (y - u[0][1]) * (u[2][0] - u[0][0])) / area;
        const w2 = ((u[1][0] - u[0][0]) * (y - u[0][1]) - (u[1][1] - u[0][1]) * (x - u[0][0])) / area, w0 = 1 - w1 - w2;
        if (Math.min(w0, w1, w2) < -slack) continue;
        const point = p[0].clone().multiplyScalar(w0).addScaledVector(p[1], w1).addScaledVector(p[2], w2), offset = point.clone().sub(a);
        const along = offset.dot(axis) / (length * length);
        if (along < .23 || along > .77 || !headband && offset.clone().addScaledVector(axis, -along).length() > length * .55) continue;
        const pixel = y * png.width + x, stain = recipe.stain && Math.abs(along - .54) < .11 && offset.x > .015;
        const shade = 1 - .045 * Math.cos(along * Math.PI * 22);
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
