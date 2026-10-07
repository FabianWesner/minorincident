import { AmbientLight, Color, DirectionalLight, GridHelper, Group, Mesh, MeshLambertMaterial, OrthographicCamera, PlaneGeometry, Scene, Vector3, WebGLRenderer, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { alignSkeleton } from '../../src/render/characters/skin';
import { resolveRig } from '../../src/render/characters/rig';
import type { Recording } from './record';

// Passive playback of recorded production CharacterView poses; no alternate animator.
const params = new URLSearchParams(location.search), variant = params.get('variant') ?? 'female', scenario = params.get('scenario') ?? 'walk';
const labels = [params.get('before') ?? 'before', params.get('after') ?? 'after'];
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(innerWidth, innerHeight); document.body.append(renderer.domElement);
const camera = new OrthographicCamera(), loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const unpack = (node: Object3D, value: number[]) => { node.position.fromArray(value); node.quaternion.fromArray(value, 3); };
const sides = await Promise.all(labels.map(async label => {
  const data = await (await fetch(`/recordings/${label}/${variant}-${scenario}.json`)).json() as Recording;
  const scene = new Scene(); scene.background = new Color('#bcc8ce'); scene.add(new AmbientLight('#d5d9f0', 2));
  const light = new DirectionalLight('#fff1d5', 2.5); light.position.set(4, 8, 6); scene.add(light);
  const floor = new Mesh(new PlaneGeometry(150, 150), new MeshLambertMaterial({ color: '#819890' })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.005; scene.add(floor);
  const grid = new GridHelper(100, 200, '#5c7b73', '#9daea5'); grid.position.y = .002; scene.add(grid);
  const model = (await loader.loadAsync(`/assets/models/char.courier-${variant}${data.skin ? '.skin' : ''}.glb`)).scene;
  if (data.skin) alignSkeleton(model);
  const rig = resolveRig(model), actor = new Group(); actor.add(model); scene.add(actor);
  const bike = (await loader.loadAsync('/assets/models/veh.courier-bike.glb')).scene; bike.scale.setScalar(.6); scene.add(bike);
  const bat = (await loader.loadAsync('/assets/models/wpn.baseball-bat.glb')).scene; bat.updateMatrixWorld(true); bat.position.sub(bat.getObjectByName('grip')!.getWorldPosition(new Vector3())); rig.weaponSocketR.add(bat); bat.visible = scenario === 'bat';
  const tags: HTMLElement[] = [];
  for (let row = 0; row < 2; row++) { const tag = document.createElement('div'); tag.className = 'label'; tag.style.left = `${labels.indexOf(label) * 50}%`; tag.style.top = `${row * 50}%`; document.querySelector('#labels')!.append(tag); tags.push(tag); }
  return { data, actor, rig, bike, scene, tags };
}));
function frame(index: number) {
  renderer.setScissorTest(true);
  for (let col = 0; col < 2; col++) {
    const { data, actor, rig, bike, scene, tags } = sides[col], f = data.frames[Math.min(index, data.frames.length - 1)];
    unpack(actor, f.actor); for (const [name, v] of Object.entries(f.joints)) unpack(rig[name as keyof typeof rig], v);
    bike.visible = !!f.bike; if (f.bike) { unpack(bike, f.bike); bike.getObjectByName('crank')!.rotation.z = -f.pedal; bike.getObjectByName('handlebar')!.rotation.y = f.steer; }
    const center = actor.position.clone(); center.y = .78;
    for (let row = 0; row < 2; row++) {
      const w = innerWidth / 2, h = innerHeight / 2, extent = scenario === 'bike' ? 1.6 : 1.08;
      camera.left = -extent * w / h; camera.right = extent * w / h; camera.top = extent; camera.bottom = -extent; camera.near = .1; camera.far = 200; camera.updateProjectionMatrix();
      camera.position.copy(center).add(row === 0 ? new Vector3(0, .08, 10) : new Vector3().setFromSphericalCoords(10, Math.PI * .30, Math.PI / 4)); camera.lookAt(center); camera.updateMatrixWorld();
      renderer.setViewport(col * w, (1 - row) * h, w, h); renderer.setScissor(col * w, (1 - row) * h, w, h); renderer.render(scene, camera);
      const tag = tags[row];
      tag.textContent = `${data.label} · ${variant} · ${scenario} · ${row ? 'game angle (close)' : 'side'} · ${(f.tick / 60).toFixed(2)} s`;
    }
  }
}
Object.assign(window, { __PLAYER_ANIM__: { frame, frames: sides[0].data.frames.length } }); frame(0);
