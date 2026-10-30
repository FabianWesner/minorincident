import { BoxGeometry, Group, Mesh, type BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DistrictLayout } from '../../levels/districts/types';
import type { PaletteToken } from '../../data/palette';
import type { Materials } from '../Materials';

/** Small rendered details on the sealed cellar stage and Metro shaft. No support/collision changes. */
export function fairhavenDressing(root: Group, layout: DistrictLayout, level: string, materials: Materials): BufferGeometry[] {
  if (level !== 'L4' && level !== 'L5') return [];
  const batches = new Map<PaletteToken, BufferGeometry[]>();
  const box = (token: PaletteToken, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const geometry = new BoxGeometry(w, h, d); geometry.translate(x, y, z);
    if (!batches.has(token)) batches.set(token, []); batches.get(token)!.push(geometry);
  };
  const cellar = layout.anchors['cellar-interior'];
  if (cellar) {
    const [x, , z] = cellar.position;
    // A continuous paved service yard carries the cutaway slab into the surrounding
    // ground. Its low retaining edge and loose masonry break the former bare seam.
    box('sidewalk', x, .015, z, 13.4, .06, 15.2);
    for (const side of [-1, 1]) {
      box('khaki', x + side * 6.65, .26, z, .32, .52, 15.4);
      box('khakiLight', x + side * 6.65, .55, z, .44, .08, 15.4);
      box('khaki', x, .26, z + side * 7.55, 13.4, .52, .32);
      box('khakiLight', x, .55, z + side * 7.55, 13.6, .08, .44);
    }
    // Coarse joints stay visible on low tier without adding a new material graph.
    for (let i = -6; i <= 6; i++) box('khaki', x + i, .05, z, .025, .015, 15.0);
    for (let i = -7; i <= 7; i++) box('khaki', x, .05, z + i, 13.1, .015, .025);
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? -1 : 1, offset = (i % 8) * 1.75 - 6.2;
      box(i % 3 ? 'khaki' : 'khakiLight', x + side * (5.8 - (i % 3) * .24), .12 + (i % 3) * .045, z + offset, .38 + (i % 3) * .12, .24 + (i % 3) * .09, .34 + (i % 4) * .1);
    }
  }
  const owned: BufferGeometry[] = [];
  for (const [token, pieces] of batches) {
    const geometry = mergeGeometries(pieces); pieces.forEach(p => p.dispose());
    const mesh = new Mesh(geometry, materials.world(token)); mesh.name = `fairhaven-dressing-${token}`;
    mesh.receiveShadow = true; mesh.castShadow = false; mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
    root.add(mesh); owned.push(geometry);
  }
  return owned;
}
