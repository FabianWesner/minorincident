/** Window-glow placement gate (PO 10-09 "Lights are not on right place": glow quads drawn beside the windows on a house).
 * The LOD0 model is authored correctly; a LOD export can carry the glow in a different place than the walls/frames it lights.
 * For every shipped building family (`bld.*` and its `.wN` decay variants) each emissive window-glow patch (`emi_windowGlow`
 * geometry, clustered by proximity, patches under 0.3 m are door lites/lamps) of LOD1/LOD2 must lie within `TOLERANCE_M`
 * of a LOD0 patch of the same variant, and the glow patches must lie within the body bounds of the same file.
 * `npx tsx tools/assets/window-glow-check.ts [--dir public/assets/models] [id...]` prints offenders and exits 1. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Box3, Vector3, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const TOLERANCE_M = 0.3;
const MIN_PANE_M = 0.3;

export async function loadScene(path: string): Promise<Object3D> {
  const bytes = readFileSync(path);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise<{ scene: Object3D }>((resolve, reject) => loader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '', resolve as never, reject));
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/** Window-pane sized glow patches in the model frame. */
export function glowPatches(scene: Object3D): Box3[] {
  const boxes: Box3[] = [], p = new Vector3();
  scene.traverse(node => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const geometry = mesh.geometry, index = geometry.index, position = geometry.getAttribute('position');
    for (const group of geometry.groups.length ? geometry.groups : [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }]) {
      if (materials[group.materialIndex ?? 0]?.name !== 'emi_windowGlow') continue;
      for (let i = group.start; i < group.start + group.count; i += 3) {
        const box = new Box3();
        for (let k = 0; k < 3; k++) box.expandByPoint(p.fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld));
        boxes.push(box);
      }
    }
  });
  const patches: Box3[] = [];
  for (const box of boxes) {
    const hit = patches.filter(patch => patch.clone().expandByScalar(.02).intersectsBox(box));
    for (const h of hit) patches.splice(patches.indexOf(h), 1);
    patches.push(hit.reduce((a, b) => a.union(b), box.clone()));
  }
  return patches.filter(patch => Math.max(...patch.getSize(new Vector3()).toArray()) >= MIN_PANE_M);
}

/** Offending patches of one LOD file against its LOD0 file, as readable strings. */
export async function lodOffenders(lod0: string, lodN: string): Promise<string[]> {
  const base = glowPatches(await loadScene(lod0)).map(b => b.getCenter(new Vector3()));
  const errors: string[] = [];
  for (const patch of glowPatches(await loadScene(lodN))) {
    const centre = patch.getCenter(new Vector3());
    const nearest = Math.min(...base.map(c => c.distanceTo(centre)));
    if (!(nearest <= TOLERANCE_M)) errors.push(`${lodN.split('/').pop()}: glow at ${centre.toArray().map(v => v.toFixed(2))} is ${Number.isFinite(nearest) ? nearest.toFixed(2) : 'n/a'} m from any LOD0 glow`);
  }
  return errors;
}

export async function checkDir(dir: string, only: string[] = []): Promise<string[]> {
  const files = readdirSync(dir).filter(f => /^bld\..+\.glb$/.test(f) && !/\.(lod\d|distance\d)\.glb$/.test(f));
  const errors: string[] = [];
  for (const file of files.filter(f => !only.length || only.some(id => f.startsWith(`${id}.`)))) {
    for (const lod of ['lod1', 'lod2']) {
      const path = `${dir}/${file.replace(/\.glb$/, `.${lod}.glb`)}`;
      if (existsSync(path)) errors.push(...await lodOffenders(`${dir}/${file}`, path));
    }
  }
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2), dirAt = args.indexOf('--dir');
  const dir = dirAt >= 0 ? args[dirAt + 1] : 'public/assets/models';
  const only = args.filter((a, i) => !a.startsWith('--') && i !== dirAt + 1);
  const errors = await checkDir(dir, only);
  for (const e of errors) console.error(e);
  console.log(errors.length ? `${errors.length} displaced window glows` : 'window glows consistent across LODs');
  process.exit(errors.length ? 1 : 0);
}
