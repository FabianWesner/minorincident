import { BoxGeometry, DoubleSide, BufferAttribute, Color, Group, Matrix4, Mesh, MeshLambertNodeMaterial, PlaneGeometry, type Object3D } from 'three/webgpu';
import { attribute, uniform, vec4, positionGeometry } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { VehicleDef } from '../data/vehicles';
/** The armed set-piece base remains a usable transport derivative on every LOD. */
export function prepareTransportModel(model: Object3D, def: VehicleDef): void {
  if (!def.transport) return;
  for (const name of ['turret', 'gun', 'muzzle']) model.getObjectByName(name)?.removeFromParent();
  for (const [i, position] of def.transport.seats.entries()) {
    let seat = model.getObjectByName(`passenger${i}`);
    if (!seat) {
      seat = new Group(); seat.name = `passenger${i}`;
      model.add(seat);
    }
    seat.position.set(position.x, position.y, position.z);
    // The closed troop bay has inward-facing benches along its sides. Facing
    // every passenger forwards sent the first row's knees into the front cab.
    if (def.id === 'vehicle.military-apc') seat.rotation.y = position.z > 0 ? Math.PI / 2 : -Math.PI / 2;
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
  const apc = def.id === 'vehicle.military-apc';
  const roofGeometry = new BoxGeometry(1.21, .06, apc ? 2.5 : 1.96).translate(.725, 2.25, 0);
  const roofColor = new Color(apc ? '#7b8250' : '#568e8d').toArray(), count = roofGeometry.getAttribute('position').count;
  roofGeometry.setAttribute('color', new BufferAttribute(new Float32Array(Array.from({ length: count }, () => roofColor).flat()), 3));
  roofGeometry.setAttribute('cabCrack', new BufferAttribute(new Float32Array(count), 1));
  // The APC roof is a finished armor panel, not a roof-off crew cutaway. Keep
  // its replacement panel opaque and add glazing at the front so the driver
  // remains readable through the windshield.
  roofGeometry.setAttribute('cabOpacity', new BufferAttribute(new Float32Array(count).fill(apc ? 1 : .22), 1));
  const roof = new Mesh(roofGeometry, doorMaterial); roof.name = 'transportRoof'; roof.userData.transportCabPart = true; model.add(roof);
  if (apc) {
    const windshield = new PlaneGeometry(2.42, .6).rotateY(Math.PI / 2).translate(1.3, 1.95, 0);
    const n = windshield.getAttribute('position').count;
    windshield.setAttribute('color', new BufferAttribute(new Float32Array(Array.from({ length: n }, () => roofColor).flat()), 3));
    windshield.setAttribute('cabCrack', new BufferAttribute(new Float32Array(n), 1));
    windshield.setAttribute('cabOpacity', new BufferAttribute(new Float32Array(n).fill(.22), 1));
    const glass = new Mesh(windshield, doorMaterial); glass.name = 'transportWindshield'; glass.userData.transportCabPart = true; model.add(glass);
    // Close the window edges against the replacement roof and existing front
    // armor. A floating pane still reads as a missing cab at close zoom.
    const posts = [-1.215, 1.215].map(z => new BoxGeometry(.08, .66, .07).translate(1.3, 1.95, z));
    posts.push(new BoxGeometry(.08, .07, 2.5).translate(1.3, 1.65, 0));
    const frame = mergeGeometries(posts)!; for (const p of posts) p.dispose();
    const frameCount = frame.getAttribute('position').count;
    frame.setAttribute('color', new BufferAttribute(new Float32Array(Array.from({ length: frameCount }, () => roofColor).flat()), 3));
    frame.setAttribute('cabCrack', new BufferAttribute(new Float32Array(frameCount), 1));
    frame.setAttribute('cabOpacity', new BufferAttribute(new Float32Array(frameCount).fill(1), 1));
    const trim = new Mesh(frame, doorMaterial); trim.name = 'transportWindowFrame'; trim.userData.transportCabPart = true; model.add(trim);
  }
  // Keep the sealed troop compartment separate from the opened driver cab.
  // Without its rear wall, the cab opening exposed disconnected fragments of
  // otherwise correctly seated troops behind the driver.
  const bulkheadGeometry = new BoxGeometry(.06, 1.39, 2.1).translate(.05, 1.495, 0);
  const bulkheadCount = bulkheadGeometry.getAttribute('position').count, bulkheadColor = new Color('#626945').toArray();
  bulkheadGeometry.setAttribute('color', new BufferAttribute(new Float32Array(Array.from({ length: bulkheadCount }, () => bulkheadColor).flat()), 3));
  bulkheadGeometry.setAttribute('cabCrack', new BufferAttribute(new Float32Array(bulkheadCount), 1));
  bulkheadGeometry.setAttribute('cabOpacity', new BufferAttribute(new Float32Array(bulkheadCount).fill(1), 1));
  const bulkhead = new Mesh(bulkheadGeometry, doorMaterial); bulkhead.name = 'transportBulkhead'; bulkhead.userData.transportCabPart = true; model.add(bulkhead);
  for (const [side, name] of [[1, 'doorL'], [-1, 'doorR']] as const) {
    const door = new Group(); door.name = name; door.position.set(def.doorX + .48, .55, side * 1.245); model.add(door);
    const panel = new BoxGeometry(.96, 1.1, .045).translate(-.48, .55, 0);
    const pane = new PlaneGeometry(.96, .6); if (side < 0) pane.rotateY(Math.PI); pane.translate(-.48, 1.4, side * .025);
    for (const [geometry, swatch, opacity] of [[panel, '#7b8250', 1], [pane, '#568e8d', .22]] as const) {
      const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), color = new Color(swatch).toArray();
      for (let i = 0; i < count; i++) colors.set(color, i * 3);
      geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometry.setAttribute('cabOpacity', new BufferAttribute(new Float32Array(count).fill(opacity), 1));
      // The shared door/roof material reads cabCrack on every mesh; doors never crack.
      geometry.setAttribute('cabCrack', new BufferAttribute(new Float32Array(count), 1));
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
