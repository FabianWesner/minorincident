// Adapted from Bruno Simon's scripts/compress.js (MIT): raw export → compression.
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Matrix4, Quaternion, Vector3, Color } from 'three';
import manifest from '../../src/assets/manifest.json';
import type { Document, Node } from '@gltf-transform/core';
import { dedup, prune, weld, join, meshopt, simplify, normals, getBounds } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from './io';
import { compressTextures } from './textures';
import { palette } from '../../src/assets/palette';

/** Rotate the entire assembly, leaving joint-local animation axes and sockets intact. */
export function normalizeForward(document: Document, def: AssetDef): void {
  const root = document.getRoot();
  for (const scene of root.listScenes()) {
    if (scene.getExtras().forwardNormalized === '+X') continue;
    const bounds = getBounds(scene), center = bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
    const markers = root.listNodes().filter(n => def.frontNodes.includes(n.getName()));
    let angle = 0;
    if (markers.length) {
      const point = markers[0].getWorldTranslation();
      const x = point[0] - center[0], z = point[2] - center[2];
      if (Math.hypot(x, z) < 1e-6) throw new Error(`${def.id}: ambiguous front marker; declare sourceForward`);
      angle = Math.abs(x) >= Math.abs(z) ? (x > 0 ? 0 : Math.PI) : (z > 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      const forward = def.sourceForward ?? root.listNodes().map(n => n.getExtras().forward).find(v => typeof v === 'string');
      const angles = { '+X': 0, '-X': Math.PI, '+Z': Math.PI / 2, '-Z': -Math.PI / 2 };
      if (!forward || !Object.hasOwn(angles, forward as string)) throw new Error(`${def.id}: missing front marker; declare sourceForward`);
      angle = angles[forward as keyof typeof angles];
      for (const name of def.frontNodes) {
        const direction = new Vector3(1,0,0).applyAxisAngle(new Vector3(0,1,0), -angle);
        const radius = Math.max(bounds.max[0]-bounds.min[0], bounds.max[2]-bounds.min[2]) / 2 + .01;
        scene.addChild(document.createNode(name).setTranslation(direction.multiplyScalar(radius).add(new Vector3().fromArray(center)).toArray()));
      }
    }
    if (angle) {
      const assembly = document.createNode('assetOrientation').setRotation(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle).toArray());
      for (const child of scene.listChildren()) assembly.addChild(child);
      scene.addChild(assembly);
    }
    scene.setExtras({ ...scene.getExtras(), forwardNormalized: '+X' });
  }
}

/** Scale at the scene root so joint translations, geometry and animation stay together. */
export function normalizeScale(document: Document, def: AssetDef): void {
  const scale = def.sourceScale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`${def.id}: invalid sourceScale`);
  for (const scene of document.getRoot().listScenes()) {
    const applied = Number(scene.getExtras().sourceScale ?? 1);
    if (scale !== applied) {
      const assembly = document.createNode('assetScale').setScale([scale/applied,scale/applied,scale/applied]);
      for (const child of scene.listChildren()) assembly.addChild(child);
      scene.addChild(assembly);
    }
    if (scale !== 1 || applied !== 1) scene.setExtras({...scene.getExtras(),sourceScale:scale});
  }
}

