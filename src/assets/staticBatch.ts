// Adapted from Bruno Simon folio-2025 Materials.js (MIT).
import { type Node, Box3, BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, Color, Sphere, Vector3, Group, MathUtils, Matrix3, Matrix4, Mesh, MeshBasicNodeMaterial, MeshLambertNodeMaterial, type Object3D, type Material } from 'three/webgpu';
import { attribute, float, luminance, varying, cameraPosition, normalWorld, positionWorld, vec3 } from 'three/tsl';
import { paletteTokens, type PaletteToken } from '../data/palette';
import { anchorsFor } from '../data/placedLights';
import type { Materials } from '../render/Materials';

/** Elements processed between cooperative yield points of the batching steps. */
// Frequent checkpoints keep the existing time budget meaningful for quantized/interleaved
// meshes on a slow CPU; a 16k-vertex color slice can overrun a whole gameplay frame.
const slice = 1024;
/** Float copy of a (possibly quantized/normalized) attribute without per-component getComponent calls. */
function* decode(attribute: import('three').BufferAttribute | import('three').InterleavedBufferAttribute): Generator<void, Float32Array> {
  const size = attribute.itemSize, values = new Float32Array(attribute.count * size);
  if ('isInterleavedBufferAttribute' in attribute && attribute.isInterleavedBufferAttribute) {
    const source = attribute.data.array as Parameters<typeof MathUtils.denormalize>[1], stride = attribute.data.stride, offset = attribute.offset;
    for (let i = 0; i < attribute.count; i++) {
      for (let c = 0; c < size; c++) { const value = source[i * stride + offset + c]; values[i * size + c] = attribute.normalized ? MathUtils.denormalize(value, source) : value; }
      if (i % slice === slice - 1) yield;
    }
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
type Part = { position: Float32Array; normal: Float32Array; color: Float32Array; palette: Float32Array; light: Float32Array; surface: Float32Array; window: Float32Array; windowUv: Float32Array; index: ArrayLike<number> | null };
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
  const attributes: [string, keyof Part, number][] = [['position', 'position', 3], ['normal', 'normal', 3], ['color', 'color', 3], ['_palette', 'palette', 1], ['_light', 'light', 1], ['_surface', 'surface', 1], ['_window', 'window', 1], ['_windowUV', 'windowUv', 2]];
  for (const [name, key, size] of attributes) {
    const merged = new Float32Array(vertices * size); let at = 0;
    for (const part of parts) { merged.set(part[key] as Float32Array, at); at += (part[key] as Float32Array).length; yield; }
    geometry.setAttribute(name, new BufferAttribute(merged, size));
  }
  // BufferGeometry.computeBoundingSphere (box centre, farthest vertex), sliced: InstancedMesh would
  // otherwise compute it in one go when the batch is created.
  const position = geometry.getAttribute('position').array as Float32Array;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < position.length; i += 3) {
    minX = Math.min(minX, position[i]); minY = Math.min(minY, position[i + 1]); minZ = Math.min(minZ, position[i + 2]);
    maxX = Math.max(maxX, position[i]); maxY = Math.max(maxY, position[i + 1]); maxZ = Math.max(maxZ, position[i + 2]);
    if (i % (slice * 3) === 0) yield;
  }
  geometry.boundingBox = new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ));
  const center = position.length ? new Vector3((minX + maxX) * .5, (minY + maxY) * .5, (minZ + maxZ) * .5) : new Vector3(); let radius = 0;
  for (let i = 0; i < position.length; i += 3) {
    const x = center.x - position[i], y = center.y - position[i + 1], z = center.z - position[i + 2];
    radius = Math.max(radius, x * x + y * y + z * z); if (i % (slice * 3) === 0) yield;
  }
  geometry.boundingSphere = new Sphere(center, Math.sqrt(radius));
  return geometry;
}
/** District placements never animate their parts. Store world swatch indices (figure batches retain vertex colors),
 * keeping glowing windows separate for power and the window mask. Written as resumable steps so the
 * background loader can spread one large prototype over several frames (staticBatchAsync). */
