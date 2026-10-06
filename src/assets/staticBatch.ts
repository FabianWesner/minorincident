// Adapted from Bruno Simon folio-2025 Materials.js (MIT).
import { BufferAttribute, BufferGeometry, Color, Group, MathUtils, Matrix3, type Matrix4, Mesh, MeshBasicNodeMaterial, MeshLambertNodeMaterial, type Object3D, type Material } from 'three/webgpu';
import { attribute, luminance, varying } from 'three/tsl';
import { paletteTokens, type PaletteToken } from '../data/palette';
import type { Materials } from '../render/Materials';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Float copy of a (possibly quantized/normalized) attribute without per-component getComponent calls. */
function decode(attribute: import('three').BufferAttribute | import('three').InterleavedBufferAttribute): Float32Array {
  const size = attribute.itemSize, values = new Float32Array(attribute.count * size);
  if ('isInterleavedBufferAttribute' in attribute && attribute.isInterleavedBufferAttribute) {
    for (let i = 0; i < attribute.count; i++) for (let c = 0; c < size; c++) values[i * size + c] = attribute.getComponent(i, c);
    return values;
  }
  const array = attribute.array as Parameters<typeof MathUtils.denormalize>[1];
  if (attribute.normalized) for (let k = 0; k < values.length; k++) values[k] = MathUtils.denormalize(array[k], array);
  else for (let k = 0; k < values.length; k++) values[k] = array[k];
  return values;
}

const normalMatrix = new Matrix3();
/** BufferGeometry.applyMatrix4 for xyz position/normal arrays, with the same arithmetic
 * (Vector3.applyMatrix4 / applyNormalMatrix) but without per-vertex attribute accessors. */
function transform(position: Float32Array, normal: Float32Array, matrix: Matrix4): void {
  const e = matrix.elements;
  for (let i = 0; i < position.length; i += 3) {
    const x = position[i], y = position[i + 1], z = position[i + 2];
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    position[i] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    position[i + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    position[i + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
  }
  const n = normalMatrix.getNormalMatrix(matrix).elements;
  for (let i = 0; i < normal.length; i += 3) {
    const x = normal[i], y = normal[i + 1], z = normal[i + 2];
    let nx = n[0] * x + n[3] * y + n[6] * z, ny = n[1] * x + n[4] * y + n[7] * z, nz = n[2] * x + n[5] * y + n[8] * z;
    const scale = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
    nx *= scale; ny *= scale; nz *= scale;
    normal[i] = nx; normal[i + 1] = ny; normal[i + 2] = nz;
  }
}
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
    const position = decode(node.geometry.getAttribute('position')), normal = decode(node.geometry.getAttribute('normal'));
    transform(position, normal, node.matrixWorld);
    geometry.setAttribute('position', new BufferAttribute(position, 3)); geometry.setAttribute('normal', new BufferAttribute(normal, 3));
    if (node.geometry.index) geometry.setIndex(node.geometry.index.clone());
    const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), indices = new Float32Array(count), vertexColor = node.geometry.getAttribute('color');
    // Per-mesh constants are hoisted: this loop runs for every vertex of every district prototype.
    const base = material.color.toArray(), dim = emissive && !lit ? .08 : 1;
    const token = material.name.replace(/^(pal|emi)_/, '') as PaletteToken, tokenIndex = paletteTokens.indexOf(token);
    const perVertex = material.vertexColors && vertexColor, quantize = material.vertexColors || tokenIndex < 0;
    const hydrantShift = source.userData.paletteHydrant && token === 'survivorRed' ? paletteTokens.length : 0;
    const scratch = new Color(), local = new Map<number, number>();
    const swatch = (r: number, g: number, b: number): number => {
      if (!materials) return 0;
      // Same 1/4096 key as Materials.nearest, packed into one exact integer instead of a string.
      const key = (Math.round(r * 4096) * 8193 + Math.round(g * 4096)) * 8193 + Math.round(b * 4096);
      let index = local.get(key);
      if (index === undefined) { index = materials.nearest(scratch.setRGB(r, g, b)); local.set(key, index); }
      return index;
    };
    const constant = quantize && !perVertex ? swatch(base[0] * dim, base[1] * dim, base[2] * dim) : tokenIndex;
    for (let i = 0; i < count; i++) {
      let r = base[0], g = base[1], b = base[2];
      if (perVertex) { r *= vertexColor.getX(i); g *= vertexColor.getY(i); b *= vertexColor.getZ(i); }
      r *= dim; g *= dim; b *= dim;
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
      // Authored vertex-color assets are quantized to the shared sheet; figures keep their swatches.
      indices[i] = (quantize ? perVertex ? swatch(r, g, b) : constant : tokenIndex) - hydrantShift;
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
