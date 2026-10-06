// Adapted from Bruno Simon folio-2025 Materials.js (MIT).
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicNodeMaterial, MeshLambertNodeMaterial, type Object3D, type Material } from 'three/webgpu';
import { attribute, luminance, varying } from 'three/tsl';
import { paletteTokens, type PaletteToken } from '../data/palette';
import type { Materials } from '../render/Materials';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** District placements never animate their parts. Store world swatch indices (figure batches retain vertex colors),
 * keeping glowing windows separate for power and the window mask. */
export function staticBatch(source: Object3D, lit: boolean, materials?: Materials, foliage = false): Group {
  source.updateMatrixWorld(true);
  const world = source.userData.paletteWorld !== false;
  const buckets = new Map<boolean, BufferGeometry[]>();
  source.traverse(node => {
    if (!(node instanceof Mesh) || node.userData.foliageProxy) return;
    for (let parent: Object3D | null = node; parent; parent = parent.parent) if (!parent.visible || parent.userData.foliageProxy) return;
    const material = (Array.isArray(node.material) ? node.material[0] : node.material) as Material & { color: import('three').Color; vertexColors: boolean };
    const emissive = material.name.startsWith('emi_') || material.userData.emissiveStrength > 0;
    const geometry = new BufferGeometry();
    // Decode quantized attributes before applying transforms (integer arrays clamp).
    for (const name of ['position', 'normal']) {
      const attribute = node.geometry.getAttribute(name), values = new Float32Array(attribute.count * attribute.itemSize);
      for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.getComponent(i, c);
      geometry.setAttribute(name, new BufferAttribute(values, attribute.itemSize));
    }
    if (node.geometry.index) geometry.setIndex(node.geometry.index.clone());
    geometry.applyMatrix4(node.matrixWorld);
    const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), indices = new Float32Array(count), vertexColor = node.geometry.getAttribute('color');
    for (let i = 0; i < count; i++) {
      const color = material.color.toArray();
      if (material.vertexColors && vertexColor) for (let c = 0; c < 3; c++) color[c] *= vertexColor.getComponent(i, c);
      if (emissive && !lit) for (let c = 0; c < 3; c++) color[c] *= .08;
      colors.set(color, i * 3);
      const token = material.name.replace(/^(pal|emi)_/, '') as PaletteToken;
      const tokenIndex = paletteTokens.indexOf(token);
      // Authored vertex-color assets are quantized to the shared sheet; figures keep their swatches.
      indices[i] = material.vertexColors || tokenIndex < 0 ? materials?.nearest(material.color.clone().fromArray(color)) ?? 0 : tokenIndex;
      if (source.userData.paletteHydrant && token === 'survivorRed') indices[i] -= paletteTokens.length;
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('_palette', new BufferAttribute(indices, 1));
    if (!buckets.has(emissive)) buckets.set(emissive, []);
    buckets.get(emissive)!.push(geometry);
  });
  const result = new Group();
  for (const [emissive, geometries] of buckets) {
    // Keep shared vertices: expanding detailed meshes to triangle soup triples
    // the retained position/normal/color arrays. Normalize only mixed primitives.
    if (geometries.some(g => g.index)) for (const g of geometries) {
      if (!g.index) g.setIndex(Array.from({ length: g.getAttribute('position').count }, (_, i) => i));
    }
    const geometry = mergeGeometries(geometries)!;
    for (const g of geometries) g.dispose();
    const base = materials && world ? varying(materials.sample(attribute('_palette', 'float')), 'worldPaletteColor').mul(emissive && !lit ? .08 : 1) : attribute('color', 'vec3');
    const glow = emissive && lit ? base.div(luminance(base).max(.001)).mul(2) : undefined;
    const material = materials ? foliage ? materials.foliage(world) : materials.shaded(base, glow) : emissive && lit ? new MeshBasicNodeMaterial({ vertexColors: true }) : new MeshLambertNodeMaterial({ vertexColors: true });
    material.userData.emissiveStrength = emissive && lit ? 2 : 0;
    material.name = emissive ? 'emi_static-windows' : 'pal_static-colors';
    const mesh = new Mesh(geometry, material); mesh.name = emissive ? 'window-light' : 'static-body';
    mesh.castShadow = !emissive; mesh.receiveShadow = true; result.add(mesh);
  }
  return result;
}
