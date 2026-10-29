/** Q-191: restore the authored striped blouse and apron ties on the continuous back surface. */
import type { Document } from '@gltf-transform/core';
import { PNG } from 'pngjs';
import { crowdRegion } from '../../src/render/characters/crowdRegionData';

export function restoreClerkApron(document: Document): { paintedTexels: number } {
  const body = document.getRoot().listNodes().find(n => n.getName() === 'skin_body')!;
  const joints = body.getSkin()!.listJoints(), hip = joints.find(n => n.getName() === 'hip')!.getWorldTranslation()[1];
  const shoulder = joints.find(n => n.getName() === 'armL')!.getWorldTranslation()[1];
  const scale = (shoulder - hip) / .409, waist = hip + .096 * scale;
  const primitive = body.getMesh()!.listPrimitives()[0], texture = primitive.getMaterial()!.getBaseColorTexture()!;
  const png = PNG.sync.read(Buffer.from(texture.getImage()!));
  const positions = primitive.getAttribute('POSITION')!, uv = primitive.getAttribute('TEXCOORD_0')!, owners = primitive.getAttribute('_CROWD_PART')!, indices = primitive.getIndices();
  const triangles = Array.from({ length: (indices?.getCount() ?? positions.getCount()) / 3 }, (_, face) => {
    const vertices = [0, 1, 2].map(k => indices ? indices.getScalar(face * 3 + k) : face * 3 + k);
    return { vertices, p: vertices.map(v => positions.getElement(v, [])), u: vertices.map(v => uv.getElement(v, []).map((n, c) => n * (c ? png.height : png.width) - .5)) };
  });
  // Triangle interiors own their texels. Padding may fill only unused gutters,
  // so a strap cannot bleed into a neighbouring face/arm UV island.
  const texelOwner = new Int32Array(png.width * png.height).fill(-1);
  const raster = (padding: number, visit: (face: number, pixel: number, weights: number[]) => void) => {
    for (let face = 0; face < triangles.length; face++) {
      const { u } = triangles[face];
      const area = (u[1][0] - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (u[1][1] - u[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      for (let y = Math.max(0, Math.floor(Math.min(...u.map(v => v[1])) - padding)); y <= Math.min(png.height - 1, Math.ceil(Math.max(...u.map(v => v[1])) + padding)); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(...u.map(v => v[0])) - padding)); x <= Math.min(png.width - 1, Math.ceil(Math.max(...u.map(v => v[0])) + padding)); x++) {
          const b = ((x - u[0][0]) * (u[2][1] - u[0][1]) - (y - u[0][1]) * (u[2][0] - u[0][0])) / area;
          const c = ((u[1][0] - u[0][0]) * (y - u[0][1]) - (u[1][1] - u[0][1]) * (x - u[0][0])) / area, weights = [1 - b - c, b, c];
          if (weights.some((w, k) => w * Math.abs(area) < -padding * Math.hypot(u[(k + 1) % 3][0] - u[(k + 2) % 3][0], u[(k + 1) % 3][1] - u[(k + 2) % 3][1]))) continue;
          visit(face, y * png.width + x, weights);
        }
      }
    }
  };
  raster(0, (face, pixel) => { texelOwner[pixel] = face; });
  const painted = new Set<number>();
  raster(1.5, (face, pixel, weights) => {
    if (texelOwner[pixel] !== -1 && texelOwner[pixel] !== face) return;
    const { vertices, p } = triangles[face];
    if (vertices.some(v => !['torso', 'hip'].includes(joints[owners.getScalar(v)].getName()))) return;
    const [x, y, z] = [0, 1, 2].map(axis => p.reduce((sum, v, k) => sum + v[axis] * weights[k], 0));
    if (x > -.045 * scale || y < hip - .13 * scale || y > shoulder + .02 * scale) return;
    const height = (y - waist) / scale, side = z / scale;
    // The apron is open at the back: jeans below the waist, ivory/coral blouse
    // above it. Its front bib/skirt, sleeves and skin keep their source paint.
    let colour = height < -.018 ? [72, 81, 108] : Math.floor((height + .002) / .045) % 2 ? [242, 230, 220] : [168, 72, 58];
    const t = Math.max(0, Math.min(1, height / ((shoulder - waist) / scale)));
    const strap = height >= 0 && Math.min(Math.abs(side - (.22 * t - .11)), Math.abs(side + (.22 * t - .11))) < .018;
    const belt = Math.abs(height) < .017;
    const loop = Math.abs(Math.hypot((Math.abs(side) - .052) / .047, (height + .035) / .021) - 1) < .24;
    const knot = Math.abs(side) < .016 && Math.abs(height + .035) < .013;
    const tail = height < -.04 && height > -.105 && Math.abs(Math.abs(side) - (-height - .025) * .65) < .009;
    if (strap || tail) colour = [47, 110, 106];
    if (belt || loop || knot) colour = [68, 133, 128];
    for (let c = 0; c < 3; c++) png.data[pixel * 4 + c] = colour[c];
    png.data[pixel * 4 + 3] = Math.round((crowdRegion.authored + 1) / 7 * 255);
    painted.add(pixel);
  });
  if (painted.size < 64) throw Error('Clerk apron back disappeared from the atlas');
  texture.setImage(PNG.sync.write(png));
  return { paintedTexels: painted.size };
}
