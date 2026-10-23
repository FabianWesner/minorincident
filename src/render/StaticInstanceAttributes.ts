import { BufferAttribute, BufferGeometry, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBuffer, InterleavedBufferAttribute, type InstancedMesh, type Node } from 'three/webgpu';
import { attribute, Fn, instanceColor, mat3, mat4, normalLocal, positionLocal, transformNormal } from 'three/tsl';
import { PaletteMaterial } from './PaletteMaterial';

const materials = new WeakMap<PaletteMaterial, PaletteMaterial>();
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
    material.userData.fixedStaticPosition = source.positionNode === null;
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
