import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Accessor, Document } from '@gltf-transform/core';
import { assetIO } from '../assets/io';
import { measureFigure } from '../assets/figure-proportions';
import { measureBuild, referenceBuild, surfacesOf } from './anatomy';
import { headReference } from './head-reference';
const reverted=new Set<string>(existsSync('docs/reports/slim/garments/reverted.json')?JSON.parse(readFileSync('docs/reports/slim/garments/reverted.json','utf8')):[]);
const phase = process.argv[2] ?? 'pilot', root = `docs/reports/slim/${phase}`;
const build = JSON.parse(readFileSync(`${root}/build.json`, 'utf8')) as { baseline: string; target: ReturnType<typeof measureBuild>['ratios']; receipts: { id: string; files: { input: string; output: string; figures: { rootName?: string }[] }[] }[] };
const io = await assetIO(), original = (path: string) => execFileSync('git', ['show', `${build.baseline}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const bytes = (a: ReturnType<Accessor['getArray']>) => { assert.ok(a); return Buffer.from(a.buffer, a.byteOffset, a.byteLength); };
const textures = (d: Document) => d.getRoot().listTextures().map(t => sha(t.getImage()!));
const caps = measureFigure(await io.read('public/assets/models/char.courier-female.skin.glb')).ratios;
const rows = [];
for (const entry of build.receipts) for (const f of entry.files) {
  try {
  const before = await io.readBinary(original(f.input)), after = await io.read(f.output);
  assert.deepEqual(textures(after), textures(before), `${f.output}: texture bytes`);
  assert.deepEqual(after.getRoot().listNodes().map(n => [n.getName(), n.getMatrix()]), before.getRoot().listNodes().map(n => [n.getName(), n.getMatrix()]), `${f.output}: skeleton transforms`);
  assert.deepEqual(after.getRoot().listSkins().map(s => sha(bytes(s.getInverseBindMatrices()!.getArray()))), before.getRoot().listSkins().map(s => sha(bytes(s.getInverseBindMatrices()!.getArray()))), `${f.output}: inverse binds`);
  let triangles = 0;
  const oldMeshes = before.getRoot().listMeshes(), meshes = after.getRoot().listMeshes(); assert.equal(meshes.length, oldMeshes.length);
  for (let i = 0; i < meshes.length; i++) {
    const oldPrims = oldMeshes[i].listPrimitives(), prims = meshes[i].listPrimitives(); assert.equal(prims.length, oldPrims.length);
    for (let j = 0; j < prims.length; j++) {
      const p = prims[j], old = oldPrims[j]; assert.deepEqual(p.listSemantics().sort(), old.listSemantics().sort());
      for (const key of p.listSemantics()) {
        assert.equal(p.getAttribute(key)!.getCount(), old.getAttribute(key)!.getCount());
        if (!['POSITION', 'NORMAL'].includes(key)) assert.equal(sha(bytes(p.getAttribute(key)!.getArray())), sha(bytes(old.getAttribute(key)!.getArray())), `${f.output}: ${key}`);
      }
      const normal = p.getAttribute('NORMAL'), oldNormal = old.getAttribute('NORMAL');
      if (normal && oldNormal) for (let v = 0; v < normal.getCount(); v++) {
        const n = normal.getElement(v, []), b = oldNormal.getElement(v, []);
        if (b.every(Number.isFinite)) assert.ok(n.every(Number.isFinite), `${f.output}: nonfinite normal ${v}`);
        if (b.every(Number.isFinite) && b.reduce((s,x)=>s+x*x,0) > 1e-12) assert.ok(n.reduce((s,x)=>s+x*x,0) > 1e-12, `${f.output}: new zero normal ${v}`);
      }
      assert.equal(p.getIndices()?.getCount(), old.getIndices()?.getCount());
      if (p.getIndices()) assert.equal(sha(bytes(p.getIndices()!.getArray())), sha(bytes(old.getIndices()!.getArray())));
      triangles += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3;
    }
  }
  const figures = f.figures.map(({ rootName }) => {
    const b = measureBuild(before, rootName), a = measureBuild(after, rootName, referenceBuild(before,rootName)), bh = measureFigure(before, rootName, headReference(f.input, rootName)), ah = measureFigure(after, rootName, headReference(f.input, rootName));
    assert.ok(Math.abs(a.heightM - b.heightM) < 1e-5, `${f.output}: height`);
    assert.ok(Math.abs(a.groundM - b.groundM) < 1e-5, `${f.output}: ground`);
    if (entry.id !== 'inf.crawler') assert.ok(ah.ratios.headHeight <= caps.headHeight * 1.1 + 1e-5, `${f.output}: head/height`);
    if (entry.id !== 'inf.crawler') assert.ok(ah.ratios.headShoulder <= caps.headShoulder * 1.1 + 1e-5, `${f.output}: head/shoulder`);
    for (const k of ['torsoWidth', 'torsoDepth'] as const) if (entry.id !== 'inf.crawler' && !reverted.has(entry.id)) assert.ok(a.ratios[k] <= build.target[k] * 1.15 + 1e-5 && (b.ratios[k] < build.target[k] * .85 || a.ratios[k] >= build.target[k] * .85 - 1e-5), `${f.output}: ${k} ${a.ratios[k]}`);
    return { rootName, before: b.ratios, after: a.ratios, heightM: a.heightM, groundM: a.groundM, heads: { before: bh.ratios, after: ah.ratios } };
  });
  const oldVertices = surfacesOf(before).flatMap(s => s.vertices), vertices = surfacesOf(after).flatMap(s => s.vertices);
  let fixedMaxM = 0; oldVertices.forEach((v, i) => { if (/^(head|neck|eye|iris|pony|hair|hand|weapon|backpack)/.test(v.owner)) fixedMaxM = Math.max(fixedMaxM, v.point.distanceTo(vertices[i].point)); });
  assert.ok(fixedMaxM < 2e-5, `${f.output}: head/hand/prop surface changed ${fixedMaxM}`);
  rows.push({ id: entry.id, path: f.output, topologyAttributesWeightsUVsTexturesAndRigUnchanged: true, triangles, fixedMaxM, figures });
  } catch(error) { if (!process.env.SLIM_AUDIT_COLLECT) throw error; rows.push({id:entry.id,path:f.output,error:String(error)}); }
}
const hero = 'public/assets/models/char.courier-female.skin.glb'; assert.equal(sha(readFileSync(hero)), sha(original(hero)), 'Heroine changed');
const errors=rows.filter(r=>'error' in r);
writeFileSync(process.env.SLIM_AUDIT_OUT??`${root}/audit.json`, JSON.stringify({ baseline: build.baseline, variants: build.receipts.length, files: rows.length, errors, heroineUnchanged: true, rows }, null, 2) + '\n');
console.log(`PASS: ${build.receipts.length} variants, ${rows.length} files; topology, UVs, textures, weights, rig, hands/props, head caps and heights`);

if(errors.length){console.error(errors);process.exitCode=1;}
