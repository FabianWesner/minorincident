import { existsSync, readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Box3, Color, Matrix4, Mesh, Vector3, type BufferGeometry, type Group, type InstancedMesh, type MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import manifest from '../../../src/assets/manifest.json';
import { AssetRegistry } from '../../../src/assets/registry';
import { CrowdAccessories, bakedSkull } from '../../../src/render/characters/CrowdAccessories';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { markCrowdAppearance, resolveCrowdAppearance } from '../../../src/render/characters/CrowdAppearance';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';
import { characterNodes } from '../../../src/data/survivor';
import { packCrowdParts } from '../../../src/assets/crowdParts';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import { oracle } from './oracles';
import { loadCivilianSource } from '../../../src/assets/civilianSource';
import { prepareCivilianRig } from '../../../src/render/npc/prepareCivilianGeometry';
import { palette } from '../../../src/data/palette';

type Lod = 'lod0' | 'lod1' | 'lod2';
// Authored glasses are native head meshes, including staff/quest characters. Aftermath variants inherit their source.
const authoredGlasses = new Set(manifest.filter(a => a.id.startsWith('npc.') && existsSync(`assets/${a.id}/build.py`) && /glasses|spectacle/i.test(readFileSync(`assets/${a.id}/build.py`, 'utf8'))).map(a => a.id));
// tools/blender/sslib/aftermath.py extracts Sam from survivor03_root (the authored glassesMan).
authoredGlasses.add('npc.survivor-group.aftermath.sam');
const spectacleColors = [new Color(palette.uiDark), new Color(palette.leather)];
const cache = new Map<string, Promise<Group>>();
async function asset(id: string, lod: Lod): Promise<Group> {
  const key = `${id}/${lod}`;
  if (!cache.has(key)) cache.set(key, (async () => {
    if (id.startsWith('npc.')) return loadCivilianSource(id, lod, async url => {
      const bytes = readFileSync(`public${url}`);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    });
    const def = manifest.find(a => a.id === id)!;
    const bytes = readFileSync(lod === 'lod0' ? def.glb : def.lods![lod]!);
    const parsed = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''), { scene } = parsed;
    scene.traverse(node => { const index = parsed.parser.associations.get(node)?.nodes; if (index !== undefined) node.name = parsed.parser.json.nodes[index].name ?? node.name; });
    scene.userData.assetId = id; return scene;
  })());
  return (await cache.get(key)!).clone(true);
}
function bounds(geometry: BufferGeometry, matrix = new Matrix4(), selected?: (i: number) => boolean): Box3 {
  const result = new Box3(), point = new Vector3(), p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (!selected || selected(i)) result.expandByPoint(point.fromBufferAttribute(p, i).applyMatrix4(matrix));
  return result;
}
async function authoredBounds(id: string, lod: Lod): Promise<Box3> {
  const root = await asset(id, lod === 'lod2' ? 'lod1' : lod); root.updateMatrixWorld(true);
  const pivot = root.getObjectByName('head'), inverse = pivot && !(pivot instanceof Mesh) ? pivot.matrixWorld.clone().invert() : new Matrix4();
  const result = new Box3();
  root.traverse(node => { if (node instanceof Mesh) result.union(bounds(node.geometry, inverse.clone().multiply(node.matrixWorld))); });
  return result;
}
function authoredSkull(root: Group, headName = 'head') {
  root.updateMatrixWorld(true); const head = root.getObjectByName(headName); if (!head) return null;
  const inverse = head.matrixWorld.clone().invert(), box = new Box3(), point = new Vector3();
  head.traverse(node => {
    if (!(node instanceof Mesh) || Array.isArray(node.material) || !/skin/i.test(node.material.name)) return;
    const p = node.geometry.getAttribute('position'), index = node.geometry.index, matrix = inverse.clone().multiply(node.matrixWorld);
    for (let i = 0; i < (index?.count ?? p.count); i++) box.expandByPoint(point.fromBufferAttribute(p, index ? index.getX(i) : i).applyMatrix4(matrix));
  });
  return box.isEmpty() ? null : { size: box.getSize(new Vector3()), centre: box.getCenter(new Vector3()) };
}

