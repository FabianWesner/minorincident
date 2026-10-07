// Adapted from Bruno Simon folio-2025 Materials.js (MIT).
import { Box3, BufferAttribute, BufferGeometry, Color, Sphere, Vector3, Group, MathUtils, Matrix3, type Matrix4, Mesh, MeshBasicNodeMaterial, MeshLambertNodeMaterial, type Object3D, type Material } from 'three/webgpu';
import { attribute, luminance, varying } from 'three/tsl';
import { paletteTokens, type PaletteToken } from '../data/palette';
import type { Materials } from '../render/Materials';

/** Elements processed between cooperative yield points of the batching steps. */
const slice = 16384;
/** Float copy of a (possibly quantized/normalized) attribute without per-component getComponent calls. */
function* decode(attribute: import('three').BufferAttribute | import('three').InterleavedBufferAttribute): Generator<void, Float32Array> {
  const size = attribute.itemSize, values = new Float32Array(attribute.count * size);
  if ('isInterleavedBufferAttribute' in attribute && attribute.isInterleavedBufferAttribute) {
    for (let i = 0; i < attribute.count; i++) { for (let c = 0; c < size; c++) values[i * size + c] = attribute.getComponent(i, c); if (i % slice === slice - 1) yield; }
    return values;
  }
  const array = attribute.array as Parameters<typeof MathUtils.denormalize>[1];
  for (let k = 0; k < values.length; k++) { values[k] = attribute.normalized ? MathUtils.denormalize(array[k], array) : array[k]; if (k % slice === slice - 1) yield; }
  return values;
}
const normalMatrix = new Matrix3();
/** BufferGeometry.applyMatrix4 for xyz position/normal arrays, with the same arithmetic
 * (Vector3.applyMatrix4 / applyNormalMatrix) but without per-vertex attribute accessors. */
