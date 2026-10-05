import { BoxGeometry, CapsuleGeometry, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { color, positionLocal, mix } from 'three/tsl';
import type { AssetDef } from './types';

/** Contract-complete placeholders keep gameplay independent of art status. */
export function placeholder(def: AssetDef): Group {
  const root = new Group(); root.name = def.id; root.userData.placeholder = true;
  const material = new MeshBasicNodeMaterial();
  material.name = 'asset.placeholder'; material.userData.placeholder = true;
  material.colorNode = mix(color('#777777'), color('#ff00cc'), positionLocal.x.add(positionLocal.y).mul(12).sin().step(0));
  const { x, y, z } = def.dimensions;
  const body = new Mesh(new BoxGeometry(x, y, z), material); body.position.y = y / 2; body.name = 'placeholderBody'; root.add(body);
  const names = new Set([...def.requiredNodes, ...def.animatedNodes, ...def.sockets, ...def.frontNodes]);
  for (const name of names) {
    const node = new Group(); node.name = name;
    if (/wheel/.test(name)) node.position.set(name.includes('F') ? x * .3 : -x * .3, y * .18, name.endsWith('L') ? z / 2 : -z / 2);
    else if (/head|siren/.test(name)) node.position.y = y * .8;
    else if (/arm|hand|foreArm/i.test(name)) node.position.set(0, y * .65, name.endsWith('L') ? z * .6 : -z * .6);
    else if (/leg|shin|foot/i.test(name)) node.position.set(0, y * .25, name.endsWith('L') ? z * .3 : -z * .3);
    else node.position.y = y / 2;
    if (def.frontNodes.includes(name)) node.position.x = x / 2;
    if (name.startsWith('stump_')) {
      const cap = new Mesh(new CapsuleGeometry(.08, .01, 2, 8), material);
      node.add(cap); node.visible = false; node.userData.hidden = true;
    } else if (def.animatedNodes.includes(name)) node.add(new Mesh(new BoxGeometry(.05, .05, .05), material));
    root.add(node);
  }
  return root;
}
