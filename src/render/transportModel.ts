import { BoxGeometry, DoubleSide, BufferAttribute, Color, Group, Matrix4, Mesh, MeshLambertNodeMaterial, PlaneGeometry, type Object3D } from 'three/webgpu';
import { attribute, uniform, vec4, positionGeometry } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { VehicleDef } from '../data/vehicles';
/** The armed set-piece base remains a usable transport derivative on every LOD. */
export function prepareTransportModel(model: Object3D, def: VehicleDef): void {
  if (!def.transport) return;
  for (const name of ['turret', 'gun', 'muzzle']) model.getObjectByName(name)?.removeFromParent();
  for (const [i, position] of def.transport.seats.entries()) {
    if (model.getObjectByName(`passenger${i}`)) continue;
    const seat = new Group(); seat.name = `passenger${i}`;
    seat.position.set(position.x, position.y, position.z); model.add(seat);
  }
}
/** Older APC shells have a sealed cab. Open the cab and animate its doors using E09's pivots.
 * Authored translucent cab variants own their presentation and bypass this fallback. */
export function openTransportCab(model: Object3D, def: VehicleDef): void {
  if (!def.transport) return;
  let glazed = false;
  model.traverse(node => { if (node instanceof Mesh && (Array.isArray(node.material) ? node.material : [node.material]).some(m => m.transparent && m.opacity < .4)) glazed = true; });
  if (glazed) return;
  for (const [name, side] of [['exitL', 1], ['exitR', -1]] as const) model.getObjectByName(name)?.position.set(def.doorX, 0, side * (def.width / 2 + .55));
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert();
  model.getObjectByName('body')!.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const local = uniform(new Matrix4().multiplyMatrices(inverse, node.matrixWorld)).mul(vec4(positionGeometry, 1)).xyz;
    const cab = local.x.greaterThan(.15).and(local.x.lessThan(1.3)).and(local.y.greaterThan(1.65)).and(local.z.abs().lessThan(1.3));
    const doorway = local.x.sub(def.doorX).abs().lessThan(.48).and(local.y.greaterThan(.55)).and(local.y.lessThan(2.25)).and(local.z.abs().greaterThan(1.1));
    for (const m of Array.isArray(node.material) ? node.material : [node.material]) {
      const material = m as MeshLambertNodeMaterial;
      material.opacityNode = uniform(material.opacity).mul(cab.or(doorway).select(0, 1)); material.alphaTest = .5;
    }
  });
  // Roof and door glazing share one vertex-opacity material (four APC materials including its lamps).
  const doorMaterial = Object.assign(new MeshLambertNodeMaterial({ vertexColors: true, side: DoubleSide, transparent: true, depthWrite: false, opacityNode: attribute('cabOpacity', 'float') }), { emissiveNode: attribute('cabCrack', 'float').mul(.16) }); doorMaterial.forceSinglePass = true;
  const roofGeometry = new PlaneGeometry(1.15, 1.96).rotateX(-Math.PI / 2).translate(.725, 2.25, 0);
  const roofColor = new Color('#568e8d').toArray(), count = roofGeometry.getAttribute('position').count;
  roofGeometry.setAttribute('color', new BufferAttribute(new Float32Array(Array.from({ length: count }, () => roofColor).flat()), 3));
  roofGeometry.setAttribute('cabCrack', new BufferAttribute(new Float32Array(count), 1));
  roofGeometry.setAttribute('cabOpacity', new BufferAttribute(new Float32Array(count).fill(.22), 1));
  const roof = new Mesh(roofGeometry, doorMaterial); roof.name = 'transportRoof'; roof.userData.transportCabPart = true; model.add(roof);
  for (const [side, name] of [[1, 'doorL'], [-1, 'doorR']] as const) {
    const door = new Group(); door.name = name; door.position.set(def.doorX + .48, .55, side * 1.245); model.add(door);
    const panel = new BoxGeometry(.96, 1.1, .045).translate(-.48, .55, 0);
    const pane = new PlaneGeometry(.96, .6); if (side < 0) pane.rotateY(Math.PI); pane.translate(-.48, 1.4, side * .025);
    for (const [geometry, swatch, opacity] of [[panel, '#7b8250', 1], [pane, '#568e8d', .22]] as const) {
      const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), color = new Color(swatch).toArray();
      for (let i = 0; i < count; i++) colors.set(color, i * 3);
      geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometry.setAttribute('cabOpacity', new BufferAttribute(new Float32Array(count).fill(opacity), 1));
    }
    // One draw per animated door, including glazing, keeps the rare APC within its authored draw budget.
    const geometry = mergeGeometries([panel, pane])!; panel.dispose(); pane.dispose();
    const mesh = new Mesh(geometry, doorMaterial); mesh.userData.transportCabPart = true; mesh.castShadow = mesh.receiveShadow = true; door.add(mesh);
  }
}

/** Runtime cab resources belong to the vehicle record, rather than the asset registry. */
export function disposeTransportCab(model: Object3D): void {
  const materials = new Set<import('three').Material>();
  model.traverse(node => { if (node instanceof Mesh && node.userData.transportCabPart) { node.geometry.dispose(); for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m); } });
  for (const material of materials) material.dispose();
}