test('1 accessories: actual head-local bounds and scale for every crowd model × LOD × appearance tier', async () => {
  vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation((id, lod) => asset(id, lod === 'lod1' || lod === 'lod2' ? lod : 'lod0'));
  const renderer = new CrowdAccessories();
  const errors: string[] = [];
  try {
    await renderer.init();
    const referenceRoot = await asset('npc.civilian-man-a', 'lod1');
    prepareCivilianRig(referenceRoot, 'npc.civilian-man-a');
    const referenceGeo = bakeInfected(referenceRoot, [], false, ['idle']).geometry;
    packCrowdParts(referenceGeo);
    markCrowdAppearance(referenceGeo, false);
    const reference = bakedSkull(referenceGeo)!;
    const ids = manifest.filter(a => a.category === 'accessory' && a.accessory && ['hat', 'glasses'].includes(a.accessory.slot)).map(a => a.id);
    expect(ids.length).toBeGreaterThan(0);
    // Group tableaux contain several people; their individually registered members are the crowd variants.
    const models = [...new Set([...regularInfectedModels, ...manifest.filter(a => a.id.startsWith('npc.') && !['npc.survivor-group', 'npc.survivor-group.aftermath'].includes(a.id)).map(a => a.id)])];
    const raw = new Map<string, Box3>();
    for (const id of ids) for (const lod of ['lod0', 'lod1', 'lod2'] as const) raw.set(`${id}/${lod}`, await authoredBounds(id, lod));
    const frameTops = new Map<string, number>();
    for (const model of ['npc.civilian-woman-b', 'npc.civilian-elderly']) {
      const root = await asset(model, 'lod0'); prepareCivilianRig(root, model); root.updateMatrixWorld(true);
      const head = root.getObjectByName('head')!, inverse = head.matrixWorld.clone().invert(), point = new Vector3(); let top = -Infinity;
      // Measure the base GLB's head-part frames; aftermath recolours them but retains the same rig and shape.
      // This is independent of the renderer's cached spectacle-top values and fitted hat output.
      head.traverse(node => {
        if (!(node instanceof Mesh) || Array.isArray(node.material) || !/pal_(leather|uiDark)$/.test(node.material.name)) return;
        const positions = node.geometry.getAttribute('position'), index = node.geometry.index, matrix = inverse.clone().multiply(node.matrixWorld);
        for (let i = 0; i < (index?.count ?? positions.count); i++) { point.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(matrix); if (point.x > .02 && point.y > .04) top = Math.max(top, point.y); }
      });
      expect(Number.isFinite(top), `${model}: source spectacle vertices`).toBe(true);
      frameTops.set(model, top);
    }
    for (const id of ids) {
      const def = manifest.find(a => a.id === id)!, size = raw.get(`${id}/lod0`)!.getSize(new Vector3());
      for (const axis of ['x', 'y', 'z'] as const) if (Math.abs(size[axis] - def.dimensions[axis]) > def.dimensions[axis] * def.dimensions.tolerance) errors.push(`${id}: GLB ${axis} extent ${size[axis]} exceeds authored ${def.dimensions[axis]} ±${def.dimensions.tolerance * 100}%`);
    }
    // Independent source: vertices in the authored GLB head frame plus its per-model manifest fit.
    // Tolerance is the source LOD's measured extent / 1024 (quantization), with a 2 mm floating-point floor.
    let combinations = 0, eligible = 0, glassesHeads = 0;
    for (const model of models) for (const lod of ['lod0', 'lod1', 'lod2'] as const) {
      const root = await asset(model, lod);
      if (model.startsWith('npc.')) prepareCivilianRig(root, model);
      const baked = bakeInfected(root, [], false, ['idle']);
      deinterleaveGeometry(baked.geometry); const geometry = mergeVertices(baked.geometry); packCrowdParts(geometry);
      markCrowdAppearance(geometry, model.startsWith('inf.'));
      const registeredSkull = bakedSkull(geometry), skull = registeredSkull ?? authoredSkull(root);
      const civilianFrameTop = frameTops.get(model.replace(/\.aftermath$/, ''));
      // Glasses are authored into these civilian heads, not separate acc.* models.
      // Their dark front-face vertices must remain on the face and owned by the head joint.
      if (authoredGlasses.has(model) || authoredGlasses.has(model.replace(/\.aftermath$/, ''))) {
        glassesHeads++;
        // Palette-folded aftermath heads retain the source rig/shape but no separate skin material.
        let glassSkull = skull;
        if (!glassSkull && model.endsWith('.aftermath')) {
          const source = await asset(model.replace(/\.aftermath$/, ''), lod);
          prepareCivilianRig(source, model.replace(/\.aftermath$/, ''));
          glassSkull = authoredSkull(source);
        }
        if (!glassSkull && model === 'npc.survivor-group.aftermath.sam') glassSkull = authoredSkull(await asset('npc.survivor-group', lod), 'survivor03_head');
        const headNode = root.getObjectByName('head')!; root.updateMatrixWorld(true);
        const inverse = headNode.matrixWorld.clone().invert(), spectacles = new Box3(), point = new Vector3(), authoredFace: Vector3[] = [];
        headNode.traverse(node => {
          if (!(node instanceof Mesh) || Array.isArray(node.material)) return;
          const material = node.material as MeshBasicMaterial, nativeDark = /pal_(leather|uiDark)$/.test(material.name);
          const position = node.geometry.getAttribute('position'), index = node.geometry.index, colors = node.geometry.getAttribute('color'), transform = inverse.clone().multiply(node.matrixWorld), shade = new Color();
          if (!nativeDark && !(material.vertexColors && colors)) return;
          for (let i = 0; i < (index?.count ?? position.count); i++) {
            const vertex = index ? index.getX(i) : i;
            // Aftermath authoring folds swatches into soot-tinted vertex colors under pal_picketWhite.
            if (!nativeDark) {
              shade.fromBufferAttribute(colors, vertex).multiply(material.color);
              const dark = spectacleColors.some(swatch => {
                const ratio = Math.max(shade.r, shade.g, shade.b) / Math.max(swatch.r, swatch.g, swatch.b);
                return ratio >= .25 && ratio <= 1.05 && (['r', 'g', 'b'] as const).every(axis => Math.abs(shade[axis] - swatch[axis] * ratio) <= .003);
              });
              if (!dark) continue;
            }
            point.fromBufferAttribute(position, vertex).applyMatrix4(transform);
            if (point.x > .02 && point.y > .04) { spectacles.expandByPoint(point); authoredFace.push(point.clone()); }
          }
        });
        if (!glassSkull || spectacles.isEmpty()) errors.push(`${model}/${lod}: authored glasses need ${!glassSkull ? 'source head skin' : 'visible face geometry'}`);
        else {
          const top = glassSkull.centre.y + glassSkull.size.y / 2;
          if (spectacles.getCenter(point).y > top + .02 || spectacles.min.y < glassSkull.centre.y - glassSkull.size.y / 2 - .02) errors.push(`${model}/${lod}: glasses outside skull face bounds`);
          const parts = geometry.getAttribute('_parts'), positions = geometry.getAttribute('position'), epsilon = .002;
          const headPoints = new Map<string, Vector3[]>(), cell = (p: Vector3) => p.toArray().map(n => Math.round(n / epsilon));
          for (let i = 0; i < positions.count; i++) if (parts.getX(i) === characterNodes.indexOf('head')) {
            const p = point.fromBufferAttribute(positions, i).clone(), key = cell(p).join(',');
            if (!headPoints.has(key)) headPoints.set(key, []); headPoints.get(key)!.push(p);
          }
          const missing = authoredFace.filter(p => {
            const [x, y, z] = cell(p);
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (headPoints.get(`${x + dx},${y + dy},${z + dz}`)?.some(q => p.distanceToSquared(q) <= epsilon * epsilon)) return false;
            return true;
          }).length;
          if (missing) errors.push(`${model}/${lod}: ${missing}/${authoredFace.length} native glasses vertices lost their authored head-part position/scale`);
        }
      }
      (renderer as unknown as { fits: Map<string, Matrix4> }).fits.delete(model); renderer.registerSkull(model, geometry);
      for (const tier of ['frail', 'average', 'athletic'] as const) for (const id of ids) {
        const e = { id: 1, archetype: model.startsWith('inf.') ? 'infected.runner' : 'civilian', appearance: { entityId: 1, asset: model, accessories: [id], tier } } as EntitySnapshot;
        combinations++;
        const look = resolveCrowdAppearance(e);
        if (!look.accessory) continue; // Uniforms deliberately reject accessories in production.
        eligible++;
        const def = manifest.find(a => a.id === id)! as unknown as { accessory: { fits: Record<string, { scale: [number, number, number]; offset: [number, number, number] }> } };
        const fit = def.accessory.fits[model.replace(/\.aftermath$/, '')] ?? def.accessory.fits['npc.civilian-man-a'];
        const expectedTransform = new Matrix4().makeScale(...fit.scale).setPosition(...fit.offset);
        if (!def.accessory.fits[model.replace(/\.aftermath$/, '')]) {
          if (!skull) { errors.push(`${model}/${lod}: no authored head skin for accessory anchoring`); continue; }
          if (!registeredSkull) errors.push(`${model}/${lod}: renderer cannot register the authored skin skull for ${id}`);
          const ratio = skull!.size.clone().divide(reference.size);
          expectedTransform.premultiply(new Matrix4().makeTranslation(...skull!.centre.toArray()).multiply(new Matrix4().makeScale(...ratio.toArray())).multiply(new Matrix4().makeTranslation(...reference.centre.clone().negate().toArray())));
        }
        if (id.startsWith('acc.hat-') && civilianFrameTop !== undefined) {
          // Both LODs share one fit; use the lower authored brim so switching LOD cannot move the hat.
          const bottom = Math.min(...(['lod0', 'lod1'] as const).map(l => raw.get(`${id}/${l}`)!.clone().applyMatrix4(expectedTransform).min.y));
          expectedTransform.premultiply(new Matrix4().makeTranslation(0, Math.max(0, civilianFrameTop + .012 - bottom), 0));
        }
        const expected = raw.get(`${id}/${lod}`)!.clone().applyMatrix4(expectedTransform);
        const tolerance = Math.max(.002, expected.getSize(new Vector3()).length() / 1024);
        const head = new Matrix4().makeRotationY(.43).setPosition(3, 1.4, -7), world = new Matrix4().makeRotationY(-.7).setPosition(11, .2, 9);
        const otherJoint = new Matrix4().makeRotationX(-.9).setPosition(-13, 4, 22);
        const poses = { clip: { parts: [...characterNodes] }, part: (_f: number, _o: number, _w: number, part: number, out: Matrix4) => out.copy(part === characterNodes.indexOf('head') ? head : otherJoint) } as CrowdPosePalette;
        renderer.begin(); renderer.place(e, lod, poses, 0, [0, 1], world); renderer.finish();
        const mesh = renderer.children.find(m => m.name === `${id}:${lod === 'lod2' ? 'lod1' : lod}`) as InstancedMesh;
        const matrix = new Matrix4(); mesh.getMatrixAt(0, matrix);
        const headLocal = world.clone().multiply(head).invert().multiply(matrix);
        if (process.env.QA_INVARIANTS_BREAK === 'accessories') headLocal.premultiply(new Matrix4().makeTranslation(0, .4, 0));
        const actual = bounds(mesh.geometry, headLocal);
        if (!mesh.visible || mesh.count !== 1 || oracle.accessory({ attach: 'head', offset: [actual.min.distanceTo(expected.min), actual.max.distanceTo(expected.max)], tolerance })) errors.push(`${model}/${lod}/${tier}/${id}: head bounds ${actual.min.toArray()}..${actual.max.toArray()}, authored ${expected.min.toArray()}..${expected.max.toArray()}, tolerance ${tolerance}`);
        if (lod !== 'lod0') {
          const inline = renderer.livingSource(geometry, model, characterNodes.indexOf('head')), parts = inline.getAttribute('_parts'), slot = renderer.ids.indexOf(id) + 1;
          const inlineBounds = bounds(inline, new Matrix4(), i => Math.floor((parts.getW(i) - 128) / 8) === slot);
          if (inlineBounds.min.distanceTo(expected.min) > tolerance || inlineBounds.max.distanceTo(expected.max) > tolerance) errors.push(`${model}/${lod}/${tier}/${id}: inline head geometry differs from authored bounds`);
          inline.dispose();
        }
      }
      geometry.dispose(); baked.geometry.dispose();
    }
    expect(glassesHeads, 'authored glasses inventory must not be empty').toBeGreaterThan(0);
    console.log(`[qa:invariants] accessories combinations=${combinations} eligible=${eligible} nativeGlassesHeads=${glassesHeads}`);
    const distinct = [...new Set(errors)];
    if (distinct.length) console.log(`[qa:invariants] accessory offenders: ${JSON.stringify(distinct.slice(0, 16))}`);
    expect(distinct, `accessories invariant: ${distinct.length} bad head bounds across ${combinations} combinations`).toEqual([]);
  } finally { renderer.dispose(); vi.restoreAllMocks(); }
}, 180_000);