function* steps(source: Object3D, lit: boolean, materials?: Materials, foliage = false): Generator<void, Group> {
  source.updateMatrixWorld(true);
  const anchorList = (/^veh\./.test(source.userData.assetId ?? '') ? [] : anchorsFor(source.userData.assetId ?? ''));
  const emissiveAnchors = new Map<string, number>();
  source.traverse(node => {
    if (!node.userData.ss_light) return;
    const data = typeof node.userData.ss_light === 'string' ? JSON.parse(node.userData.ss_light) : node.userData.ss_light;
    const index = anchorList.findIndex(a => a.name === (node.userData.name ?? node.name));
    if (index >= 0) for (const name of data.emissiveNodes ?? []) emissiveAnchors.set(name, index);
  });
  const world = source.userData.paletteWorld !== false;
  const buckets = new Map<number, Part[]>(), meshes: Mesh[] = [], split = source.userData.splitRoof === true;
  // Animated door leaves (src/data/buildingDoors.ts) stay separate meshes in their hinge frame, so the view can swing them.
  const doorNames: string[] = Array.isArray(source.userData.splitDoors) ? source.userData.splitDoors : [];
  const doorNodes = doorNames.map(name => source.getObjectByName(name) ?? null), hinge = new Matrix4(), leafFrame = new Matrix4();
  source.traverse(node => {
    if (!(node instanceof Mesh) || node.userData.foliageProxy) return;
    for (let parent: Object3D | null = node; parent; parent = parent.parent) if (!parent.visible || parent.userData.foliageProxy) return;
    meshes.push(node);
  });
  for (const node of meshes) {
    const material = (Array.isArray(node.material) ? node.material[0] : node.material) as Material & { color: import('three').Color; vertexColors: boolean };
    // Enterable buildings keep their roof as a separate mesh so the view can lift it while the player is inside.
    let roof = false; if (split) for (let parent: Object3D | null = node; parent; parent = parent.parent) if (parent.name === 'roof') roof = true;
    let door = -1; if (doorNodes.length) for (let parent: Object3D | null = node; parent && door < 0; parent = parent.parent) door = doorNodes.indexOf(parent);
    const emissive = material.name.startsWith('emi_') || material.userData.emissiveStrength > 0;
    // Decode quantized attributes before applying transforms (integer arrays clamp).
    const position = yield* decode(node.geometry.getAttribute('position')), normal = yield* decode(node.geometry.getAttribute('normal'));
    yield* transform(position, normal, door >= 0 ? leafFrame.multiplyMatrices(hinge.copy(doorNodes[door]!.matrixWorld).invert(), node.matrixWorld) : node.matrixWorld);
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
    const bucket = (emissive ? 1 : 0) + (roof ? 2 : 0) + (door >= 0 ? 4 * (door + 1) : 0);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    // Delivery bundling combines material primitives under their semantic parent.
    // Match the authored parent + material reference through that hierarchy.
    let anchorIndex = -1;
    for (let part: Object3D | null = node; part && anchorIndex < 0; part = part.parent) {
      const name = part.userData.name ?? part.name;
      anchorIndex = emissiveAnchors.get(name) ?? emissiveAnchors.get(`${name}_${material.name}`) ?? -1;
    }
    // The packed street lamp omits its lantern mesh name; its only light owns all emissive geometry.
    if (emissive && anchorIndex < 0 && source.userData.assetId === 'prop.street-lamp' && anchorList.length === 1) anchorIndex = 0;
    const light = new Float32Array(count).fill(anchorIndex);
    const window = new Float32Array(count).fill(anchorList[anchorIndex]?.type === 'window' ? 1 : 0), windowUv = new Float32Array(count * 2);
    if (window[0] > 0) {
      const positions = node.geometry.getAttribute('position'), box = new Box3(), point = new Vector3();
      for (let i = 0; i < count; i++) { box.expandByPoint(point.set(positions.getX(i), positions.getY(i), positions.getZ(i))); if (i % slice === slice - 1) yield; }
      const horizontal = box.max.x - box.min.x > box.max.z - box.min.z ? 0 : 2;
      for (let i = 0; i < count; i++) { windowUv[i * 2] = (positions.getComponent(i, horizontal) - box.min.getComponent(horizontal)) / Math.max(.01, box.max.getComponent(horizontal) - box.min.getComponent(horizontal)); windowUv[i * 2 + 1] = (positions.getY(i) - box.min.y) / Math.max(.01, box.max.y - box.min.y); if (i % slice === slice - 1) yield; }
    }

    buckets.get(bucket)!.push({ position, normal, color: colors, palette: indices, light, window, windowUv, surface: new Float32Array(count).fill(material.userData.surfaceClass ?? 0), index: node.geometry.index ? node.geometry.index.array : null });
  }
  const result = new Group();
  for (const [bucket, parts] of buckets) {
    const emissive = (bucket & 1) === 1, isRoof = (bucket & 2) === 2, door = (bucket >> 2) - 1;
    // Keep shared vertices: expanding detailed meshes to triangle soup triples
    // the retained position/normal/color arrays. Normalize only mixed primitives.
    const geometry = yield* merge(parts);
    const hasSurface = parts.some(part => part.surface[0] > 0);
    const hasWindows = emissive && parts.some(part => part.window[0] > 0);
    // Matte building bodies need neither reflection sampling nor window inputs.
    // Keep those graphs/vertex buffers only on batches which actually use them.
    if (!hasSurface) geometry.deleteAttribute('_surface');
    if (!emissive) geometry.deleteAttribute('_light');
    if (!hasWindows) { geometry.deleteAttribute('_window'); geometry.deleteAttribute('_windowUV'); }
    // Power/window/gloss inputs share one vertex buffer. With position, normal,
    // color, palette, per-instance power/tint and matrix this stays within the
    // portable WebGPU limit of eight buffers (separate window inputs needed nine).
    const packedInputs = ['_light', '_surface', '_window', '_windowUV'].filter(name => geometry.hasAttribute(name)).map(name => ({ name, input: geometry.getAttribute(name) }));
    if (packedInputs.length > 1) {
      const stride = packedInputs.reduce((n, { input }) => n + input.itemSize, 0), count = geometry.getAttribute('position').count;
      const values = new Float32Array(count * stride);
      // merge() produced contiguous Float32 attributes. Copy them directly rather
      // than dispatching an attribute accessor for every component of every vertex.
      let componentOffset = 0;
      for (const { input } of packedInputs) {
        const source = input.array, size = input.itemSize;
        for (let vertex = 0; vertex < count; vertex++) {
          for (let c = 0; c < size; c++) values[vertex * stride + componentOffset + c] = source[vertex * size + c];
          if (vertex % slice === slice - 1) yield;
        }
        componentOffset += size;
      }
      const data = new InterleavedBuffer(values, stride); let offset = 0;
      for (const { name, input } of packedInputs) { geometry.setAttribute(name, new InterleavedBufferAttribute(data, input.itemSize, offset)); offset += input.itemSize; }
    }
    if (emissive) geometry.setAttribute('_lightBase', new BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1));
    const material = staticBatchMaterial(materials, emissive, lit, anchorList.length > 0, hasSurface, hasWindows, world, foliage);
    const mesh = new Mesh(geometry, material); mesh.name = isRoof ? (emissive ? 'roof-light' : 'roof') : emissive ? 'window-light' : 'static-body';
    if (door >= 0) { mesh.userData.door = doorNames[door]; doorNodes[door]!.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale); }
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

