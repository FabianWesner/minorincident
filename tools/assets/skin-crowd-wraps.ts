/** Paint medical dressings on the continuous limb surface, so they cannot float in motion. */
import type { Document } from '@gltf-transform/core';
import { PNG } from 'pngjs';
import { Vector3 } from 'three';
import { crowdRegion } from '../../src/render/characters/crowdRegionData';

export interface CrowdWrap { joint: string; colour: string; stain?: boolean }
const END: Record<string, string> = { armL: 'foreArmL', armR: 'foreArmR', foreArmL: 'handL', foreArmR: 'handR', shinL: 'footL', shinR: 'footR' };
const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));

export function paintCrowdWraps(document: Document, recipes: CrowdWrap[]): { joint: string; paintedTexels: number }[] {
  const node = document.getRoot().listNodes().find(n => n.getName() === 'skin_body')!;
  const primitive = node.getMesh()!.listPrimitives()[0], texture = primitive.getMaterial()!.getBaseColorTexture()!;
  if (texture.getMimeType() !== 'image/png') throw Error('Crowd dressings require the pre-compression PNG atlas');
  const png = PNG.sync.read(Buffer.from(texture.getImage()!));
  const position = primitive.getAttribute('POSITION')!, uv = primitive.getAttribute('TEXCOORD_0')!;
  const indices = primitive.getIndices(), joints = node.getSkin()!.listJoints();
  const receipts = [];
  for (const recipe of recipes) {
    const start = joints.find(j => j.getName() === recipe.joint), end = joints.find(j => j.getName() === END[recipe.joint]);
    if (!start || !end) throw Error(`Unknown dressing limb ${recipe.joint}`);
    const a = new Vector3().fromArray(start.getWorldMatrix(), 12), axis = new Vector3().fromArray(end.getWorldMatrix(), 12).sub(a);
    const length = axis.length(), colour = rgb(recipe.colour), marked = new Set<number>();
    if (length < .01) throw Error(`Degenerate dressing limb ${recipe.joint}`);
    for (let t = 0; t < (indices?.getCount() ?? position.getCount()); t += 3) {
      const vertices = [0, 1, 2].map(k => indices ? indices.getScalar(t + k) : t + k);
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
        if (along < .23 || along > .77 || offset.clone().addScaledVector(axis, -along).length() > length * .55) continue;
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
