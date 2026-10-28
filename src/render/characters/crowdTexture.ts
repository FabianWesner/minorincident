import { InterleavedBuffer, InterleavedBufferAttribute, Mesh, type BufferGeometry, type Object3D, type Texture } from 'three';

/** Shared shader graphs bind each living or frozen page's own atlas before drawing.
 * Keep live resources outside serializable geometry metadata. */
export interface CrowdSurfaceBinding { bind(): void; textures: Texture[] }
export const crowdSurfaceBindings = new WeakMap<BufferGeometry, CrowdSurfaceBinding>();

/** A crowd draws one opaque atlas. All of its source parts must share that map. */
export function crowdTexture(root: Object3D): Texture | undefined {

  let atlas: Texture | undefined;
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const map = (material as typeof material & { map?: Texture }).map;
      if (!map) continue;
      if (atlas && atlas !== map) throw new Error('Crowd requires one shared base-colour atlas');
      atlas = map;
    }
  });
  if (!atlas) throw new Error('Textured crowd has no base-colour atlas');
  return atlas;
}
/** One static buffer leaves room for matrix and instance state on both backends. */
export function interleaveTexturedCrowd(geometry: BufferGeometry): void {
  if (geometry.hasAttribute('uv')) interleaveCrowdSurface(geometry);
}
/** Interleave the immutable per-vertex surface (whichever of position/normal/color/uv/_parts/_skin exist) into one
 * buffer. Frozen corpse pages bind placement, colour and three instance channels on top (Q-201: <= 7 buffers). */
export function interleaveCrowdSurface(geometry: BufferGeometry): void {
  const names = ['position', 'normal', 'color', 'uv', '_parts', '_skin'].filter(name => geometry.hasAttribute(name));
  const attributes = names.map(name => geometry.getAttribute(name));
  const stride = attributes.reduce((sum, a) => sum + a.itemSize, 0);
  const buffer = new InterleavedBuffer(new Float32Array(attributes[0].count * stride), stride);
  let offset = 0;
  attributes.forEach((a, channel) => {
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) buffer.array[i * stride + offset + c] = a.getComponent(i, c);
    geometry.setAttribute(names[channel], new InterleavedBufferAttribute(buffer, a.itemSize, offset));
    offset += a.itemSize;
  });
}
