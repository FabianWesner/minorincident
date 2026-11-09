/** Small tailed primates on the shipped primate skeleton. No new rig, animation atlas or third-party model. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { assetIO } from './io';
import type { AssetDef } from '../../src/assets/types';
const io = await assetIO();
for (const healthy of [true, false]) {
  const id = healthy ? 'amb.monkey' : 'inf.monkey', base = healthy ? 'amb.gorilla' : 'inf.gorilla';
  for (const lod of [0, 1, 2]) for (const quality of ['', '.low']) {
    const d = await io.read(`public/assets/models/skinned/${base}.lod${lod}${quality}.glb`), root = d.getRoot(), buffer = root.listBuffers()[0];
    const body = root.listNodes().find(n => n.getName() === 'skin_body')!, p = body.getMesh()!.listPrimitives()[0];
    const hip = body.getSkin()!.listJoints().findIndex(joint => joint.getName() === 'hip');
    if (hip < 0) throw new Error(`${base}: missing hip joint for the tail`);
    const count = p.getAttribute('POSITION')!.getCount(), tail: number[][] = [], normals: number[][] = [], indices: number[] = [];
    const rings = lod === 0 ? 14 : lod === 1 ? 10 : 6, sides = 6;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, x = -.72 - 1.7 * t, y = .86 + 1.18 * Math.sin(t * Math.PI * .68), radius = .09 * (1 - .86 * t);
      for (let k = 0; k < sides; k++) {
        const a = k * Math.PI * 2 / sides;
        tail.push([x, y + Math.cos(a) * radius, Math.sin(a) * radius]); normals.push([0, Math.cos(a), Math.sin(a)]);
        if (j < rings) { const at = count + j * sides + k, next = count + j * sides + (k + 1) % sides; indices.push(at, next, at + sides, next, next + sides, at + sides); }
      }
    }
    for (const semantic of p.listSemantics()) {
      const a = p.getAttribute(semantic)!, old = a.getArray()!, size = a.getElementSize();
      const combined = new (old.constructor as { new(length: number): typeof old })(old.length + tail.length * size); combined.set(old);
      for (let i = 0; i < tail.length; i++) for (let c = 0; c < size; c++) {
        // The added tail belongs to the same hip joint that carries its weights.
        const value = semantic === 'POSITION' ? tail[i][c] : semantic === 'NORMAL' ? normals[i][c] * 32767 : semantic === '_CROWD_PART' ? hip : semantic === 'JOINTS_0' ? c === 0 ? hip : 0 : semantic === 'WEIGHTS_0' ? c === 0 ? 65535 : 0 : old[c];
        combined[old.length + i * size + c] = value;
      }
      p.setAttribute(semantic, d.createAccessor().setType(a.getType()).setNormalized(a.getNormalized()).setArray(combined).setBuffer(buffer));
    }
    const oldIndex = p.getIndices()!.getArray()!, all = new Uint16Array(oldIndex.length + indices.length); all.set(oldIndex); all.set(indices, oldIndex.length);
    p.setIndices(d.createAccessor().setType('SCALAR').setArray(all).setBuffer(buffer));
    const touched = new Set<unknown>();
    for (const mesh of root.listMeshes()) for (const primitive of mesh.listPrimitives()) {
      const a = primitive.getAttribute('POSITION')!; if (touched.has(a)) continue; touched.add(a);
      const values = a.getArray()!; for (let i = 0; i < values.length; i++) values[i] *= .55;
    }
    for (const node of root.listNodes()) node.setTranslation(node.getTranslation().map(v => v * .55) as [number, number, number]);
    for (const skin of root.listSkins()) { const a = skin.getInverseBindMatrices()!.getArray()!; for (let i = 0; i < a.length; i += 16) for (const k of [12, 13, 14]) a[i + k] *= .55; }
    const scaled = new Set<unknown>();
    for (const animation of root.listAnimations()) for (const channel of animation.listChannels()) if (channel.getTargetPath() === 'translation') {
      const a = channel.getSampler()!.getOutput()!; if (scaled.has(a)) continue; scaled.add(a); const values = a.getArray()!; for (let i = 0; i < values.length; i++) values[i] *= .55;
    }
    await io.write(`public/assets/models/skinned/${id}.lod${lod}${quality}.glb`, d);
  }
  mkdirSync(`assets/${id}`, { recursive: true });
  writeFileSync(`assets/${id}/notes.md`, `# ${id}\n\nDerived from the shipped ${base} skin at 55% scale, with a long hip-skinned tail. Keeps the reviewed primate joints and motion clips; healthy/infected atlases preserve the existing eyes and wound distinction. Rebuild with \`node --import tsx tools/assets/build-l8-monkeys.ts\`. Arena leader is enlarged at runtime. Browser visual QA remains pending.\n`);
}
// Lioness: reduce the welded neck mane on the same feline skeleton; face, teeth and eye paint stay intact.
for (const healthy of [true, false]) {
  const id = healthy ? 'amb.lioness' : 'inf.lioness', base = healthy ? 'amb.lion' : 'inf.lion';
  for (const lod of [0, 1, 2]) for (const quality of ['', '.low']) {
    const d = await io.read(`public/assets/models/skinned/${base}.lod${lod}${quality}.glb`);
    const seen = new Set<unknown>();
    for (const mesh of d.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
      const a = primitive.getAttribute('POSITION')!; if (seen.has(a)) continue; seen.add(a);
      const v = a.getArray()!;
      for (let i = 0; i < v.length; i += 3) if (v[i] > 0 && v[i] < .8 && v[i + 1] > .45 && v[i + 1] < 1.7 && Math.abs(v[i + 2]) < .7) {
        v[i] = .75 + (v[i] - .75) * .4; v[i + 1] = .98 + (v[i + 1] - .98) * .6; v[i + 2] *= .6;
      }
    }
    await io.write(`public/assets/models/skinned/${id}.lod${lod}${quality}.glb`, d);
  }
  mkdirSync(`assets/${id}`, { recursive: true });
  writeFileSync(`assets/${id}/notes.md`, `# ${id}\n\nLioness derivative of ${base}, on the same rig and atlas. Reduces the broad neck mane to a close neck silhouette. Rebuild with node --import tsx tools/assets/build-l8-monkeys.ts. Browser visual QA remains pending.\n`);
}
const path = 'src/assets/manifest.json', manifest = JSON.parse(readFileSync(path, 'utf8')) as AssetDef[];
for (const healthy of [true, false]) {
  const id = healthy ? 'amb.monkey' : 'inf.monkey', base = structuredClone(manifest.find(a => a.id === (healthy ? 'amb.gorilla' : 'inf.gorilla'))!);
  base.id = id; base.status = 'integrated'; delete base.script; delete base.sourceGlb;
  base.glb = `public/assets/models/skinned/${id}.lod0.glb`; base.lods = { lod1: `public/assets/models/skinned/${id}.lod1.glb`, lod2: `public/assets/models/skinned/${id}.lod2.glb` };
  base.dimensions = { x: 1.95, y: 1.2, z: 1.1, tolerance: .35 }; base.budget.triangles += 250;
  if (base.authoredLodTriangles) { base.authoredLodTriangles.lod1 += 160; base.authoredLodTriangles.lod2 += 100; }
  const i = manifest.findIndex(a => a.id === id); if (i >= 0) manifest[i] = base; else manifest.push(base);
}
for (const healthy of [true, false]) {
  const id = healthy ? 'amb.lioness' : 'inf.lioness', base = structuredClone(manifest.find(a => a.id === (healthy ? 'amb.lion' : 'inf.lion'))!);
  base.id = id; base.status = 'integrated'; delete base.script; delete base.sourceGlb;
  base.glb = `public/assets/models/skinned/${id}.lod0.glb`; base.lods = { lod1: `public/assets/models/skinned/${id}.lod1.glb`, lod2: `public/assets/models/skinned/${id}.lod2.glb` };
  const i = manifest.findIndex(a => a.id === id); if (i >= 0) manifest[i] = base; else manifest.push(base);
}
writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
