import { BoxGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
/** +X-forward, origin-at-grip placeholders obey the same socket contract as GLBs. */
export function actionPlaceholder(category: string): Group {
  const root = new Group(); root.name = 'root';
  const grip = new Group(); grip.name = 'grip'; root.add(grip);
  const material = new MeshBasicMaterial({ color: category === 'throwable' ? '#e28b43' : '#ffd166' }); material.name = 'pal_woodWarm';
  const body = new Mesh(category === 'throwable' || category === 'ability' ? new SphereGeometry(0.12, 10, 6) : new BoxGeometry(category === 'ranged' ? 0.5 : 0.8, 0.09, 0.09), material);
  body.name = 'body'; body.position.x = category === 'melee' ? 0.35 : category === 'ranged' ? 0.2 : 0; root.add(body);
  const socket = new Group(); socket.name = category === 'ranged' ? 'muzzle' : 'tip'; socket.position.x = category === 'ranged' ? 0.45 : 0.75; root.add(socket);
  return root;
}
