import { BufferAttribute, Matrix4, Vector3, Mesh, type Object3D, type BufferGeometry } from 'three';

/** Bend the native fingers around a horizontal handle; the wrist and palm stay attached.
 * Both the shader and Scene Lab use these same positions (no substitute hand mesh). */
export function gripPoint(point: Vector3): Vector3 {
  point.x *= .45;
  if (point.y < -.045 && point.y > -.2) {
    const angle = Math.min(Math.PI, (-.045 - point.y) / .035), x = point.x;
    point.x = .035 * (1 - Math.cos(angle)) + x * Math.cos(angle);
    point.y = -.045 - .035 * Math.sin(angle) + x * Math.sin(angle);
  }
  // Leave a skin margin around the handle's 1 cm radius, including between vertices.
  const dx = point.x - .035, dy = point.y + .045, distance = Math.hypot(dx, dy);
  if (distance < .018 && distance > 0) {
    point.x = .035 + dx * .018 / distance; point.y = -.045 + dy * .018 / distance;
  }
  return point;
}

/** Split only hand triangles before curling, so a broad palm triangle cannot bridge
 * the handle hole. Interpolate native attributes; the rest of the body is unchanged. */
function subdivideHand(geometry: BufferGeometry, handPart: number): void {
  const attributes = Object.entries(geometry.attributes), parts = geometry.getAttribute('_part_index'), skin = geometry.getAttribute('_shirt');
  const positionIndex = attributes.findIndex(([name]) => name === 'position');
  const vertex = (i: number) => attributes.map(([, attribute]) => Array.from({ length: attribute.itemSize }, (_, c) => attribute.getComponent(i, c)));
  type Vertex = number[][];
  const midpoint = (a: Vertex, b: Vertex): Vertex => a.map((values, i) => values.map((v, c) => (v + b[i][c]) / 2));
  const hands = new Map<number, Vertex[]>();
  let handVertices = 0;
  const emit = (output: Vertex[], a: Vertex, b: Vertex, c: Vertex, depth = 0): void => {
    const vertices = [a, b, c], distances = vertices.map((v, i) => Math.hypot(...v[positionIndex].map((p, k) => p - vertices[(i + 1) % 3][positionIndex][k])));
    if (Math.max(...distances) > .008 && depth < 6) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      emit(output, a, ab, ca, depth + 1); emit(output, ab, b, bc, depth + 1); emit(output, ca, bc, c, depth + 1); emit(output, ab, bc, ca, depth + 1);
    } else output.push(...vertices);
  };
  for (let i = 0; i < parts.count; i += 3) if (parts.getX(i) === handPart && skin.getX(i) < 0) {
    const output: Vertex[] = []; emit(output, vertex(i), vertex(i + 1), vertex(i + 2));
    hands.set(i, output); handVertices += output.length - 3;
  }
  // Copy the unchanged body directly. Only the hand needs interpolated vertices;
  // expanding every body attribute into nested JS arrays dominated cold loads.
  const count = parts.count + handVertices;
  attributes.forEach(([name, attribute], attr) => {
    const size = attribute.itemSize, output = new Float32Array(count * size);
    let offset = 0, from = 0;
    const copy = (to: number) => {
      if (!attribute.normalized && !('isInterleavedBufferAttribute' in attribute)) {
        output.set(attribute.array.subarray(from * size, to * size), offset);
        offset += (to - from) * size;
      } else for (let v = from; v < to; v++) for (let c = 0; c < size; c++) output[offset++] = attribute.getComponent(v, c);
    };
    for (const [triangle, vertices] of hands) {
      copy(triangle);
      for (const v of vertices) { output.set(v[attr], offset); offset += size; }
      from = triangle + 3;
    }
    copy(parts.count);
    geometry.setAttribute(name, new BufferAttribute(output, size));
  });
}

export function prepareGrip(geometry: BufferGeometry, handPart: number): void {
  subdivideHand(geometry, handPart);
  const positions = geometry.getAttribute('position'), parts = geometry.getAttribute('_part_index'), skin = geometry.getAttribute('_shirt');
  const values = new Float32Array(positions.count * 3), point = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const hand = parts.getX(i) === handPart && skin.getX(i) < 0;
    if (hand) gripPoint(point);
    point.toArray(values, i * 3);
  }
  geometry.setAttribute('_gripPosition', new BufferAttribute(values, 3));
}

/** Keep the grip upright in the figure's frame while its wrist follows the displayed pose. */
export function uprightHand(pose: Float32Array, handPart: number, matrix: Matrix4): void {
  const offset = handPart * 16;
  matrix.fromArray(pose, offset);
  const e = matrix.elements, scale = Math.hypot(e[0], e[1], e[2]);
  matrix.makeScale(scale, scale, scale).setPosition(pose[offset + 12], pose[offset + 13], pose[offset + 14]).toArray(pose, offset);
}

/** The indexed triangles actually submitted after LOD reduction. */
export function handTriangles(geometry: BufferGeometry, handPart: number, gripped = true): Float32Array {
  const positions = geometry.getAttribute(gripped ? '_gripPosition' : 'position'), parts = geometry.getAttribute('_part_index'), skin = geometry.getAttribute('_shirt'), indices = geometry.index;
  const values: number[] = [];
  for (let i = 0; i < (indices?.count ?? positions.count); i++) {
    const v = indices ? indices.getX(i) : i;
    if (parts.getX(v) === handPart && skin.getX(v) < 0) values.push(positions.getX(v), positions.getY(v), positions.getZ(v));
  }
  return new Float32Array(values);
}

/** Flat props meet the fingertips of each native silhouette with a 1 mm skin margin. */
export function gripReach(hand: Float32Array): number {
  let reach = -Infinity;
  for (let i = 0; i < hand.length; i += 3) reach = Math.max(reach, hand[i]);
  return Number.isFinite(reach) ? reach + .001 : .07;
}

/** The elderly asset carries a baked cane; routines supply the one visible cane. */
export function removeAuthoredCane(root: Object3D): void {
  const hand = root.getObjectByName('handR'), remove: Object3D[] = [];
  hand?.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.every(material => !/^(pal_)?skin/.test(material.name))) remove.push(node);
  });
  for (const node of remove) node.removeFromParent();
}