/** Repair zero-scale exporter placeholders at the surviving side of each joint. */
export function generateStumpCaps(document: Document, def: AssetDef): void {
  if (def.category !== 'infected') return;
  const root = document.getRoot(), buffer = root.listBuffers()[0] ?? document.createBuffer();
  const materials = ['flesh','bone'].map(token => root.listMaterials().find(m=>m.getName()===`pal_${token}`)
    ?? document.createMaterial(`pal_${token}`).setBaseColorFactor(new Color(palette[token]).toArray().concat(1) as [number,number,number,number]).setRoughnessFactor(.85).setDoubleSided(true));
  for (const cap of root.listNodes().filter(n=>n.getName().startsWith('stump_'))) {
    let hasMesh = false; cap.traverse(n=>{if(n.getMesh()) hasMesh=true;});
    if (hasMesh) continue;
    const limb = root.listNodes().find(n=>n.getName()===cap.getName().slice(6));
    const parent = limb?.getParentNode();
    if (!limb || !parent) throw new Error(`${def.id}: no joint for ${cap.getName()}`);
    const inverse = new Matrix4().fromArray(limb.getWorldMatrix()).invert(), points: Vector3[] = [];
    // Only the proximal part: elbow/knee/hand children have their own joint caps.
    const collect = (node: Node): void => {
      if (node !== limb && (def.animatedNodes.includes(node.getName()) || node.getName().startsWith('stump_'))) return;
      const matrix = new Matrix4().multiplyMatrices(inverse,new Matrix4().fromArray(node.getWorldMatrix()));
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const position=primitive.getAttribute('POSITION')!, point: number[]=[];
        for(let i=0;i<position.getCount();i++) {position.getElement(i,point);points.push(new Vector3().fromArray(point).applyMatrix4(matrix));}
      }
      for(const child of node.listChildren()) collect(child);
    };
    collect(limb);
    if (!points.length) throw new Error(`${def.id}: empty limb ${limb.getName()}`);
    const center = points.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(points.length);
    const axis = center.lengthSq()>1e-8 ? center.normalize() : new Vector3(0,1,0);
    const orientation = new Quaternion().setFromUnitVectors(new Vector3(0,1,0),axis);
    const undo = orientation.clone().invert(), projected=points.map(p=>p.clone().applyQuaternion(undo));
    const closest=Math.min(...projected.map(p=>Math.abs(p.y))), extent=Math.max(...projected.map(p=>Math.abs(p.y)));
    const section=projected.filter(p=>Math.abs(p.y)<=closest+(extent-closest)*.2);
    const rx=Math.max(.025,...section.map(p=>Math.abs(p.x))), rz=Math.max(.025,...section.map(p=>Math.abs(p.z)));
    const depth=Math.min(rx,rz)*.25;
    const mesh=document.createMesh();
    // Eight-sided annulus + outer wall (32 tris), closed bone stub (24 tris).
    for (let part=0;part<2;part++) {
      const positions:number[]=[],indices:number[]=[];
      const vertex=(x:number,y:number,z:number)=>{positions.push(x,y,z);return positions.length/3-1;};
      const ring=(r:number,y:number)=>Array.from({length:8},(_,i)=>vertex(Math.cos(i*Math.PI/4)*rx*r,y,Math.sin(i*Math.PI/4)*rz*r));
      const outer=ring(part ? .3 : 1,0), top=ring(part ? .3 : 1,part ? depth*2 : -depth);
      const inner=part ? [] : ring(.3,0);
      for(let i=0;i<8;i++) {
        const j=(i+1)%8;
        if(part) indices.push(outer[i],top[i],top[j],outer[i],top[j],outer[j]);
        else indices.push(outer[i],top[j],top[i],outer[i],outer[j],top[j],outer[i],inner[j],outer[j],outer[i],inner[i],inner[j]);
      }
      if(part) {const tip=vertex(0,depth*2,0);for(let i=0;i<8;i++)indices.push(tip,top[(i+1)%8],top[i]);}
      const flatPositions:number[]=[],flatNormals:number[]=[];
      for(let i=0;i<indices.length;i+=3) {
        const [a,b,c]=indices.slice(i,i+3).map(id=>new Vector3().fromArray(positions,id*3));
        const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize().toArray();
        for(const point of [a,b,c]) {flatPositions.push(...point.toArray());flatNormals.push(...normal);}
      }
      mesh.addPrimitive(document.createPrimitive().setMaterial(materials[part])
        .setAttribute('POSITION',document.createAccessor().setType('VEC3').setArray(new Float32Array(flatPositions)).setBuffer(buffer))
        .setAttribute('NORMAL',document.createAccessor().setType('VEC3').setArray(new Float32Array(flatNormals)).setBuffer(buffer))
        .setIndices(document.createAccessor().setType('SCALAR').setArray(Uint16Array.from(indices,(_,i)=>i)).setBuffer(buffer)));
    }
    parent.addChild(cap);
    cap.setTranslation(limb.getTranslation()).setRotation(new Quaternion().fromArray(limb.getRotation()).multiply(orientation).toArray())
      .setScale(limb.getScale()).setMesh(mesh).setExtras({...cap.getExtras(),hidden:true,generatedCap:true});
  }
}

/** Evaluate quantized positions in world units, matching the validator's area threshold. */
function removeDegenerateTriangles(document: Document): void {
  for (const node of document.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    if (primitive.getMode() !== 4) continue;
    const pos = primitive.getAttribute('POSITION')!, indices = primitive.getIndices();
    const count = indices?.getCount() ?? pos.getCount(), kept: number[] = [];
    const matrix = new Matrix4().fromArray(node.getWorldMatrix()), point: number[] = [];
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    for (let i = 0; i < count; i += 3) {
      const x = indices?.getScalar(i) ?? i, y = indices?.getScalar(i+1) ?? i+1, z = indices?.getScalar(i+2) ?? i+2;
      pos.getElement(x,point); a.fromArray(point).applyMatrix4(matrix);
      pos.getElement(y,point); b.fromArray(point).applyMatrix4(matrix);
      pos.getElement(z,point); c.fromArray(point).applyMatrix4(matrix);
      if (b.sub(a).cross(c.sub(a)).length() >= 1e-12) kept.push(x,y,z);
    }
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)).setBuffer(pos.getBuffer()));
  }
}

