/** Q-191: restore the authored blouse and apron ties on the continuous back surface. */
import type { Document } from '@gltf-transform/core';
import { PNG } from 'pngjs';
import { crowdRegion } from '../../src/render/characters/crowdRegionData';

export function restoreClerkApron(document: Document): { paintedTriangles: number } {
  const body = document.getRoot().listNodes().find(n => n.getName() === 'skin_body')!;
  const joints = body.getSkin()!.listJoints(), hip = joints.find(n => n.getName() === 'hip')!.getWorldTranslation()[1];
  const shoulder = joints.find(n => n.getName() === 'armL')!.getWorldTranslation()[1];
  const scale = (shoulder - hip) / .409, waist = hip + .096 * scale;
  const primitive = body.getMesh()!.listPrimitives()[0], texture = primitive.getMaterial()!.getBaseColorTexture()!;
  const original = Buffer.from(texture.getImage()!), source = PNG.sync.read(original);
  const atlas = new PNG({ width: source.width, height: source.height * 2 });
  atlas.data.set(source.data);
  // The reconstructed garment shares small UV islands with other surfaces.
  // Give its rear a continuous planar patch in the SAME atlas; painting the
  // old islands leaves triangular remnants and can overwrite the front/sleeves.
  const low = hip - .2 * scale, high = shoulder + .08 * scale, width = .9 * scale;
  for (let y = source.height; y < atlas.height; y++) for (let x = 0; x < atlas.width; x++) {
    const height = (low + (y - source.height + .5) / source.height * (high - low) - waist) / scale;
    const side = ((x + .5) / atlas.width - .5) * width / scale;
    let colour = height < -.018 ? [72, 81, 108] : Math.floor((height + .002) / .045) % 2 ? [242, 230, 220] : [168, 72, 58];
    const t = Math.max(0, Math.min(1, height / ((shoulder - waist) / scale)));
    const strap = height >= 0 && Math.min(Math.abs(side - (.22 * t - .11)), Math.abs(side + (.22 * t - .11))) < .018;
    const belt = Math.abs(height) < .017;
    const loop = Math.abs(Math.hypot((Math.abs(side) - .052) / .047, (height + .035) / .021) - 1) < .24;
    const knot = Math.abs(side) < .016 && Math.abs(height + .035) < .013;
    const tail = height < -.04 && height > -.105 && Math.abs(Math.abs(side) - (-height - .025) * .65) < .009;
    if (strap || tail) colour = [47, 110, 106];
    if (belt || loop || knot) colour = [68, 133, 128];
    const pixel = (y * atlas.width + x) * 4;
    for (let c = 0; c < 3; c++) atlas.data[pixel + c] = colour[c];
    atlas.data[pixel + 3] = Math.round((crowdRegion.authored + 1) / 7 * 255);
  }
  const positions = primitive.getAttribute('POSITION')!, uv = primitive.getAttribute('TEXCOORD_0')!, owners = primitive.getAttribute('_CROWD_PART')!;
  if (primitive.getIndices()) throw Error('Clerk garment repair expects the unindexed pre-compression body');
  // Every source UV (including the name badge) keeps its original pixels in
  // the top half. Only complete rear garment triangles take the new patch.
  for (const mesh of document.getRoot().listMeshes()) for (const part of mesh.listPrimitives()) {
    const map = part.getMaterial()?.getBaseColorTexture(), coords = part.getAttribute('TEXCOORD_0');
    if (!coords || !map || !Buffer.from(map.getImage() ?? []).equals(original)) continue;
    for (let i = 0; i < coords.getCount(); i++) { const v = coords.getElement(i, []); coords.setElement(i, [v[0], v[1] / 2]); }
  }
  let paintedTriangles = 0;
  for (let i = 0; i < positions.getCount(); i += 3) {
    const vertices = [i, i + 1, i + 2], p = vertices.map(v => positions.getElement(v, []));
    if (vertices.some(v => !['torso', 'hip', 'legL', 'legR'].includes(joints[owners.getScalar(v)].getName()))) continue;
    const centre = [0, 1, 2].map(axis => p.reduce((sum, v) => sum + v[axis] / 3, 0));
    if (centre[0] > -.025 * scale || centre[1] < hip - .13 * scale || centre[1] > shoulder + .02 * scale) continue;
    for (let k = 0; k < 3; k++) uv.setElement(vertices[k], [.5 + p[k][2] / width, .5 + .5 * (p[k][1] - low) / (high - low)]);
    paintedTriangles++;
  }
  if (paintedTriangles < 16) throw Error('Clerk apron back disappeared from the body');
  const paintedImage = PNG.sync.write(atlas);
  for (const shared of document.getRoot().listTextures()) if (shared === texture || Buffer.from(shared.getImage() ?? []).equals(original)) shared.setImage(paintedImage);
  return { paintedTriangles };
}
