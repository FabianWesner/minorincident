import { BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBuffer, InterleavedBufferAttribute, type InstancedMesh, type Node } from 'three/webgpu';
import { attribute, Fn, instanceColor, mat3, mat4, normalLocal, positionLocal, transformNormal } from 'three/tsl';
import { PaletteMaterial } from './PaletteMaterial';

const materials = new WeakMap<PaletteMaterial, PaletteMaterial>();
const packedNormals = new WeakMap<object, Int16Array>(), packedColors = new WeakMap<object, Uint16Array>();
/** Frozen vertices keep float32 positions and exact topology. Their normals and linear
 * colours use normalized 16-bit storage (errors <= 1/32767 and 1/65535 respectively).
 * Four lanes also avoid WebGPU's vec3 padding on upload. HDR colours retain float storage. */
function packedCorpseAttribute(name: string, input: BufferAttribute | InterleavedBufferAttribute): BufferAttribute | null {
  if (name !== 'normal' && name !== 'color') return null;
  const normal = name === 'normal', cache = normal ? packedNormals : packedColors;
  let values = cache.get(input);
  if (!values) {
    if (!normal) for (let i = 0; i < input.count; i++) for (let c = 0; c < input.itemSize; c++) if (input.getComponent(i, c) < 0 || input.getComponent(i, c) > 1) return null;
    values = normal ? new Int16Array(input.count * 4) : new Uint16Array(input.count * 4);
    for (let i = 0; i < input.count; i++) for (let c = 0; c < 4; c++) {
      const value = c < 3 || !normal && c < input.itemSize ? input.getComponent(i, c) : normal ? 0 : 1;
      values[i * 4 + c] = Math.round(value * (normal ? 32767 : 65535));
    }
    if (normal) packedNormals.set(input, values as Int16Array); else packedColors.set(input, values as Uint16Array);
  }
  return new BufferAttribute(values, 4, true);
}

function placementPosition(previous: Node | null, corpseNormals: boolean): Node {
  return Fn(() => {
    const matrix = mat4(attribute('_placement0', 'vec4'), attribute('_placement1', 'vec4'), attribute('_placement2', 'vec4'), attribute('_placement3', 'vec4'));
    positionLocal.assign(matrix.mul(positionLocal).xyz);
    // Frozen bodies use yaw/translation only; other static props retain inverse-transpose normals.
    normalLocal.assign(corpseNormals ? mat3(matrix).mul(normalLocal).normalize() : transformNormal(normalLocal, matrix));
    instanceColor.assign(attribute('_placementColor', 'vec3'));
    return previous ?? positionLocal;
  })();
}
// These graphs contain only per-draw attributes. A copied source material must
// not create a fresh shader key when a streamed LOD borrows the same shading.
const staticPosition = placementPosition(null, false), corpsePosition = placementPosition(null, true);
/** Geometry attributes bind per draw. Unlike Three's captured instance buffer nodes,
 * these let identical static batches share a node build without sharing their data. */
export function staticInstanceAttributes(mesh: InstancedMesh): boolean {
  const source = mesh.material;
  if (!(source instanceof PaletteMaterial) || source.userData.batchFeatures === undefined || Object.keys(mesh.geometry.morphAttributes).length) return false;
  const corpseNormals = source.userData.batchFeatures === 'corpses';
  let material = materials.get(source);
  if (!material) {
    material = source.frozenCopy();
    if (source.userData.seeThrough === true) material.seeThrough('placement');
    material.positionNode = source.positionNode ? placementPosition(source.positionNode, corpseNormals) : corpseNormals ? corpsePosition : staticPosition;
    const owned = material;
    source.addEventListener('dispose', () => owned.dispose()); materials.set(source, material);
  }
  const original = mesh.geometry, geometry = new BufferGeometry();
  // CPU arrays are immutable and can be borrowed. Attribute wrappers own their
  // GPU buffers: retiring one LOD must not delete another LOD's live bindings.
  const buffers = new Map<InterleavedBuffer, InterleavedBuffer>();
  for (const [name, input] of Object.entries(original.attributes)) {
    const packed = corpseNormals ? packedCorpseAttribute(name, input) : null;
    if (packed) { geometry.setAttribute(name, packed); continue; }
    if ('isInterleavedBufferAttribute' in input) {
      let data = buffers.get(input.data);
      if (!data) {
        data = input.data instanceof InstancedInterleavedBuffer
          ? new InstancedInterleavedBuffer(input.data.array, input.data.stride, input.data.meshPerAttribute)
          : new InterleavedBuffer(input.data.array, input.data.stride);
        data.setUsage(input.data.usage); buffers.set(input.data, data);
      }
      geometry.setAttribute(name, new InterleavedBufferAttribute(data, input.itemSize, input.offset, input.normalized));
    } else {
      const copy = input instanceof InstancedBufferAttribute ? new InstancedBufferAttribute(input.array, input.itemSize, input.normalized, input.meshPerAttribute) : new BufferAttribute(input.array, input.itemSize, input.normalized);
      copy.setUsage(input.usage); copy.gpuType = input.gpuType; geometry.setAttribute(name, copy);
    }
  }
  if (original.index) geometry.setIndex(new BufferAttribute(original.index.array, 1));
  geometry.groups = original.groups.map(group => ({ ...group })); geometry.drawRange = { ...original.drawRange };
  geometry.boundingBox = original.boundingBox?.clone() ?? null; geometry.boundingSphere = original.boundingSphere?.clone() ?? null;
  geometry.userData = { ...original.userData };
  const matrix = new InstancedInterleavedBuffer(mesh.instanceMatrix.array, 16, 1);
  for (let i = 0; i < 4; i++) geometry.setAttribute(`_placement${i}`, new InterleavedBufferAttribute(matrix, 4, i * 4));
  geometry.setAttribute('_placementColor', mesh.instanceColor!);
  const before = mesh.onBeforeRender;
  mesh.onBeforeRender = function (...args) {
    matrix.version = mesh.instanceMatrix.version;
    matrix.clearUpdateRanges(); matrix.updateRanges.push(...mesh.instanceMatrix.updateRanges); mesh.instanceMatrix.clearUpdateRanges();
    before.apply(this, args);
  };
  mesh.geometry = geometry; mesh.material = material;
  // Keep InstancedMesh's counts, bounds, raycasting and matrix API. Only disable
  // its implicit TSL transform; the named attributes above perform the same work.
  Object.defineProperty(mesh, 'isInstancedMesh', { value: false, writable: true });
  mesh.userData.staticInstanceAttributes = true;
  mesh.userData.staticInstancePosition = material.positionNode;
  return true;
}