/** Night road read: 1 on asphalt, 1.4 on road paint within 3 cm of the ground (retroreflective, so lines stay brighter than the road; plinths, fences and trims are not lifted), 0 elsewhere. */
function roadMask(): Node<'float'> {
  const index = attribute('_palette', 'float'), is = (token: PaletteToken) => index.sub(paletteTokens.indexOf(token)).abs().lessThan(.5);
  return is('asphalt').select(float(1), is('picketWhite').and(positionWorld.y.lessThan(.03)).select(float(1.4), float(0)));
}

/** Rebuild exactly the same graph for runtime batches and lossless build output. */
export function staticBatchMaterial(materials: Materials | undefined, emissive: boolean, lit: boolean, anchors: boolean, hasSurface: boolean, hasWindows: boolean, world = true, foliage = false): Material {
  const base = materials && world ? varying(materials.sample(attribute('_palette', 'float')), 'worldPaletteColor').mul(emissive && !lit && !anchors ? .08 : 1) : attribute('color', 'vec3');
  const local = attribute('_light', 'float'), power = materials ? materials.lamps.sample(local.lessThan(0).select(0, attribute('_lightBase', 'float').greaterThan(0).select(attribute('_lightBase', 'float').add(local), 0))) : undefined;
  const view = cameraPosition.sub(positionWorld).normalize(), tangent = vec3(0, 1, 0).cross(normalWorld).normalize();
  const parallax = view.dot(tangent).div(view.dot(normalWorld).abs().max(.2)).mul(.3);
  const interiorUv = attribute('_windowUV', 'vec2');
  const rooms = interiorUv.x.add(parallax).fract().smoothstep(.35, .5).mul(interiorUv.y.smoothstep(.05, .3)).mul(.75).add(.08);
  const interior = hasWindows ? attribute('_window', 'float').greaterThan(.5).select(rooms, 1) : undefined;
  const glow = emissive && (lit || anchors) ? base.div(luminance(base).max(.001)).mul(hasWindows ? attribute('_window', 'float').greaterThan(.5).select(.6, 2) : 2).mul(power ?? 1).mul(interior ?? 1) : undefined;
  // InstancedGroup owns the placement-specific base; direct prototype renders use texel zero.
  const material = materials ? foliage ? materials.foliage(world) : materials.shaded(hasWindows ? base.mul(attribute('_window', 'float').greaterThan(.5).select(.025, 1)) : base, glow, undefined, hasSurface ? attribute('_surface', 'float') : undefined, world && !emissive ? roadMask() : undefined) : emissive && lit ? new MeshBasicNodeMaterial({ vertexColors: true }) : new MeshLambertNodeMaterial({ vertexColors: true });
  material.userData.emissiveStrength = emissive && lit ? 2 : 0;
  material.userData.batchFeatures = `${+hasSurface}:${+hasWindows}:${+!!glow}`;
  material.userData.worldPaletteOnly = !!materials && world;
  material.name = emissive ? 'emi_static-windows' : 'pal_static-colors';
  return material;
}
