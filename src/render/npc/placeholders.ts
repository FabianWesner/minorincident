import { BoxGeometry, CapsuleGeometry, ConeGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { createSurvivorPlaceholder } from '../characters/placeholder';
import { disposeCharacter } from '../characters/rig';
/** Civilian clothes retain E07's mapped shirt colors, without survivor equipment or gore. */
export function createCivilianPlaceholder(): Group {
  const root = createSurvivorPlaceholder('male'), bag = root.getObjectByName('backpackSocket')!;
  for (const mesh of [...bag.children]) { bag.remove(mesh); disposeCharacter(mesh as Group); }
  root.traverse(n => { if (n instanceof Mesh) { const m = n.material as MeshBasicMaterial; if (m.name === 'pal_survivorRed') { m.color.set('#e5d9b9'); m.name = 'pal_infectedShirt'; } } });
  const head = root.getObjectByName('head')!;
  for (const z of [-.09, .09]) { const eye = new Mesh(new SphereGeometry(.036, 8, 6), new MeshBasicMaterial({ color: '#ff1d2f' })); (eye.material as MeshBasicMaterial).name = 'emi_eyes'; eye.position.set(.175, .02, z); head.add(eye); }
  // Visible branching marks on cheeks/forearms; the crowd shader reveals them as the body turns.
  const material = new MeshBasicMaterial({ color: '#422c68' }); material.name = 'keep_veins';
  for (const name of ['head', 'foreArmL', 'foreArmR']) for (let i = 0; i < 3; i++) {
    const mark = new Mesh(new BoxGeometry(.008, .09, .008), material); mark.position.set(name === 'head' ? .188 : .05, name === 'head' ? -.05 : -.07, (i - 1) * .024); mark.rotation.x = (i - 1) * .5; root.getObjectByName(name)!.add(mark);
  }
  return root;
}
/** Asset contract fallback for char.corgi: +X, squat orange/cream body, upright ears and teal pack. */
export function createCorgiPlaceholder(): Group {
  const root = new Group(); root.name = 'root';
  const joint = (name: string, parent: Group, position: [number, number, number]) => { const g = new Group(); g.name = name; g.position.set(...position); parent.add(g); return g; };
  const orange = new MeshBasicMaterial({ color: '#e6a163' }), cream = new MeshBasicMaterial({ color: '#fff0d0' }), dark = new MeshBasicMaterial({ color: '#302539' }), teal = new MeshBasicMaterial({ color: '#2f6e6a' });
  const box = (parent: Group, size: [number, number, number], position: [number, number, number], material: MeshBasicMaterial) => { const mesh = new Mesh(new BoxGeometry(...size), material); mesh.position.set(...position); parent.add(mesh); };
  const body = joint('body', root, [0, .3, 0]); const trunk = new Mesh(new CapsuleGeometry(.18, .42, 4, 8), orange); trunk.rotation.z = Math.PI / 2; body.add(trunk);
  box(body, [.25, .12, .3], [.2, -.12, 0], cream);
  const head = joint('head', body, [.38, .08, 0]); box(head, [.3, .29, .32], [0, 0, 0], orange); box(head, [.14, .12, .22], [.19, -.055, 0], cream); box(head, [.06, .05, .1], [.27, -.02, 0], dark);
  for (const z of [-.1, .1]) { const ear = new Mesh(new ConeGeometry(.12, .27, 3), orange); ear.scale.z = .45; ear.position.set(-.03, .25, z); head.add(ear); box(head, [.02, .035, .035], [.155, .055, z], dark); }
  box(head, [.31, .055, .34], [0, -.15, 0], new MeshBasicMaterial({ color: '#bd4349' }));
  box(head, [.022, .14, .055], [.16, .065, 0], cream);
  const tag = new Mesh(new SphereGeometry(.04, 8, 6), new MeshBasicMaterial({ color: '#ffcb63' })); tag.position.set(.2, -.18, 0); head.add(tag);
  const tail = joint('tail', body, [-.4, .04, 0]); box(tail, [.2, .09, .09], [-.08, 0, 0], orange);
  for (const [name, x, z] of [['legFL', .25, -.13], ['legFR', .25, .13], ['legBL', -.25, -.13], ['legBR', -.25, .13]] as const) { const leg = joint(name, body, [x, -.12, z]); box(leg, [.1, .15, .1], [0, -.075, 0], cream); }
  const pack = joint('packSocket', body, [0, .2, 0]); box(pack, [.29, .17, .32], [0, .035, 0], teal);
  joint('front', root, [.7, .3, 0]); return root;
}
