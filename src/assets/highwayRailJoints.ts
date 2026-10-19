import { BoxGeometry, Mesh, type Material, type Object3D } from 'three';
import { highwayJointSegments } from '../levels/L3/highway';

/** Add the integral concrete joins to every LOD of the shipped L3 ramp. */
export function addHighwayRailJoints(root: Object3D, material: Material): BoxGeometry[] {
  return highwayJointSegments.flatMap(joint => {
    const name = `highway-joint-${joint.side}`;
    if (root.getObjectByName(name)) return [];
    const geometry = new BoxGeometry(joint.length, .95, .7), mesh = new Mesh(geometry, material);
    mesh.name = name; mesh.position.set(joint.x, 6.175, joint.z); mesh.rotation.y = joint.yaw;
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    return [geometry];
  });
}
