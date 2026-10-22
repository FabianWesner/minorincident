import { BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBuffer, InterleavedBufferAttribute, Matrix3, Matrix4, type InstancedMesh } from 'three/webgpu';
import { attribute, Fn, instanceColor, mat3, mat4, normalLocal, positionLocal, transformNormal } from 'three/tsl';
import { PaletteMaterial } from './PaletteMaterial';

const materials = new WeakMap<PaletteMaterial, PaletteMaterial>();
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
    const previous = source.positionNode;
    material.positionNode = Fn(() => {
      const matrix = mat4(attribute('_placement0', 'vec4'), attribute('_placement1', 'vec4'), attribute('_placement2', 'vec4'), attribute('_placement3', 'vec4'));
      positionLocal.assign(matrix.mul(positionLocal).xyz);
      // Settled bodies change placement only on insertion/removal. Inverting
      // this matrix per vertex penalizes every restored head, hand and leg.
      normalLocal.assign(corpseNormals
        ? mat3(attribute('_placementNormal0', 'vec3'), attribute('_placementNormal1', 'vec3'), attribute('_placementNormal2', 'vec3')).mul(normalLocal).normalize()
        : transformNormal(normalLocal, matrix));
      instanceColor.assign(attribute('_placementColor', 'vec3'));
      return previous ?? positionLocal;
    })();
    const owned = material;
    source.addEventListener('dispose', () => owned.dispose()); materials.set(source, material);
  }
  const original = mesh.geometry, geometry = new BufferGeometry();
  // CPU arrays are immutable and can be borrowed. Attribute wrappers own their
  // GPU buffers: retiring one LOD must not delete another LOD's live bindings.
  const buffers = new Map<InterleavedBuffer, InterleavedBuffer>();
  for (const [name, input] of Object.entries(original.attributes)) {
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
  // Keep the normal columns in the existing placement buffer: an additional
  // vertex buffer would exceed WebGPU's eight-buffer default on some layouts.
  const matrix = new InstancedInterleavedBuffer(corpseNormals ? new Float32Array(mesh.instanceMatrix.count * 25) : mesh.instanceMatrix.array, corpseNormals ? 25 : 16, 1);
  for (let i = 0; i < 4; i++) geometry.setAttribute(`_placement${i}`, new InterleavedBufferAttribute(matrix, 4, i * 4));
  if (corpseNormals) for (let i = 0; i < 3; i++) geometry.setAttribute(`_placementNormal${i}`, new InterleavedBufferAttribute(matrix, 3, 16 + i * 3));
  geometry.setAttribute('_placementColor', mesh.instanceColor!);
  const placement = corpseNormals ? new Matrix4() : null, normal = corpseNormals ? new Matrix3() : null;
  let copiedVersion = -1;
  const before = mesh.onBeforeRender;
  mesh.onBeforeRender = function (...args) {
    if (corpseNormals) {
      if (copiedVersion !== mesh.instanceMatrix.version) {
        for (let i = 0; i < mesh.count; i++) {
          const offset = i * 25;
          for (let j = 0; j < 16; j++) matrix.array[offset + j] = mesh.instanceMatrix.array[i * 16 + j];
          normal!.getNormalMatrix(placement!.fromArray(mesh.instanceMatrix.array, i * 16));
          matrix.array.set(normal!.elements, offset + 16);
        }
        matrix.version = copiedVersion = mesh.instanceMatrix.version;
        matrix.clearUpdateRanges(); mesh.instanceMatrix.clearUpdateRanges();
      }
    } else {
      matrix.version = mesh.instanceMatrix.version;
      matrix.clearUpdateRanges(); matrix.updateRanges.push(...mesh.instanceMatrix.updateRanges); mesh.instanceMatrix.clearUpdateRanges();
    }
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
