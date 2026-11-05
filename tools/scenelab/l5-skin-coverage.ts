/** Decode every L5 body delivery and both healthy/infected pose-atlas routes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { assetIO } from '../assets/io';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData';
import type { AssetDef } from '../../src/assets/types';

const out = 'docs/reports/l5-all-new';
const census = JSON.parse(readFileSync(`${out}/census.json`, 'utf8')) as { scope: string[]; rows: {id:string}[] };
const ids = census.rows.map(r=>r.id).sort();
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const bakes = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
const scope = new Set(census.scope);
const io = await assetIO(), files = [];
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
for (const id of ids) {
  const def = manifest.find(d => d.id === id)!; assert.ok(def, id);
  const paths = id.startsWith('char.courier-') ? [def.glb!.replace('.glb', '.skin.glb'), def.glb!.replace('.glb', '.skin.low.glb')]
    : [def.glb!, def.lods!.lod1!, def.lods!.lod2!].flatMap(path => [path, path.replace('.glb', '.low.glb')]);
  for (const path of [...new Set(paths)]) {
    assert.ok(existsSync(path), path);
    const bytes = readFileSync(path), doc = await io.read(path), skins = doc.getRoot().listSkins().length;
    assert.ok(skins > 0, `${path}: missing skin`);
    const digest = sha(bytes), inheritedMatch = !scope.has(id) ? digest === sha(execFileSync('git',['show',`c0dc2ff43:${path}`],{maxBuffer:8*1024*1024})) : undefined;
    if (!scope.has(id)) assert.equal(inheritedMatch, true, `${path}: inherited v2 body changed`);
    files.push({ id, kind: 'body', path, skins, textures: doc.getRoot().listTextures().length, bytes: bytes.length, sha256: digest, inheritedV2HashMatch: inheritedMatch });
  }
  if (!id.startsWith('npc.')) continue;
  for (const lod of ['lod0', 'lod1', 'lod2']) for (const infected of [false, true]) {
    const key = `${id}:${lod}${infected ? ':infected' : ''}`, path = `public${bakes[key]}`;
    assert.ok(bakes[key] && existsSync(path), key);
    const bytes = readFileSync(path), decoded = gunzipSync(bytes);
    const baked = decodeCivilianBake(decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength));
    assert.ok(baked.clip.binds?.length && baked.geometry.getAttribute('_skin'), `${key}: missing pose-atlas skin contract`);
    files.push({ id, kind: infected ? 'infected/corpse' : 'healthy/corpse', path, inverseBinds: baked.clip.binds.length / 16, vertices: baked.geometry.getAttribute('position').count, sha256: sha(bytes) });
    baked.geometry.dispose();
  }
}
writeFileSync(`${out}/coverage.json`, JSON.stringify({ ids, courierRoute: 'CharacterView selects .skin.glb/.skin.low.glb; rigid courier manifest entries are fallback only.', files }, null, 2) + '\n');
console.log(JSON.stringify({ identities: ids.length, bodyFiles: files.filter(r => r.kind === 'body').length, poseAtlasFiles: files.filter(r => r.kind !== 'body').length }));
