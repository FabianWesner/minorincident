import { BoxGeometry, CapsuleGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { palette } from '../../data/palette';
import type { SurvivorVariant } from '../../data/survivor';

/** Code fallback with the same rigid-part pivots and sockets as the supplied GLBs; +X forward. */
export function createSurvivorPlaceholder(variant: SurvivorVariant): Group {
  const root = new Group(); root.name = 'root';
  const joint = (name: string, parent: Group, x: number, y: number, z: number): Group => { const node = new Group(); node.name = name; node.position.set(x, y, z); parent.add(node); return node; };
  const part = (parent: Group, size: [number, number, number], pos: [number, number, number], color: string): void => {
    const material = new MeshBasicMaterial({ color }); material.name = color === palette.survivorRed ? 'pal_survivorRed' : color === palette.backpackTeal ? 'pal_backpackTeal' : 'keep_placeholder';
    const mesh = new Mesh(new BoxGeometry(...size), material); mesh.position.set(...pos); parent.add(mesh);
  };
  const hip = joint('hip', root, 0, 0.65, 0), torso = joint('torso', hip, 0, 0.03, 0);
  part(hip, [0.2, 0.14, 0.3], [0, 0, 0], variant === 'female' ? '#4278ad' : '#845336');
  const body = new Mesh(new CapsuleGeometry(0.16, 0.16, 4, 8), new MeshBasicMaterial({ color: palette.survivorRed }));
  body.material.name = 'pal_survivorRed'; body.position.y = 0.2; torso.add(body);
  const head = joint('head', torso, 0, 0.52, 0);
  const face = new Mesh(new SphereGeometry(0.2, 12, 8), new MeshBasicMaterial({ color: '#e8b598' })); head.add(face);
  const bag = joint('backpackSocket', torso, -0.16, 0.22, 0); part(bag, [0.18, 0.32, 0.25], [-0.05, 0, 0], palette.backpackTeal);
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? -1 : 1;
    const arm = joint(`arm${side}`, torso, 0, 0.33, sign * 0.21);
    part(arm, [0.1, 0.2, 0.1], [0, -0.1, 0], palette.survivorRed);
    const fore = joint(`foreArm${side}`, arm, 0, -0.2, 0); part(fore, [0.09, 0.18, 0.09], [0, -0.09, 0], '#e8b598');
    const hand = joint(`hand${side}`, fore, 0, -0.18, 0); part(hand, [0.1, 0.08, 0.1], [0, -0.04, 0], '#e8b598'); joint(`weaponSocket${side}`, hand, 0.05, -0.04, 0);
    const leg = joint(`leg${side}`, hip, 0, -0.05, sign * 0.1); part(leg, [0.12, 0.24, 0.12], [0, -0.12, 0], variant === 'female' ? '#4278ad' : '#845336');
    const shin = joint(`shin${side}`, leg, 0, -0.24, 0); part(shin, [0.11, 0.27, 0.11], [0, -0.135, 0], '#845336');
    const foot = joint(`foot${side}`, shin, 0, -0.27, 0); part(foot, [0.22, 0.09, 0.14], [0.04, -0.045, 0], palette.survivorRed);
  }
  return root;
}
