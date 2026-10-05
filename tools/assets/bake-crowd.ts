import { Document, type Node } from '@gltf-transform/core';
import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import type { CrowdClip } from '../../src/assets/crowd';
import { assetIO } from './io';
import { optimizeDocument } from './optimize';

/** Example rigid-part walk; E07 can supply its own evaluator at bake time. */
export function walkSample(node: Node, time: number, rest: number[]): void {
  if (!/^(arm|foreArm|leg|shin)[LR]$/.test(node.getName())) return;
  const direction = node.getName().endsWith('L') ? 1 : -1;
  const angle = Math.sin(time * Math.PI * 2) * .5 * direction;
  const rotation = new Quaternion().fromArray(rest).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),angle));
  node.setRotation(rotation.toArray());
}
export function bakeCrowd(document: Document, def: AssetDef, sample = walkSample): Document {
  const output = new Document(), buffer = output.createBuffer(), scene = output.createScene();
  output.getRoot().setDefaultScene(scene);
  const nodes = document.getRoot().listNodes();
  const parts = nodes.filter((n)=>def.animatedNodes.includes(n.getName()) || n.getName()==='root');
  if (!parts.length) throw new Error('Crowd bake needs rigid part nodes');
  const rest = new Map(parts.map((n)=>[n,n.getRotation()]));
  const frames = 33, matrices: number[] = [];
  for (let frame=0;frame<frames;frame++) {
    for (const part of parts) { part.setRotation(rest.get(part)!); sample(part,frame/(frames-1),rest.get(part)!); }
    for (const part of parts) matrices.push(...part.getWorldMatrix());
  }
  for (const part of parts) part.setRotation(rest.get(part)!);
  const clip: CrowdClip = { parts: parts.map((n)=>n.getName()), frames, duration: 1, matrices };
  scene.setExtras({crowd:clip});
  const batches = new Map<string,{positions:number[];normals:number[];indices:number[];partIndices:number[]}>();
  for (const node of nodes) {
    let ancestor: Node | null = node, hidden = false;
    while (ancestor) { if (ancestor.getExtras().hidden || /^stump_/.test(ancestor.getName())) hidden=true; ancestor=ancestor.getParentNode(); }
    if (hidden) continue;
    let owner: Node | null = node;
    while (owner && !parts.includes(owner)) owner = owner.getParentNode();
    if (!owner) continue;
    const partIndex = parts.indexOf(owner);
    const relative = new Matrix4().fromArray(owner.getWorldMatrix()).invert().multiply(new Matrix4().fromArray(node.getWorldMatrix()));
    const normalMatrix = new Matrix3().getNormalMatrix(relative);
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const material = primitive.getMaterial();
      if (!material) throw new Error('Crowd primitive has no material');
      const name = material.getName();
      let batch = batches.get(name);
      if (!batch) { batch={positions:[],normals:[],indices:[],partIndices:[]}; batches.set(name,batch); }
      const position = primitive.getAttribute('POSITION')!, normal = primitive.getAttribute('NORMAL');
      const offset = batch.positions.length / 3, element = [0,0,0];
      for (let i=0;i<position.getCount();i++) {
        position.getElement(i,element); batch.positions.push(...new Vector3().fromArray(element).applyMatrix4(relative).toArray());
        if(normal) normal.getElement(i,element); else element.splice(0,3,0,1,0);
        batch.normals.push(...new Vector3().fromArray(element).applyMatrix3(normalMatrix).normalize().toArray());
        batch.partIndices.push(partIndex);
      }
      const indices = primitive.getIndices();
      for(let i=0;i<(indices?.getCount() ?? position.getCount());i++) batch.indices.push(offset+(indices?.getScalar(i) ?? i));
    }
  }
  for (const [name,batch] of batches) {
    const attribute = (values:number[],type:'VEC3'|'SCALAR') => output.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
    const primitive = output.createPrimitive().setAttribute('POSITION',attribute(batch.positions,'VEC3')).setAttribute('NORMAL',attribute(batch.normals,'VEC3')).setAttribute('_PART_INDEX',attribute(batch.partIndices,'SCALAR')).setIndices(output.createAccessor().setType('SCALAR').setArray(new Uint32Array(batch.indices)).setBuffer(buffer)).setMaterial(output.createMaterial(name));
    scene.addChild(output.createNode(`crowd_${name}`).setMesh(output.createMesh().addPrimitive(primitive)));
  }
  return output;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const def=(manifest as AssetDef[]).find((a)=>a.id===process.argv[2]);
  if(!def || def.category!=='infected') throw new Error('Usage: npm run assets:bake-crowd -- <infected ID>');
  const io=await assetIO(), supplied=def.lods?.lod1;
  const doc=await io.read(supplied && existsSync(supplied) ? supplied : def.sourceGlb ?? def.glb);
  if(!supplied || !existsSync(supplied)) await optimizeDocument(doc,def,.12);
  const path=def.glb.replace('.glb','.crowd.glb'); mkdirSync(dirname(path),{recursive:true});
  await io.write(path,bakeCrowd(doc,def)); console.log(path);
}
