/** CPU ray proof of cab construction; visual approval still belongs to Browser QA. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3, DoubleSide } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { vehicleDef } from '../../src/data/vehicles';
import { openTransportCab } from '../../src/render/transportModel';
const bytes = readFileSync('public/assets/models/veh.military-apc.unarmed.glb');
const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const before = scene.clone(true);
const oldRoof = new Mesh(new BoxGeometry(1.21, .06, 2.5).translate(.725, 2.25, 0), new MeshBasicMaterial());
oldRoof.name = 'transportRoof'; before.add(oldRoof);
openTransportCab(scene, vehicleDef('vehicle.military-apc'));
const rows = [];
for (const [label, model] of [['before', before], ['after', scene]] as const) {
  model.updateMatrixWorld(true);
  model.traverse(node => { if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.side = DoubleSide; });
  const body = model.getObjectByName('body')!;
  const bodyMeshes = new Set(); body.traverse(node => bodyMeshes.add(node));
  for (const { azimuth, radius, targetY } of [{ azimuth: 45, radius: 28.5, targetY: 0 }, { azimuth: 80, radius: 7, targetY: 1 }, { azimuth: 110, radius: 7, targetY: 1 }]) for (const height of [1.9, 2, 2.1]) {
    const angle = azimuth * Math.PI / 180, polar = 54 * Math.PI / 180;
    const camera = new Vector3(radius * Math.sin(polar) * Math.sin(angle), targetY + radius * Math.cos(polar), radius * Math.sin(polar) * Math.cos(angle));
    const eye = new Vector3(.71, height, .46), direction = camera.clone().sub(eye).normalize();
    const hits = new Raycaster(eye, direction, 0, eye.distanceTo(camera)).intersectObject(model, true);
    const opaque = [], glazing = [];
    for (const hit of hits) {
      const p = hit.point, mesh = hit.object as Mesh;
      if (bodyMeshes.has(mesh) && p.x > .15 && p.x < (label === 'before' ? 1.3 : 2.25) && p.y > 1.65 && Math.abs(p.z) < 1.3) continue;
      const opacity = mesh.geometry.getAttribute('cabOpacity');
      const alpha = opacity && hit.face ? (opacity.getX(hit.face.a) + opacity.getX(hit.face.b) + opacity.getX(hit.face.c)) / 3 : 1;
      const cell = { name: mesh.name || 'original-body', at: hit.point.toArray() };
      if (alpha < .4) glazing.push(cell); else opaque.push(cell);
    }
    rows.push({ label, azimuth, radius, height, opaque, glazing, clear: opaque.length === 0 && glazing.length > 0 });
  }
}
const passed = rows.filter(row => row.label === 'after').every(row => row.clear);
const roof = scene.getObjectByName('transportRoof') as Mesh;
const roofOpaque = Array.from(roof.geometry.getAttribute('cabOpacity').array).every(value => value === 1);
mkdirSync('docs/reports/r15-qafix', { recursive: true });
writeFileSync('docs/reports/r15-qafix/apc-geometry.json', JSON.stringify({ scope: 'CPU geometry rays from approximate seated eye to the gameplay angle and two QA close cameras; no rendered/visual claim', modelSha256: createHash('sha256').update(bytes).digest('hex'), cabCodeSha256: createHash('sha256').update(readFileSync('src/render/transportModel.ts')).digest('hex'), passed, roofOpaque, rows }, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ opaque, glazing, ...row }) => ({ ...row, opaque: opaque.map(hit => hit.name), glazing: glazing.map(hit => hit.name) }))));
if (!passed || !roofOpaque) process.exitCode = 1;
