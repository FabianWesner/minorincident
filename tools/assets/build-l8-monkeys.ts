/** Tailed primates derived from the shipped primate skin, including production crowd deliveries. */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { PNG } from 'pngjs';
import { Quaternion, Vector3 } from 'three';
import type { Document } from '@gltf-transform/core';
import type { AssetDef } from '../../src/assets/types';
import manifest from '../../src/assets/manifest.json';
import { assetIO } from './io';
import { compressSkin, decodeSkinImage } from './skin-crowd-compress';
import { skinCrowdBakes } from './skin-crowd-bakes';

const io = await assetIO();
const basis = process.env.BASIS ?? resolve('../minorincident_3dpipeline/vendor/basis-encoder-2.1');
const temporary = mkdtempSync(join(tmpdir(), 'l8-monkeys-'));
const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;

/** Local actions use existing crowd clip slots; they affect only the healthy monkey asset. */
function healthyActions(d: Document): void {
  const root = d.getRoot(), buffer = root.listBuffers()[0], times = Float32Array.from({ length: 17 }, (_, i) => i / 16);
  for (const clip of ['idle', 'walk', 'run', 'swing', 'windup']) {
    const animation = d.createAnimation(clip);
    for (const name of ['head', 'torso', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR']) {
      const node = root.listNodes().find(n => n.getName() === name)!;
      const values: number[] = [];
      for (const t of times) {
        const wave = Math.sin(t * Math.PI * 2), side = name.endsWith('R') ? -1 : 1;
        let angle = name === 'head' ? wave * .07 : 0;
        if (clip === 'walk' || clip === 'run') {
          const stride = clip === 'run' ? .55 : .32;
          if (/^arm[LR]$/.test(name)) angle = side * wave * stride;
          if (/^leg[LR]$/.test(name)) angle = -side * wave * stride;
          if (/^foreArm/.test(name)) angle = .12 + Math.max(0, -side * wave) * .18;
        } else if (clip === 'swing') {
          if (name === 'armL') angle = .35 + wave * .08;
          if (name === 'foreArmL') angle = 1.05 + wave * .18;
          if (name === 'head') angle = -.12 + wave * .05;
        } else if (clip === 'windup') {
          if (/^arm[LR]$/.test(name)) angle = 1.05 + side * wave * .18;
          if (/^foreArm/.test(name)) angle = .5 - side * wave * .15;
          if (/^leg[LR]$/.test(name)) angle = -.3 + side * wave * .2;
        }
        const q = new Quaternion().fromArray(node.getRotation()).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle));
        values.push(...q.toArray());
      }
      const sampler = d.createAnimationSampler().setInput(d.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer))
        .setOutput(d.createAccessor().setType('VEC4').setArray(new Float32Array(values)).setBuffer(buffer));
      animation.addSampler(sampler).addChannel(d.createAnimationChannel().setSampler(sampler).setTargetNode(node).setTargetPath('rotation'));
    }
  }
}
try {
for (const healthy of [true, false]) {
  const id = healthy ? 'amb.monkey' : 'inf.monkey', base = healthy ? 'amb.gorilla' : 'inf.gorilla';
  for (const lod of [0, 1, 2]) for (const quality of ['', '.low']) {
    const d = await io.read(`public/assets/models/skinned/${base}.lod${lod}${quality}.glb`), root = d.getRoot(), buffer = root.listBuffers()[0];
    const body = root.listNodes().find(n => n.getName() === 'skin_body')!, p = body.getMesh()!.listPrimitives()[0], joints = body.getSkin()!.listJoints();
    const hip = joints.findIndex(joint => joint.getName() === 'hip'), head = joints.findIndex(joint => joint.getName() === 'head');
    if (hip < 0 || head < 0) throw new Error(`${base}: missing primate joints`);
    const position = p.getAttribute('POSITION')!, normal = p.getAttribute('NORMAL')!, weights = p.getAttribute('WEIGHTS_0')!, indices = p.getAttribute('JOINTS_0')!;
    // Thin perpendicular to each limb's bind axis, blending by the existing skin
    // weights. UV duplicates retain identical positions at shoulder/elbow seams.
    const axes = joints.map(joint => {
      const name = joint.getName(), next = name.replace(/^arm/, 'foreArm').replace(/^leg/, 'shin');
      const childName = name.startsWith('foreArm') ? name.replace('foreArm', 'hand') : name.startsWith('shin') ? name.replace('shin', 'foot') : next;
      const a = new Vector3().fromArray(joint.getWorldTranslation()), child = joints.find(j => j.getName() === childName && j !== joint);
      const axis = child ? new Vector3().fromArray(child.getWorldTranslation()).sub(a).normalize() : new Vector3(1, 0, 0);
      return { a, axis, scale: /^(arm|foreArm|hand)/.test(name) ? .7 : /^(leg|shin|foot)/.test(name) ? .8 : name === 'torso' ? .85 : 1 };
    });
    for (let i = 0; i < position.getCount(); i++) {
      const v = new Vector3().fromArray(position.getElement(i, [])), n = new Vector3().fromArray(normal.getElement(i, [])), result = new Vector3(), resultNormal = new Vector3();
      const js = indices.getElement(i, []), ws = weights.getElement(i, []);
      for (let k = 0; k < 4; k++) if (ws[k]) {
        const { a, axis, scale } = axes[js[k]], along = axis.clone().multiplyScalar(v.clone().sub(a).dot(axis)).add(a);
        result.addScaledVector(v.clone().sub(along).multiplyScalar(scale).add(along), ws[k]);
        const axialNormal = axis.clone().multiplyScalar(n.dot(axis));
        resultNormal.addScaledVector(n.clone().sub(axialNormal).divideScalar(scale).add(axialNormal), ws[k]);
      }
      position.setElement(i, result.toArray()); normal.setElement(i, resultNormal.normalize().toArray());
    }
    // Paint actual atlas colours: material tint alone cannot lighten dark fur.
    // Keep black sockets/eyes, highlights, wounds and alpha semantic classes.
    let furUV = [0, 0], earUV = [0, 0];
    for (const texture of root.listTextures()) {
      const image = await decodeSkinImage(texture.getImage()!, texture.getMimeType(), basis);
      let foundFur = false, foundEar = false;
      for (let i = 0; i < image.data.length; i += 4) {
        const [r, g, b] = [image.data[i], image.data[i + 1], image.data[i + 2]].map(v => v / 255), luma = .2126 * r + .7152 * g + .0722 * b;
        if (luma < .07 || luma > .9 || r > g * 1.7 && r > b * 1.7) continue;
        const light = luma > .5, shade = .7 + .42 * luma, color = light ? [.98, .8, .58] : [.8, .51, .27];
        for (let c = 0; c < 3; c++) image.data[i + c] = Math.round(Math.min(1, color[c] * shade * (healthy ? 1 : .82)) * 255);
        const uv = [((i / 4) % image.width + .5) / image.width, (Math.floor(i / 4 / image.width) + .5) / image.height];
        if (!light && !foundFur) { furUV = uv; foundFur = true; }
        if (light && !foundEar) { earUV = uv; foundEar = true; }
      }
      texture.setImage(new Uint8Array(PNG.sync.write(image))).setMimeType('image/png');
    }
    const extra: { position: number[]; normal: number[]; uv: number[]; owner: number }[] = [], triangles: number[] = [], count = position.getCount();
    const rings = lod === 0 ? 14 : lod === 1 ? 10 : 6, sides = 6;
    // A hooked, rising tail remains readable at LOD2 instead of a straight wire.
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, angle = t * Math.PI * 1.15, x = -.83 - .95 * Math.sin(angle), y = .82 + .85 * (1 - Math.cos(angle)), radius = .1 * (1 - .7 * t);
      const tangentX = -.95 * Math.cos(angle), tangentY = .85 * Math.sin(angle), length = Math.hypot(tangentX, tangentY);
      for (let k = 0; k < sides; k++) {
        const a = k * Math.PI * 2 / sides;
        const n = [-tangentY / length * Math.cos(a), tangentX / length * Math.cos(a), Math.sin(a)];
        extra.push({ position: [x + n[0] * radius, y + n[1] * radius, n[2] * radius], normal: n, uv: furUV, owner: hip });
        if (j < rings) { const at = count + j * sides + k, next = count + j * sides + (k + 1) % sides; triangles.push(at, next, at + sides, next, next + sides, at + sides); }
      }
    }
    // Round pale ears give the small head a recognisable monkey silhouette.
    const rows = lod === 0 ? 4 : lod === 1 ? 3 : 2, sectors = lod === 0 ? 8 : lod === 1 ? 6 : 4;
    for (const side of [-1, 1]) {
      const start = count + extra.length;
      for (let row = 0; row <= rows; row++) for (let k = 0; k < sectors; k++) {
        const latitude = (row / rows - .5) * Math.PI, longitude = k / sectors * Math.PI * 2;
        const n = [Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude)];
        extra.push({ position: [.35 + n[0] * .17, 1.5 + n[1] * .22, side * .43 + n[2] * .12], normal: n, uv: earUV, owner: head });
        if (row < rows) { const at = start + row * sectors + k, next = start + row * sectors + (k + 1) % sectors; if (row) triangles.push(at, at + sectors, next); if (row < rows - 1) triangles.push(next, at + sectors, next + sectors); }
      }
    }
    for (const semantic of p.listSemantics()) {
      const a = p.getAttribute(semantic)!, old = a.getArray()!, size = a.getElementSize();
      const combined = new (old.constructor as { new(length: number): typeof old })(old.length + extra.length * size); combined.set(old);
      const extended = d.createAccessor().setType(a.getType()).setNormalized(a.getNormalized()).setArray(combined).setBuffer(buffer);
      for (const [i, v] of extra.entries()) {
        const value = semantic === 'POSITION' ? v.position : semantic === 'NORMAL' ? v.normal : semantic === 'TEXCOORD_0' ? v.uv : semantic === '_CROWD_PART' ? [v.owner] : semantic === 'JOINTS_0' ? [v.owner, 0, 0, 0] : semantic === 'WEIGHTS_0' ? [1, 0, 0, 0] : a.getElement(0, []);
        extended.setElement(count + i, value);
      }
      p.setAttribute(semantic, extended);
    }
    const oldIndex = p.getIndices()!.getArray()!, all = new Uint16Array(oldIndex.length + triangles.length); all.set(oldIndex); all.set(triangles, oldIndex.length);
    p.setIndices(d.createAccessor().setType('SCALAR').setArray(all).setBuffer(buffer));
    const touched = new Set<unknown>();
    for (const mesh of root.listMeshes()) for (const primitive of mesh.listPrimitives()) {
      const a = primitive.getAttribute('POSITION')!; if (touched.has(a)) continue; touched.add(a);
      const values = a.getArray()!; for (let i = 0; i < values.length; i++) values[i] *= .55;
    }
    for (const node of root.listNodes()) node.setTranslation(node.getTranslation().map(v => v * .55) as [number, number, number]);
    for (const skin of root.listSkins()) { const a = skin.getInverseBindMatrices()!.getArray()!; for (let i = 0; i < a.length; i += 16) for (const k of [12, 13, 14]) a[i + k] *= .55; }
    if (healthy) healthyActions(d);
    const source = join(temporary, `${id}.${lod}${quality}.glb`), output = `public/assets/models/skinned/${id}.lod${lod}${quality}.glb`;
    const textureSize = Math.min(quality ? 512 : 1024, Math.max(...root.listTextures().flatMap(t => t.getSize() ?? [512])));
    await io.write(source, d); await compressSkin(source, output, basis, textureSize);
    console.log(output);
  }
  Object.assign(deliveries, await skinCrowdBakes(manifest.find(a => a.id === id)! as AssetDef));
  mkdirSync(`assets/${id}`, { recursive: true });
  writeFileSync(`assets/${id}/notes.md`, `# ${id}\n\nDerived from the shipped ${base} skin at 55% scale. Continuous weighted limb thinning preserves seams, warm two-tone fur and pale round ears clarify the monkey head, and the hip-skinned tail curls above the rump. All three LODs and low texture variants keep weighted semantic owners. Healthy skins embed idle, quadruped walk/run, grooming and climbing actions in existing crowd clip slots. Rebuild GLBs and production crowd bakes with BASIS=/path/to/basis-encoder-2.1 node --import tsx tools/assets/build-l8-monkeys.ts.\n`);
}
writeFileSync('src/assets/civilianBakes.json', JSON.stringify(deliveries, null, 2) + '\n');
} finally { rmSync(temporary, { recursive: true, force: true }); }
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