/** Named transforms are gameplay pivots; quantization acts on geometry children. */
export async function optimizeDocument(document: Document, def: AssetDef, ratio = 1): Promise<void> {
  normalizeForward(document, def);
  normalizeScale(document, def);
  removeDegenerateTriangles(document);
  compressTextures(document);
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const protectedNames = new Set([...def.requiredNodes, ...def.animatedNodes, ...def.sockets, ...def.frontNodes]);
  for (const animation of document.getRoot().listAnimations()) for (const channel of animation.listChannels()) {
    const target = channel.getTargetNode(); if (target) protectedNames.add(target.getName());
  }
  const pivots = new Map<string, number[]>();
  if (!document.getRoot().listTextures().length) for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    for (const semantic of primitive.listSemantics()) if (semantic.startsWith('TEXCOORD_')) primitive.setAttribute(semantic,null);
  }
  for (const node of document.getRoot().listNodes()) {
    if (!protectedNames.has(node.getName()) && !/^(stump_|light:|col:)/.test(node.getName())) continue;
    if (!node.getName().startsWith('stump_')) pivots.set(node.getName(), node.getWorldTranslation());
    const mesh = node.getMesh();
    if (mesh) { node.setMesh(null); node.addChild(document.createNode().setMesh(mesh)); }
  }
  // Static siblings may join by material; rigid assemblies and contract names remain separate.
  for (const node of document.getRoot().listNodes()) if (node.getMesh() && !protectedNames.has(node.getName()) && !/^(stump_|light:|col:)/.test(node.getName())) {
    node.setName(''); node.getMesh()!.setName('');
  }
  await document.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }), weld(), join({ keepNamed: true, cleanup: false }), prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }));
  if (ratio < 1) {
    // Split hard normals prevent decimation; regenerate normals on the lower tier.
    for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
      primitive.setAttribute('NORMAL', null);
      const position = primitive.getAttribute('POSITION')!, color = primitive.getAttribute('COLOR_0');
      if (!color) continue;
      // Average corner AO at shared positions so lower LODs can weld hard seams.
      const sums = new Map<string,{sum:number[];count:number}>(), keys: string[] = [], point = [0,0,0], value: number[] = [];
      for (let i=0;i<position.getCount();i++) {
        position.getElement(i,point); color.getElement(i,value);
        const key = point.join('|'); keys.push(key);
        const entry = sums.get(key) ?? {sum:new Array(color.getElementSize()).fill(0),count:0};
        for(let channel=0;channel<entry.sum.length;channel++)entry.sum[channel]+=value[channel];
        entry.count++; sums.set(key,entry);
      }
      for(let i=0;i<keys.length;i++) {
        const entry=sums.get(keys[i])!;
        color.setElement(i,entry.sum.map(v=>v/entry.count));
      }
    }
    // Disconnected bevelled panels can hit a topology floor. The sloppy pass clusters
    // positions for distant tiers; retain at least one triangle per material/part.
    const lodSimplifier = { ...MeshoptSimplifier, simplify: (...args: Parameters<typeof MeshoptSimplifier.simplify>) => {
      const [indices, positions, stride, count, error, flags] = args, target = Math.max(3,count);
      const result = MeshoptSimplifier.simplify(indices,positions,stride,target,error,flags);
      if (!result[0].length) return [indices,0] as [Uint32Array,number];
      if (result[0].length <= target * 1.25) return result;
      const clustered = MeshoptSimplifier.simplifySloppy(indices,positions,stride,null,target,error);
      return clustered[0].length ? clustered : result;
    } };
    await document.transform(weld(), simplify({ simplifier: lodSimplifier, ratio, error: ratio < .05 ? .3 : .1 }), normals(), weld());
  }
  generateStumpCaps(document, def);
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 10, cleanup: false }));
  removeDegenerateTriangles(document);
  await document.transform(prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }));
  for (const [name, before] of pivots) {
    const node = document.getRoot().listNodes().find((n) => n.getName() === name);
    if (!node || Math.hypot(...node.getWorldTranslation().map((v, i) => v - before[i])) > .001) throw new Error(`Optimization moved/lost pivot ${name}`);
  }
}
export async function optimizeAsset(raw: string, output: string, def: AssetDef, ratio = 1): Promise<void> {
  const io = await assetIO(), document = await io.read(raw);
  await optimizeDocument(document, def, ratio);
  mkdirSync(dirname(output), { recursive: true });
  await io.write(output, document);
}

/** Process existing exports without invoking Blender; supplied LODs remain authoritative. */
export async function optimizeExports(def: AssetDef): Promise<void> {
  const source = def.sourceGlb ?? def.glb;
  await optimizeAsset(source, def.glb, def);
  if (def.tier === 'hero') for (const [lod, ratio] of [['lod1', .12], ['lod2', .03]] as const) {
    const supplied = `assets/${def.id}/model.${lod}.glb`, output = def.lods?.[lod];
    if (!output) throw new Error(`${def.id}: missing manifest ${lod} path`);
    const handMade = existsSync(supplied);
    // Reserve the 7 × 56 cap triangles within the LOD1 budget.
    const targetRatio = lod === 'lod1' && def.category === 'infected' ? .10 : ratio;
    await optimizeAsset(handMade ? supplied : source, output, def, handMade ? 1 : targetRatio);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  const selected = (manifest as AssetDef[]).filter(d => target === '--production' ? !!d.sourceGlb : d.id === target);
  if (!selected.length) throw new Error('Usage: assets:optimize -- <id>|--production');
  for (const def of selected) { await optimizeExports(def); console.log(def.id); }
}