function* transform(position: Float32Array, normal: Float32Array, matrix: Matrix4): Generator<void, void> {
  const e = matrix.elements;
  for (let i = 0; i < position.length; i += 3) {
    const x = position[i], y = position[i + 1], z = position[i + 2];
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    position[i] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    position[i + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    position[i + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    if (i % (slice * 3) === 0) yield;
  }
  const n = normalMatrix.getNormalMatrix(matrix).elements.slice();
  for (let i = 0; i < normal.length; i += 3) {
    const x = normal[i], y = normal[i + 1], z = normal[i + 2];
    let nx = n[0] * x + n[3] * y + n[6] * z, ny = n[1] * x + n[4] * y + n[7] * z, nz = n[2] * x + n[5] * y + n[8] * z;
    const scale = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
    nx *= scale; ny *= scale; nz *= scale;
    normal[i] = nx; normal[i + 1] = ny; normal[i + 2] = nz;
    if (i % (slice * 3) === 0) yield;
  }
}
type Part = { position: Float32Array; normal: Float32Array; color: Float32Array; palette: Float32Array; index: ArrayLike<number> | null };
/** BufferGeometryUtils.mergeGeometries for the batch attributes (same order, values and index type). */
function* merge(parts: Part[]): Generator<void, BufferGeometry> {
  const geometry = new BufferGeometry(), indexed = parts.some(part => part.index);
  const vertices = parts.reduce((n, part) => n + part.position.length / 3, 0);
  if (indexed) {
    const total = parts.reduce((n, part) => n + (part.index?.length ?? part.position.length / 3), 0), index = new Uint32Array(total);
    let at = 0, offset = 0, max = 0;
    for (const part of parts) {
      const count = part.position.length / 3, source = part.index;
      for (let j = 0, n = source?.length ?? count; j < n; j++) { const value = (source ? source[j] : j) + offset; index[at++] = value; if (value > max) max = value; if (j % slice === slice - 1) yield; }
      offset += count;
    }
    // setIndex(array) semantics: 16-bit unless a value reaches 65535.
    geometry.setIndex(new BufferAttribute(max >= 65535 ? index : Uint16Array.from(index), 1));
  }
  const attributes: [string, keyof Part, number][] = [['position', 'position', 3], ['normal', 'normal', 3], ['color', 'color', 3], ['_palette', 'palette', 1]];
  for (const [name, key, size] of attributes) {
    const merged = new Float32Array(vertices * size); let at = 0;
    for (const part of parts) { merged.set(part[key] as Float32Array, at); at += (part[key] as Float32Array).length; yield; }
    geometry.setAttribute(name, new BufferAttribute(merged, size));
  }
  // BufferGeometry.computeBoundingSphere (box centre, farthest vertex), sliced: InstancedMesh would
  // otherwise compute it in one go when the batch is created.
  const position = geometry.getAttribute('position').array as Float32Array, box = new Box3(), point = new Vector3();
  for (let i = 0; i < position.length; i += 3) { box.expandByPoint(point.set(position[i], position[i + 1], position[i + 2])); if (i % (slice * 3) === 0) yield; }
  const center = box.getCenter(new Vector3()); let radius = 0;
  for (let i = 0; i < position.length; i += 3) { radius = Math.max(radius, center.distanceToSquared(point.set(position[i], position[i + 1], position[i + 2]))); if (i % (slice * 3) === 0) yield; }
  geometry.boundingSphere = new Sphere(center, Math.sqrt(radius));
  return geometry;
}
/** District placements never animate their parts. Store world swatch indices (figure batches retain vertex colors),
 * keeping glowing windows separate for power and the window mask. Written as resumable steps so the
 * background loader can spread one large prototype over several frames (staticBatchAsync). */
function* steps(source: Object3D, lit: boolean, materials?: Materials, foliage = false): Generator<void, Group> {
  source.updateMatrixWorld(true);
  const world = source.userData.paletteWorld !== false;
  const buckets = new Map<number, Part[]>(), meshes: Mesh[] = [], split = source.userData.splitRoof === true;
  source.traverse(node => {
    if (!(node instanceof Mesh) || node.userData.foliageProxy) return;
    for (let parent: Object3D | null = node; parent; parent = parent.parent) if (!parent.visible || parent.userData.foliageProxy) return;
    meshes.push(node);
  });
  for (const node of meshes) {
    const material = (Array.isArray(node.material) ? node.material[0] : node.material) as Material & { color: import('three').Color; vertexColors: boolean };
    // Enterable buildings keep their roof as a separate mesh so the view can lift it while the player is inside.
    let roof = false; if (split) for (let parent: Object3D | null = node; parent; parent = parent.parent) if (parent.name === 'roof') roof = true;
    const emissive = material.name.startsWith('emi_') || material.userData.emissiveStrength > 0;
    // Decode quantized attributes before applying transforms (integer arrays clamp).
    const position = yield* decode(node.geometry.getAttribute('position')), normal = yield* decode(node.geometry.getAttribute('normal'));
    yield* transform(position, normal, node.matrixWorld);
    const count = position.length / 3, colors = new Float32Array(count * 3), indices = new Float32Array(count), vertexColor = node.geometry.getAttribute('color');
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
      if (i % slice === slice - 1) yield;
    }
    const bucket = (emissive ? 1 : 0) + (roof ? 2 : 0);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push({ position, normal, color: colors, palette: indices, index: node.geometry.index ? node.geometry.index.array : null });
  }
  const result = new Group();
  for (const [bucket, parts] of buckets) {
    const emissive = (bucket & 1) === 1, isRoof = bucket >= 2;
    // Keep shared vertices: expanding detailed meshes to triangle soup triples
    // the retained position/normal/color arrays. Normalize only mixed primitives.
    const geometry = yield* merge(parts);
    const base = materials && world ? varying(materials.sample(attribute('_palette', 'float')), 'worldPaletteColor').mul(emissive && !lit ? .08 : 1) : attribute('color', 'vec3');
    const glow = emissive && lit ? base.div(luminance(base).max(.001)).mul(2) : undefined;
    const material = materials ? foliage ? materials.foliage(world) : materials.shaded(base, glow) : emissive && lit ? new MeshBasicNodeMaterial({ vertexColors: true }) : new MeshLambertNodeMaterial({ vertexColors: true });
    material.userData.emissiveStrength = emissive && lit ? 2 : 0;
    material.name = emissive ? 'emi_static-windows' : 'pal_static-colors';
    const mesh = new Mesh(geometry, material); mesh.name = isRoof ? (emissive ? 'roof-light' : 'roof') : emissive ? 'window-light' : 'static-body';
    mesh.castShadow = !emissive; mesh.receiveShadow = true; result.add(mesh);
  }
  return result;
}
export function staticBatch(source: Object3D, lit: boolean, materials?: Materials, foliage = false): Group {
  const run = steps(source, lit, materials, foliage);
  for (let step = run.next(); ; step = run.next()) if (step.done) return step.value;
}
/** Same result as staticBatch, yielding to `pause` whenever a slice exceeded `budgetMs` of main-thread time. */
export async function staticBatchAsync(source: Object3D, lit: boolean, materials: Materials | undefined, pause: () => Promise<void>, budgetMs = 4): Promise<Group> {
  const run = steps(source, lit, materials);
  let start = performance.now();
  for (let step = run.next(); ; step = run.next()) {
    if (step.done) return step.value;
    if (performance.now() - start > budgetMs) { await pause(); start = performance.now(); }
  }
}
