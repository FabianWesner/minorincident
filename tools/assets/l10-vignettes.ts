/** Reuse production frozen corpse poses, then pack the Blender-authored L10 field props.
 * Run after assets/l10-vignettes/build.py --batch. No browser or living sim entity is used. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { Document } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import { Quaternion, Vector3 } from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData';
import bakes from '../../src/assets/civilianBakes.json' with { type: 'json' };
import manifest from '../../src/assets/manifest.json' with { type: 'json' };
import { packCrowdParts } from '../../src/assets/crowdParts';
import { repairDeathPoses } from '../../src/render/characters/deathPose';
import { framesPerClip, infectedClips } from '../../src/render/characters/crowdClipNames';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from './io';
import { optimizeAsset } from './optimize';
import { triangleCount } from './delivery';
import { validateDocument } from './validate';
import { writeStaticCollision } from './bake-static-collision';

Object.assign(globalThis, { __QA_HOOKS__: false });
const { StaticCorpses } = await import('../../src/render/characters/StaticCorpses');
const io = await assetIO();
const worker = await io.read('assets/inf.common-worker/model.skin.glb'), atlas = worker.getRoot().listTextures()[0];
mkdirSync('.cache/assets', { recursive: true });
const atlasPath = '.cache/assets/l10-worker.webp'; writeFileSync(atlasPath, atlas.getImage()!);
const [width, height] = spawnSync('magick', ['identify', '-format', '%w %h', atlasPath], { encoding: 'utf8' }).stdout.split(' ').map(Number);
const decoded = spawnSync('magick', [atlasPath, '-depth', '8', 'rgba:-'], { maxBuffer: 16 * 1024 * 1024 });
if (decoded.status !== 0 || decoded.stdout.length !== width * height * 4) throw Error('Could not decode the reused worker atlas');
const linear = (n: number) => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const poses = ['death-back', 'death-side', 'death-crumple'] as const;
const sourcePath = 'public' + bakes['inf.common-worker:lod2:infected'];
const bytes = gunzipSync(readFileSync(sourcePath));
const baked = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
repairDeathPoses(baked.clip, baked.geometry);
packCrowdParts(baked.geometry);
const frozen = new StaticCorpses(), material = new MeshLambertNodeMaterial();
const dimensions: Record<string, number[]> = {};
const reused = [
  ['prop.l10-abandoned-sedan-blue','veh.sedan-blue','wrecked'],
  ['prop.l10-abandoned-sedan-white','veh.sedan-white','wrecked'],
  ['prop.l10-crashed-helicopter','veh.helicopter-military',''],
] as const;
for (const [id, base, decay] of reused) for (const [lod,suffix] of [[0,''],[1,'.lod1'],[2,'.lod2']] as const) {
  const doc = await io.read(`assets/${base}/model${decay?'.'+decay:''}${suffix}.glb`), scene = doc.getRoot().listScenes()[0];
  if (decay) for (const [name,angle] of [['doorL',1.1],['doorR',-.85]] as const) {
    const node=doc.getRoot().listNodes().find(n=>n.getName()===name);
    if(node)node.setRotation(new Quaternion().fromArray(node.getRotation()).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle)).toArray());
  }
  else {
    const assembly=doc.createNode('crashTilt').setRotation(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.3).toArray());
    for(const child of scene.listChildren())assembly.addChild(child);scene.addChild(assembly);
    const rotor=doc.getRoot().listNodes().find(n=>n.getName()==='mainRotor');
    if(rotor)rotor.setRotation(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.25).toArray());
  }
  const b=getBounds(scene), shift=doc.createNode('resting').setTranslation([-(b.min[0]+b.max[0])/2,-b.min[1],-(b.min[2]+b.max[2])/2]);
  for(const child of scene.listChildren())shift.addChild(child);scene.addChild(shift);
  for(const node of doc.getRoot().listNodes())if(node.getName()==='front')node.setName('source-front');
  scene.addChild(doc.createNode('front').setTranslation([(b.max[0]-b.min[0])/2+.5,.1,0]));
  if(lod===0)dimensions[id]=b.max.map((v,i)=>v-b.min[i]);
  const directory=`assets/${id}`;mkdirSync(directory,{recursive:true});await io.write(`${directory}/model${suffix}.glb`,doc);
}
for (const pose of poses) {
  const id = `prop.l10-corpse-${pose.slice(6)}`;
  const geometry = frozen.prepare(pose, baked.geometry, material, baked.clip, infectedClips.indexOf(pose) * framesPerClip + framesPerClip - 1).geometry;
  const doc = new Document(), buffer = doc.createBuffer(), primitive = doc.createPrimitive();
  for (const [key, name] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['color', 'COLOR_0']] as const) {
    const a = geometry.getAttribute(key), size = 3;
    const values = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let j = 0; j < size; j++) values[i * size + j] = a.getComponent(i, j);
    if (key === 'color') {
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < a.count; i++) {
        const x = Math.min(width - 1, Math.max(0, Math.floor(uv.getX(i) * width))), y = Math.min(height - 1, Math.max(0, Math.floor(uv.getY(i) * height)));
        const rgb = [0,1,2].map(c => linear(decoded.stdout[(y * width + x) * 4 + c])), gray = rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
        rgb.forEach((v,c) => values[i*3+c] = gray + (v-gray)*.45);
      }
    }
    primitive.setAttribute(name, doc.createAccessor().setType('VEC3').setArray(values).setBuffer(buffer));
  }
  if (geometry.index) primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(geometry.index.array)).setBuffer(buffer));
  primitive.setMaterial(doc.createMaterial('pal_canvasTan').setBaseColorFactor([1,1,1,1]).setRoughnessFactor(1));
  const root = doc.createNode('root'), body = doc.createNode('body').setMesh(doc.createMesh().addPrimitive(primitive));
  root.addChild(body).addChild(doc.createNode('front').setTranslation([.5,.1,0])); doc.createScene().addChild(root);
  geometry.computeBoundingBox(); const box = geometry.boundingBox!;
  body.setTranslation([-(box.min.x + box.max.x)/2, -box.min.y, -(box.min.z + box.max.z)/2]);
  dimensions[id] = [box.max.x-box.min.x, box.max.y-box.min.y, box.max.z-box.min.z];
  const directory = `assets/${id}`; mkdirSync(directory, { recursive: true });
  for (const suffix of ['', '.lod1', '.lod2']) await io.write(`${directory}/model${suffix}.glb`, doc);
}
frozen.dispose(); material.dispose(); baked.geometry.dispose();
writeFileSync('assets/l10-vignettes/corpse-source.json', JSON.stringify({ sourcePath, poses, dimensions }, null, 2) + '\n');
const ids = ['prop.l10-grave-cross', 'decay.body-bag', 'prop.l10-quarantine-tape', 'prop.l10-cow-carcass', 'prop.l10-shovel', ...poses.map(p => `prop.l10-corpse-${p.slice(6)}`), ...reused.map(r=>r[0])];
const rows: unknown[] = [];
for (const id of ids) {
  const def = (manifest as AssetDef[]).find(a => a.id === id);
  if (!def) { console.log(`${id}: frozen source ready; register dimensions ${dimensions[id]?.map(n => +n.toFixed(4))}`); continue; }
  for (const [lod, suffix] of [[0,''], [1,'.lod1'], [2,'.lod2']] as const) {
    const out = lod === 0 ? def.glb : lod === 1 ? def.lods!.lod1! : def.lods!.lod2!;
    await optimizeAsset(`assets/${id}/model${suffix}.glb`, out, def);
    const doc = await io.read(out), bytes = readFileSync(out).length;
    const result = validateDocument(doc, def, bytes, lod);
    if (result.errors.length) throw Error(`${id} LOD${lod}: ${result.errors.join('; ')}`);
    rows.push({ id, lod, triangles: triangleCount(doc), bytes, errors: result.errors });
  }
}
writeFileSync('assets/l10-vignettes/delivery-report.json', JSON.stringify(rows, null, 2) + '\n');
await writeStaticCollision(reused.map(r=>r[0]));
console.log(`L10 vignette delivery: ${rows.length} tiers validated`);
