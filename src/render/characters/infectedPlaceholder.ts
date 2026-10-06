import { BoxGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { createSurvivorPlaceholder } from './placeholder';
import { palette } from '../../data/palette';
/** Palette/code fallback with the existing rigid-part contract. No reference art is required. */
export function createInfectedPlaceholder(role: string): Group {
  const root = createSurvivorPlaceholder('male'); root.name = 'root';
  const shirt = role === 'nurse' ? '#ece2d7' : role === 'hazmat' ? '#d7ac2e' : role === 'firefighter' ? '#ce8d28' : role === 'riot' ? '#334769' : role === 'screamer' ? '#6a5285' : '#785a45';
  root.getObjectByName('backpackSocket')!.clear();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const material = node.material as MeshBasicMaterial;
    if (material.name === 'pal_survivorRed') { material.color.set(shirt); material.name = 'pal_infectedShirt'; }
    else if (material.color.getHexString() === 'e8b598') { material.color.set(palette.infectedSkin); material.name = 'pal_infectedSkin'; }
  });
  const head = root.getObjectByName('head')!;
  for (const z of [-0.085, 0.085]) {
    const material = new MeshBasicMaterial({ color: palette.infectedEye }); material.name = 'emi_infectedEye';
    const eye = new Mesh(new SphereGeometry(0.045, 8, 6), material); eye.position.set(0.185, 0.025, z); head.add(eye);
  }
  if (role === 'riot') { const shield = new Mesh(new BoxGeometry(0.08, 0.85, 0.58), new MeshBasicMaterial({ color: '#243149' })); shield.position.set(0.28, 0.08, 0); root.getObjectByName('armL')!.add(shield); }
  if (['brute', 'bloated', 'butcher', 'gorilla'].includes(role)) root.scale.set(1.4, 1.25, 1.5);
  if (['dog', 'cat', 'lion', 'gorilla', 'crow', 'flamingo'].includes(role)) {
    const hip = root.getObjectByName('hip')!, torso = root.getObjectByName('torso')!;
    hip.position.y = role === 'gorilla' ? 0.75 : role === 'flamingo' ? 0.8 : 0.4; torso.rotation.z = -Math.PI / 2;
    head.position.y = 0.6;
    if (role === 'cat' || role === 'crow') root.scale.setScalar(role === 'cat' ? 0.55 : 0.3);
    if (role === 'lion') root.scale.setScalar(1.4);
    const tail = new Mesh(new BoxGeometry(0.45, 0.07, 0.07), new MeshBasicMaterial({ color: '#785a45' })); tail.position.set(-0.35, 0, 0); hip.add(tail);
    if (role === 'crow') {
      for (const side of ['L', 'R']) { const wing = new Mesh(new BoxGeometry(0.4, 0.05, 0.65), new MeshBasicMaterial({ color: '#25222c' })); wing.position.z = side === 'L' ? -0.2 : 0.2; root.getObjectByName(`arm${side}`)!.add(wing); }
    }
  }
  return root;
}
