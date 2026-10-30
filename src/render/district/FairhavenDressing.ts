import { BoxGeometry, Group, Mesh, type BufferGeometry, type Material } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DistrictLayout } from '../../levels/districts/types';
import type { PaletteToken } from '../../data/palette';
import type { Materials } from '../Materials';

/** Small rendered details on the sealed cellar stage and Metro shaft. No support/collision changes. */
export function fairhavenDressing(root: Group, layout: DistrictLayout, level: string, materials: Materials, ownedMaterials: Material[]): BufferGeometry[] {
  if (level !== 'L4' && level !== 'L5') return [];
  const batches = new Map<string, { token: PaletteToken; uncut: boolean; pieces: BufferGeometry[] }>();
  const box = (token: PaletteToken, x: number, y: number, z: number, w: number, h: number, d: number, uncut = false) => {
    const geometry = new BoxGeometry(w, h, d); geometry.translate(x, y, z);
    const key = `${token}:${uncut}`;
    if (!batches.has(key)) batches.set(key, { token, uncut, pieces: [] }); batches.get(key)!.pieces.push(geometry);
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
  if (level === 'L5') {
    const metro = layout.placements.find(p => p.assetId === 'bld.metro-entrance');
    if (metro) {
      const [x, , z] = metro.position;
      // Cream glazed wall courses, a dark skirting and a teal service stripe give
      // the stairwell depth while all geometry stays within the existing walls.
      for (const side of [-1, 1]) {
        box('picketWhite', x + side * .957, .83, z, .025, .66, 4.15);
        box('tealDark', x + side * .938, .68, z, .018, .09, 4.15);
        box('uiDark', x + side * .938, .38, z, .018, .13, 4.15);
        for (let i = 0; i < 8; i++) box('khaki', x + side * .937, .94, z - 1.9 + i * .54, .02, .42, .018);
      }
      box('picketWhite', x, .85, z - 2.185, 1.9, .62, .025);
      box('tealDark', x, .68, z - 2.165, 1.9, .09, .018);
      const back = layout.colliders.find(c => c.id.startsWith('dressing:metro-back:'))?.aabb;
      if (back) {
        const [x0, , z0] = back.min, [x1, top, z1] = back.max;
        // The baked brick retaining mass was the bare red shaft in the ending.
        // Clad its exposed front and returns, with a continuous station stripe.
        box('khakiLight', (x0 + x1) / 2, top / 2, z1 + .018, x1 - x0, top, .035, true);
        box('tealDark', (x0 + x1) / 2, .72, z1 + .042, x1 - x0, .14, .025, true);
        for (let row = 0; row < 6; row++) {
          box('khaki', (x0 + x1) / 2, .2 + row * .5, z1 + .041, x1 - x0, .025, .018, true);
          for (let col = 0; col < 8; col++) box('khaki', x0 + .3 + col * 1.2 + (row % 2) * .45, .44 + row * .5, z1 + .041, .025, .45, .018, true);
        }
        for (const side of [x0 - .018, x1 + .018]) {
          box('khakiLight', side, top / 2, (z0 + z1) / 2, .035, top, z1 - z0, true);
          box('tealDark', side, .72, (z0 + z1) / 2, .04, .14, z1 - z0, true);
        }
      }
    }
  }
  const owned: BufferGeometry[] = [];
  for (const { token, uncut, pieces } of batches.values()) {
    const geometry = mergeGeometries(pieces); pieces.forEach(p => p.dispose());
    // The retaining mass is behind the queue; its cladding must remain opaque
    // when the foreground building is revealed, or the bare brick shows through.
    const material = uncut ? materials.world(token).frozenCopy().seeThrough(false) : materials.world(token).seeThrough();
    if (uncut) ownedMaterials.push(material);
    const mesh = new Mesh(geometry, material); mesh.name = `fairhaven-dressing-${token}`;
    mesh.receiveShadow = true; mesh.castShadow = false; mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
    root.add(mesh); owned.push(geometry);
  }
  return owned;
}
