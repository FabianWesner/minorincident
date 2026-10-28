/** Authored infection cues on the new continuous animal, replayed for every LOD. */
import type { Document } from '@gltf-transform/core';
import { ConeGeometry, Matrix4, Vector3 } from 'three';
import { PNG } from 'pngjs';
export type AnimalLook = { species: string; infected: boolean };
export function animalColour(p: Vector3, original: number[], look: AnimalLook): number[] | undefined {
  const { x, y, z } = p, { species, infected } = look;
  let c: number[] | undefined;
  if (species === 'lion') {
    c = infected ? [147, 149, 112] : [199, 147, 69];
    // One connected neck envelope, independent of noisy TRELLIS colour islands.
    const face = z > .32 && (x / .17) ** 2 + ((y - .075) / .215) ** 2 < 1;
    if (z > .08 && y > -.16 && !face) c = infected ? [59, 45, 35] : [79, 47, 28];
    if (z > .40 && y < .10 && y > -.10 && Math.abs(x) < .115) c = infected ? [174, 169, 134] : [226, 201, 143];
    if (z > .483 && y > .055 && y < .12 && Math.abs(x) < .055 || z < -.435 && y > .06) c = [35, 28, 25];
  } else if (infected) {
    // Preserve species markings; wash colour toward a sickly, desaturated coat.
    const l = original[0] * .3 + original[1] * .59 + original[2] * .11;
    c = original.map((v, i) => Math.round(v * .62 + l * .28 + [2, 9, 0][i]));
    if (species === 'flamingo' && original[0] > 100 && original[2] > 80 && original[0] > original[1] * 1.1) c = [170, 145, 151];
  }
  if (!infected) return c;
  // Broad readable wounds on the actual surface, not random atlas noise.
  let wound = species === 'lion' ? ((Math.abs(x) - .22) / .11) ** 2 + ((y - .015) / .115) ** 2 + ((z + .095) / .19) ** 2
    : species === 'gorilla' ? ((Math.abs(x - .01) - .20) / .14) ** 2 + ((y - .08) / .16) ** 2 + ((z - .10) / .19) ** 2
    : species === 'elephant' ? ((Math.abs(x) - .24) / .11) ** 2 + ((y - .10) / .15) ** 2 + ((z + .16) / .22) ** 2
    : ((Math.abs(x) - .19) / .10) ** 2 + ((y + .005) / .13) ** 2 + ((z + .19) / .22) ** 2;
  // The isometric lens sees dorsal surfaces. Side-only wounds disappear behind
  // the bird's wings and the elephant's barrel in both front/back game views.
  if (species === 'flamingo') wound = Math.min(wound, ((Math.abs(x) - .085) / .095) ** 2 + ((y - .12) / .105) ** 2 + ((z + .18) / .19) ** 2);
  if (species === 'elephant') wound = Math.min(wound, ((x - .10) / .125) ** 2 + ((y - .30) / .10) ** 2 + ((z + .08) / .19) ** 2);
  wound += .07 * Math.sin(y * 130 + z * 80);
  if (wound < 1) {
    c = wound > .77 ? [75, 22, 28] : [148, 35, 42];
    // Three clean ivory rib strokes within the torn patch; no UV dilation.
    const ribTop = species === 'flamingo' ? .17 : species === 'elephant' && y > .2 ? .31 : .065;
    const ribs = [0, 1, 2].some(i => Math.abs(y - (ribTop - i * .052) - (z + .1) * .15) < .011);
    if (wound < .58 && ribs) c = [211, 192, 145];
  }
  const slash = species === 'lion' && Math.abs(x) > .17 && z > .17 && z < .33 && [0, 1].some(i => Math.abs(y - (.15 - i * .055 - (z - .17) * .55)) < .014)
    || species === 'elephant' && Math.abs(x) > .17 && z > .09 && z < .24 && Math.abs(y - (.20 - (Math.abs(x) - .17) * .7)) < .014
    || species === 'flamingo' && z > .30 && y > .01 && y < .15 && Math.abs(x + (y - .08) * .3) < .025;
  if (slash) c = [137, 29, 37];
  if (species === 'lion' || species === 'gorilla') {
    const cx = species === 'gorilla' ? .06 : 0, cy = species === 'gorilla' ? .174 : -.005;
    const rx = species === 'gorilla' ? .091 : .103, ry = species === 'gorilla' ? .060 : .061;
    const mouth = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (z > (species === 'gorilla' ? .36 : .39) && mouth < 1.16) c = mouth > .83 ? [110, 24, 30] : [26, 9, 14];
  }
  return c;
}

