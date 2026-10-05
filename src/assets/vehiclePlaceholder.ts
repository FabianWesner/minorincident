import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicNodeMaterial, type Material } from 'three/webgpu';
import type { VehicleDef } from '../data/vehicles';
/** Contract-complete arcade vehicle used until the catalog asset is integrated. */
export function vehiclePlaceholder(def: VehicleDef, paint?: Material): Group {
  const root = new Group(); root.name = def.asset; root.userData.placeholder = true;
  const bodyMaterial = paint ?? new MeshBasicNodeMaterial({ color: def.emergency ? '#f2e6dc' : def.id === 'vehicle.school-bus' ? '#f2b630' : '#d9363e' });
  const dark = new MeshBasicNodeMaterial({ color: '#25222c' }), glass = new MeshBasicNodeMaterial({ color: '#2f6e6a' });
  const box = (name: string, x: number, y: number, z: number, px: number, py: number, pz: number, material: Material) => { const mesh = new Mesh(new BoxGeometry(x, y, z), material); mesh.name = name; mesh.position.set(px, py, pz); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh; };
  box('body', def.length, .6, def.width, 0, .7, 0, bodyMaterial);
  box('cabin', def.length * .52, .65, def.width * .88, -.15, 1.25, 0, glass);
  for (let i = 0; i < 4; i++) {
    const node = new Group(); node.name = ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'][i]; node.position.set(i < 2 ? def.wheelbase / 2 : -def.wheelbase / 2, def.wheelRadius, (i % 2 === 0 ? 1 : -1) * def.width * .4);
    const wheel = new Mesh(new CylinderGeometry(def.wheelRadius, def.wheelRadius, .22, 12), dark); wheel.rotation.x = Math.PI / 2; node.add(wheel); root.add(node);
  }
  box('lightsFront', .08, .18, def.width * .8, def.length / 2, .8, 0, new MeshBasicNodeMaterial({ color: '#ffc773' }));
  box('lightsBrake', .08, .18, def.width * .8, -def.length / 2, .8, 0, new MeshBasicNodeMaterial({ color: '#ff2d2d' }));
  for (const [name, z] of [['driverSeat', .35], ['exitL', def.width / 2 + .55], ['exitR', -def.width / 2 - .55]] as const) { const node = new Group(); node.name = name; node.position.set(.2, .7, z); root.add(node); }
  if (def.emergency) for (const [name, z, color] of [['sirenL', .3, '#ff2d2d'], ['sirenR', -.3, '#2f6bff']] as const) box(name, .5, .2, .4, 0, 1.68, z, new MeshBasicNodeMaterial({ color }));
  if (def.id === 'vehicle.fire-engine') box('ladder', def.length * .75, .12, .6, -.3, 1.9, 0, bodyMaterial);
  return root;
}
