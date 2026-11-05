import { Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, WebGPURenderer } from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { weatherSurface, trackMask } from '../../src/render/WeatherView';
import { rasterFootprints } from '../../src/render/FootprintMask';
const renderer = new WebGPURenderer({ forceWebGL: true, antialias: true });
await renderer.init(); renderer.setSize(400, 400); document.body.append(renderer.domElement);
weatherSurface.trackCenter.value.set(0, 0);
rasterFootprints(weatherSurface.tracks.image.data as Uint8Array, [{ id: 1, x: 0, y: 6, z: 0, yaw: 0, tick: 0, length: .28, paw: false, side: 1 }], 0, 0, 0);
weatherSurface.tracks.needsUpdate = true;
const scene = new Scene(), material = new MeshBasicNodeMaterial(); material.colorNode = vec3(trackMask());
const mesh = new Mesh(new PlaneGeometry(.8, .8), material); scene.add(mesh);
const camera = new OrthographicCamera(-.4, .4, .4, -.4, .1, 20); camera.up.set(0, 0, -1);
Object.assign(window, { renderProof: async (kind: string) => {
  const x = kind === 'repeated' ? 64 : 0, y = kind === 'ground' ? 0 : 6;
  mesh.position.set(x, y, 0); mesh.rotation.set(-Math.PI / 2, 0, 0);
  camera.up.set(0, 0, -1); camera.position.set(x, y + 2, 0); camera.lookAt(x, y, 0);
  if (kind === 'wall') { mesh.rotation.set(0, 0, 0); camera.up.set(0, 1, 0); camera.position.set(0, y, 2); camera.lookAt(0, y, 0); }
  await renderer.renderAsync(scene, camera);
}});