/** Merge dimensional fangs/incisors into the existing skinned primitive/material.
 * Their roots are projected onto this LOD's muzzle, so they cannot float after reduction.
 * An appended colour strip keeps every original UV island intact; no new draw/material. */
export function animalTeeth(document: Document, fit: { scale: number; yaw: number; translation: number[] }, look: AnimalLook) {
  if (!look.infected || !['lion', 'gorilla'].includes(look.species)) return { teeth: 0 };
  const body = document.getRoot().listNodes().find(n => n.getName() === 'skin_body')!, prim = body.getMesh()!.listPrimitives()[0];
  const texture = prim.getMaterial()!.getBaseColorTexture()!, original = PNG.sync.read(Buffer.from(texture.getImage()!));
  const tile = 32, png = new PNG({ width: original.width + tile, height: original.height }), tx = original.width, ty = 0;
  for (let y = 0; y < original.height; y++) {
    original.data.copy(png.data, y * png.width * 4, y * original.width * 4, (y + 1) * original.width * 4);
    for (let x = original.width; x < png.width; x++) { const k = (y * png.width + x) * 4; png.data[k] = 239; png.data[k + 1] = 225; png.data[k + 2] = 185; png.data[k + 3] = 255; }
  }
  const transform = new Matrix4().makeRotationY(fit.yaw * Math.PI / 180).scale(new Vector3(fit.scale, fit.scale, fit.scale)).setPosition(new Vector3().fromArray(fit.translation)), inverse = transform.clone().invert();
  const p = prim.getAttribute('POSITION')!, uv = prim.getAttribute('TEXCOORD_0')!;
  const indices = prim.getIndices() ?? document.createAccessor().setType('SCALAR').setArray(new Uint32Array(Array.from({ length: p.getCount() }, (_, i) => i)));
  prim.setIndices(indices);
  for (let i = 0; i < uv.getCount(); i++) uv.setElement(i, [uv.getElement(i, [])[0] * original.width / png.width, uv.getElement(i, [])[1]]);
  texture.setImage(PNG.sync.write(png));
  const source = Array.from({ length: p.getCount() }, (_, i) => new Vector3().fromArray(p.getElement(i, [])).applyMatrix4(inverse));
  const attrs: Record<string, number[]> = Object.fromEntries(prim.listSemantics().map(s => [s, Array.from(prim.getAttribute(s)!.getArray()! as ArrayLike<number>)])), triangles = Array.from(indices.getArray()! as ArrayLike<number>);
  const head = body.getSkin()!.listJoints().findIndex(n => n.getName() === 'head');
  const cx = look.species === 'gorilla' ? .06 : 0, cy = look.species === 'gorilla' ? .174 : -.005;
  let count = p.getCount(), teeth = 0;
  for (const [x, large] of [[-.066, true], [-.025, false], [.025, false], [.066, true]] as const) {
    const top = cy + .043, sx = cx + x;
    const surface = source.filter(v => Math.abs(v.x - sx) < .035 && Math.abs(v.y - top) < .032).sort((a, b) => b.z - a.z)[0];
    if (!surface) throw Error('No muzzle for tooth root');
    const length = large ? .079 : .030, radius = large ? .018 : .014;
    const geometry = new ConeGeometry(radius, length, 4, 1).toNonIndexed();
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    for (let i = 0; i < position.count; i++) {
      const q = new Vector3().fromBufferAttribute(position, i); q.x = -q.x; q.y = -q.y; q.add(new Vector3(sx, top - length / 2, surface.z + .012));q.applyMatrix4(transform);
      const n = new Vector3().fromBufferAttribute(normal, i);n.x = -n.x;n.y = -n.y;n.transformDirection(transform);
      for (const semantic of prim.listSemantics()) {
        const size = prim.getAttribute(semantic)!.getElementSize();
        attrs[semantic].push(...(semantic === 'POSITION' ? q.toArray() : semantic === 'NORMAL' ? n.toArray() : semantic === 'TEXCOORD_0' ? [(tx + tile / 2) / png.width, (ty + tile / 2) / png.height] : semantic === 'JOINTS_0' ? [head, 0, 0, 0] : semantic === 'WEIGHTS_0' ? [1, 0, 0, 0] : semantic === '_CROWD_PART' ? [head] : new Array(size).fill(0)));
      }
      triangles.push(count++);
    }
    teeth++;
  }
  const addedTriangles = (count - p.getCount()) / 3;
  for (const semantic of prim.listSemantics()) { const a = prim.getAttribute(semantic)!; const array = a.getArray()!; const Type = array.constructor as { new(values: number[]): typeof array };a.setArray(new Type(attrs[semantic])); }
  indices.setArray(new Uint32Array(triangles));
  return { teeth, triangles: addedTriangles, reservedTile: [tx, ty, tile] };
}
