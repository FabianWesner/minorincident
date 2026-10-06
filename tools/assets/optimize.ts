// Adapted from Bruno Simon's scripts/compress.js (MIT): raw export → compression.
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Matrix4, Quaternion, Vector3, Color } from 'three';
import manifest from '../../src/assets/manifest.json';
import type { Document, Node } from '@gltf-transform/core';
import { dedup, prune, weld, join, meshopt, simplify, normals, getBounds, transformMesh } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import type { DistrictLayout } from '../../src/levels/districts/types';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from './io';
import { compressTextures } from './textures';
import { consolidateMeshopt } from './compress';
import { semanticNodeNames } from './delivery';
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
export function generateStumpCaps(document: Document, def: AssetDef, segments = 8): void {
  if (def.category !== 'infected') return;
  const root = document.getRoot(), buffer = root.listBuffers()[0] ?? document.createBuffer();
  const materials = ['flesh','bone'].map(token => root.listMaterials().find(m=>m.getName()===`pal_${token}`)
    ?? document.createMaterial(`pal_${token}`).setBaseColorFactor(new Color(palette[token]).toArray().concat(1) as [number,number,number,number]).setRoughnessFactor(.85).setDoubleSided(true));
  for (const cap of root.listNodes().filter(n=>n.getName().includes('stump_'))) {
    let hasMesh = false; cap.traverse(n=>{if(n.getMesh()) hasMesh=true;});
    if (hasMesh) continue;
    const limbName = cap.getName().replace('stump_', '');
    const limb = root.listNodes().find(n=>n.getName()===limbName);
    const parent = limb?.getParentNode();
    if (!limb || !parent) throw new Error(`${def.id}: no joint for ${cap.getName()}`);
    const inverse = new Matrix4().fromArray(limb.getWorldMatrix()).invert(), points: Vector3[] = [];
    // Only the proximal part: elbow/knee/hand children have their own joint caps.
    const collect = (node: Node, owner = limb, output = points): void => {
      if (node !== owner && (def.animatedNodes.includes(node.getName()) || node.getName().includes('stump_'))) return;
      const matrix = new Matrix4().multiplyMatrices(inverse,new Matrix4().fromArray(node.getWorldMatrix()));
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const position=primitive.getAttribute('POSITION')!, point: number[]=[];
        for(let i=0;i<position.getCount();i++) {position.getElement(i,point);output.push(new Vector3().fromArray(point).applyMatrix4(matrix));}
      }
      for(const child of node.listChildren()) collect(child,owner,output);
    };
    collect(limb);
    if (!points.length) throw new Error(`${def.id}: empty limb ${limb.getName()}`);
    const center = points.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(points.length);
    const isHead = limbName === 'head' || limbName.endsWith('__head');
    const axis = isHead ? new Vector3(0,1,0) : center.lengthSq()>1e-8 ? center.normalize() : new Vector3(0,1,0);
    const orientation = new Quaternion().setFromUnitVectors(new Vector3(0,1,0),axis);
    const undo = orientation.clone().invert(), projected=points.map(p=>p.clone().applyQuaternion(undo));
    const closest=Math.min(...projected.map(p=>Math.abs(p.y))), extent=Math.max(...projected.map(p=>Math.abs(p.y)));
    const section=projected.filter(p=>Math.abs(p.y)<=closest+(extent-closest)*.2);
    let rx=Math.max(.025,...section.map(p=>Math.abs(p.x))), rz=Math.max(.025,...section.map(p=>Math.abs(p.z)));
    if (isHead) {
      // The jaw/hair silhouette is wider than the neck: infer the cut from the torso.
      const torso: Vector3[]=[];collect(parent,parent,torso);
      const section=torso.map(p=>p.applyQuaternion(undo));
      if(section.length) {
        rx=Math.min(rx,Math.max(.025,(Math.max(...section.map(p=>p.x))-Math.min(...section.map(p=>p.x)))*.2));
        rz=Math.min(rz,Math.max(.025,(Math.max(...section.map(p=>p.z))-Math.min(...section.map(p=>p.z)))*.2));
      }
    }
    const depth=Math.min(rx,rz)*.25;
    const mesh=document.createMesh();
    // Closed annulus, outer wall and bone stub; distant caps use fewer sides.
    for (let part=0;part<2;part++) {
      const positions:number[]=[],indices:number[]=[];
      const vertex=(x:number,y:number,z:number)=>{positions.push(x,y,z);return positions.length/3-1;};
      const ring=(r:number,y:number)=>Array.from({length:segments},(_,i)=>vertex(Math.cos(i*2*Math.PI/segments)*rx*r,y,Math.sin(i*2*Math.PI/segments)*rz*r));
      const outer=ring(part ? .3 : 1,0), top=ring(part ? .3 : 1,part ? depth*2 : -depth);
      const inner=part ? [] : ring(.3,0);
      for(let i=0;i<segments;i++) {
        const j=(i+1)%segments;
        if(part) indices.push(outer[i],top[i],top[j],outer[i],top[j],outer[j]);
        else indices.push(outer[i],top[j],top[i],outer[i],outer[j],top[j],outer[i],inner[j],outer[j],outer[i],inner[i],inner[j]);
      }
      if(part) {const tip=vertex(0,depth*2,0);for(let i=0;i<segments;i++)indices.push(tip,top[(i+1)%segments],top[i]);}
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

/** Distance tiers share normals at coincident corners so meshopt can weld them. */
function smoothLodNormals(document: Document): void {
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION')!, normals = primitive.getAttribute('NORMAL');
    if (!normals) continue;
    const sums = new Map<string, Vector3>(), keys: string[] = [], point: number[] = [], normal: number[] = [];
    for (let i = 0; i < positions.getCount(); i++) {
      positions.getElement(i, point); normals.getElement(i, normal);
      const key = point.join('|'); keys.push(key);
      const sum = sums.get(key) ?? new Vector3(); sum.add(new Vector3().fromArray(normal)); sums.set(key, sum);
    }
    for (let i = 0; i < keys.length; i++) normals.setElement(i, sums.get(keys[i])!.clone().normalize().toArray());
  }
}

/** A rigid pivot can own one mesh with several material primitives. */
function bundleStaticSiblings(document: Document): void {
  for (const parent of [...document.getRoot().listNodes(), ...document.getRoot().listScenes()]) {
    const children = parent.listChildren().filter(node => !node.getName() && node.getMesh() && !node.getSkin() && !node.getMesh()!.listPrimitives().some(p => p.listTargets().length));
    if (children.length < 2) continue;
    const mesh = document.createMesh();
    for (const child of children) {
      const source = document.createMesh();
      for (const primitive of child.getMesh()!.listPrimitives()) source.addPrimitive(primitive.clone());
      transformMesh(source, child.getMatrix());
      for (const primitive of source.listPrimitives()) { source.removePrimitive(primitive); mesh.addPrimitive(primitive); }
      source.dispose();
      child.setMesh(null);
      if (!child.listChildren().length) child.dispose();
    }
    parent.addChild(document.createNode().setMesh(mesh));
  }
}

/** Sharing the quantized streams cuts JSON/buffer-view overhead on tiny tiers. */
function shareVertexStreams(document: Document): void {
  for (const mesh of document.getRoot().listMeshes()) {
    const primitives = mesh.listPrimitives();
    if (primitives.length < 2 || primitives.some(p => p.listTargets().length)) continue;
    const semantics = primitives[0].listSemantics().sort();
    if (primitives.some(p => p.listSemantics().sort().join('|') !== semantics.join('|'))) continue;
    const offsets: number[] = []; let count = 0;
    for (const primitive of primitives) { offsets.push(count); count += primitive.getAttribute('POSITION')!.getCount(); }
    for (const semantic of semantics) {
      const first = primitives[0].getAttribute(semantic)!;
      const array = first.getArray()!;
      if (primitives.some(p => p.getAttribute(semantic)!.getComponentType() !== first.getComponentType() || p.getAttribute(semantic)!.getNormalized() !== first.getNormalized())) continue;
      const combined = new (array.constructor as typeof Float32Array)(count * first.getElementSize());
      for (const [i, primitive] of primitives.entries()) combined.set(primitive.getAttribute(semantic)!.getArray()!, offsets[i] * first.getElementSize());
      const accessor = first.clone().setArray(combined);
      for (const primitive of primitives) primitive.setAttribute(semantic, accessor);
    }
    for (const [i, primitive] of primitives.entries()) {
      const indices = primitive.getIndices()!;
      const array = Uint32Array.from(indices.getArray()! as Uint32Array, index => index + offsets[i]);
      primitive.setIndices(indices.clone().setArray(count < 65535 ? new Uint16Array(array) : array));
    }
  }
}

/** Named transforms are gameplay pivots; quantization acts on geometry children. */
export async function optimizeDocument(document: Document, def: AssetDef, ratio = 1): Promise<void> {
  normalizeForward(document, def);
  normalizeScale(document, def);
  removeDegenerateTriangles(document);
  compressTextures(document, undefined, def.tier === 'side' ? 512 : 1024);
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  for (const skin of document.getRoot().listSkins()) if (!skin.getInverseBindMatrices()) {
    const matrices = new Float32Array(skin.listJoints().length * 16);
    for (let i = 0; i < skin.listJoints().length; i++) matrices.set(new Matrix4().toArray(), i * 16);
    skin.setInverseBindMatrices(document.createAccessor().setType('MAT4').setArray(matrices).setBuffer(document.getRoot().listBuffers()[0]));
  }
  const protectedNames = new Set([...semanticNodeNames(document), ...def.requiredNodes, ...def.animatedNodes, ...def.sockets, ...def.frontNodes]);
  for (const node of document.getRoot().listNodes()) if (node.getName().includes('stump_')) protectedNames.add(node.getName().replace('stump_', ''));
  for (const animation of document.getRoot().listAnimations()) for (const channel of animation.listChannels()) {
    const target = channel.getTargetNode(); if (target) protectedNames.add(target.getName());
  }
  const pivots = new Map<string, number[]>();
  // The runtime shades with COLOR_0. Blender sometimes also exports its inactive
  // material-color layer as COLOR_1; retaining it adds bytes without affecting rendering.
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    for (const semantic of primitive.listSemantics()) if (/^COLOR_[1-9]\d*$/.test(semantic)) primitive.setAttribute(semantic, null);
  }
  if (!document.getRoot().listTextures().length) for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    for (const semantic of primitive.listSemantics()) if (semantic.startsWith('TEXCOORD_')) primitive.setAttribute(semantic,null);
  }
  for (const node of document.getRoot().listNodes()) {
    if (!protectedNames.has(node.getName()) && !/^(stump_|light:|col:)/.test(node.getName())) continue;
    if (!node.getName().includes('stump_')) pivots.set(node.getName(), node.getWorldTranslation());
    const mesh = node.getMesh();
    if (mesh) {
      mesh.setName(''); // GLTFLoader must not reserve the gameplay pivot name for its geometry child.
      const child = document.createNode().setMesh(mesh).setSkin(node.getSkin());
      child.setWeights(node.getWeights());
      for (const animation of document.getRoot().listAnimations()) for (const channel of animation.listChannels()) {
        if (channel.getTargetNode() === node && channel.getTargetPath() === 'weights') {
          child.setName(`${node.getName()}__geometry`); protectedNames.add(child.getName()); channel.setTargetNode(child);
        }
      }
      node.setMesh(null).setSkin(null).setWeights([]); node.addChild(child);
    }
  }
  // Move static decoration to its nearest gameplay pivot before joining. Nested
  // exporter transform wrappers otherwise prevent siblings from sharing buffers.
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh() || node.getSkin() || protectedNames.has(node.getName()) || /^(stump_|light:|col:)/.test(node.getName())) continue;
    let parent = node.getParentNode();
    while (parent && !protectedNames.has(parent.getName()) && !/^(stump_|light:|col:)/.test(parent.getName())) parent = parent.getParentNode();
    const world = new Matrix4().fromArray(node.getWorldMatrix());
    if (parent) {
      const local = new Matrix4().fromArray(parent.getWorldMatrix()).invert().multiply(world);
      parent.addChild(node); node.setMatrix(local.toArray());
    } else {
      const scene = document.getRoot().listScenes().find(scene => { let found = false; scene.traverse(child => { if (child === node) found = true; }); return found; });
      if (scene) { scene.addChild(node); node.setMatrix(world.toArray()); }
    }
    node.setName(''); node.getMesh()!.setName('');
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
      const coordinate: number[] = [];
      for (let i = 0; i < position.getCount(); i++) { position.getElement(i, coordinate); position.setElement(i, coordinate.map(value => Math.round(value * 1e6) / 1e6 || 0)); }
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
    // Each disconnected part has its own scale and a closed-geometry floor.
    // Whole-assembly error lets a building flatten its roof tiles and floor slabs.
    const lodSimplifier = { ...MeshoptSimplifier, simplify: (...args: Parameters<typeof MeshoptSimplifier.simplify>) => {
      const [indices, positions, stride, count, error, flags] = args;
      if (!def.sourceGlb && !existsSync(`assets/${def.id}/model.glb`)) {
        // Keep the established build behavior for legacy procedural exports that
        // have no detailed source file in this delivery inventory.
        const target = Math.max(3, count), result = MeshoptSimplifier.simplify(indices, positions, stride, target, error, flags);
        if (result[0].length && result[0].length <= target * 1.25) return result;
        const clustered = MeshoptSimplifier.simplifySloppy(indices, positions, stride, null, target, error);
        if (clustered[0].length) return clustered;
        const faces = new Set<number>();
        for (let axis = 0; axis < 3; axis++) for (const direction of [-1, 1]) {
          let corner = 0;
          for (let i = 1; i < indices.length; i++) if (positions[indices[i] * stride + axis] * direction > positions[indices[corner] * stride + axis] * direction) corner = i;
          faces.add(Math.floor(corner / 3) * 3);
        }
        return [Uint32Array.from([...faces].flatMap(face => Array.from(indices.slice(face, face + 3)))), 0] as [Uint32Array, number];
      }
      const parents = new Map<number, number>();
      const find = (vertex: number): number => {
        if (!parents.has(vertex)) parents.set(vertex, vertex);
        let parent = vertex;
        while (parents.get(parent)! !== parent) parent = parents.get(parent)!;
        while (vertex !== parent) { const next = parents.get(vertex)!; parents.set(vertex, parent); vertex = next; }
        return parent;
      };
      for (let i = 0; i < indices.length; i += 3) {
        const root = find(indices[i]);
        parents.set(find(indices[i + 1]), root); parents.set(find(indices[i + 2]), root);
      }
      const components = new Map<number, number[]>();
      for (let i = 0; i < indices.length; i += 3) {
        const root = find(indices[i]), component = components.get(root) ?? [];
        component.push(indices[i], indices[i + 1], indices[i + 2]); components.set(root, component);
      }
      const output: number[] = []; let maxError = 0;
      for (const component of components.values()) {
        if (component.length <= 36) { output.push(...component); continue; }
        const vertices = [...new Set(component)], remap = new Map(vertices.map((vertex, index) => [vertex, index]));
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (const vertex of vertices) for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], positions[vertex * stride + axis]);
          max[axis] = Math.max(max[axis], positions[vertex * stride + axis]);
        }
        // Normalize each axis independently: millimetre-thick panels keep their thickness.
        const local = Float32Array.from(vertices.flatMap(vertex => min.map((value, axis) => (positions[vertex * stride + axis] - value) / (max[axis] - value || 1))));
        const input = Uint32Array.from(component, vertex => remap.get(vertex)!);
        const target = Math.min(component.length, Math.max(36, Math.floor(component.length * count / indices.length / 3) * 3));
        const locks = new Uint8Array(vertices.length);
        for (let axis = 0; axis < 3; axis++) for (const direction of [-1, 1]) {
          let tip = 0;
          for (let i = 1; i < vertices.length; i++) if (local[i * 3 + axis] * direction > local[tip * 3 + axis] * direction) tip = i;
          locks[tip] = 1;
        }
        // Static props and architecture have thin curved shells and raised lettering.
        // Their surface coverage needs a tighter error than articulated bodies.
        const surfaceError = /^(char|npc|inf)\./.test(def.id) ? (ratio < .05 ? .3 : .2) : (ratio < .05 ? .04 : .02);
        const result = MeshoptSimplifier.simplifyWithAttributes(input, local, 3, new Float32Array(), 0, [], locks, target, surfaceError, [...(flags ?? []), 'LockBorder']);
        if (result[0].length < 12) output.push(...component);
        else { maxError = Math.max(maxError, result[1]); for (const vertex of result[0]) output.push(vertices[vertex]); }
      }
      return [Uint32Array.from(output), maxError] as [Uint32Array, number];
    } };
    await document.transform(weld(), simplify({ simplifier: lodSimplifier, ratio, error: ratio < .05 ? .3 : .1 }), normals());
    smoothLodNormals(document);
    await document.transform(weld());
  }
  generateStumpCaps(document, def, ratio < .05 ? 6 : 8);
  bundleStaticSiblings(document);
  // Seven-bit baked AO is visually stable and compresses better than noisy bytes.
  const colors = new Set(document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives().map(p => p.getAttribute('COLOR_0')).filter(a => a !== null)));
  for (const color of colors) {
    const value: number[] = [];
    for (let i = 0; i < color.getCount(); i++) { color.getElement(i, value); color.setElement(i, value.map(v => Math.round(v * 127) / 127)); }
  }
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16, quantizeNormal: 8, quantizeColor: 8, cleanup: false }));
  removeDegenerateTriangles(document);
  shareVertexStreams(document);
  await document.transform(prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }));
  for (const [name, before] of pivots) {
    const node = document.getRoot().listNodes().find((n) => n.getName() === name);
    if (!node || Math.hypot(...node.getWorldTranslation().map((v, i) => v - before[i])) > .001) throw new Error(`Optimization moved/lost pivot ${name}`);
  }
}
export async function optimizeAsset(raw: string, output: string, def: AssetDef, ratio = 1, prepass?: number): Promise<void> {
  const io = await assetIO(), document = await io.read(raw);
  // Hero characters made of many small closed parts: a whole-mesh pre-pass without
  // per-part floors reaches the tier ratio; the standard tier pipeline follows.
  if (ratio < 1 && prepass !== undefined) {
    await MeshoptSimplifier.ready;
    await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: prepass, lockBorder: false }));
  }
  await optimizeDocument(document, def, ratio);
  if (ratio < 1) for (const scene of document.getRoot().listScenes()) scene.setExtras({ ...scene.getExtras(), deliveryLodGenerated: true });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, await consolidateMeshopt(await io.writeBinary(document)));
}

/** Process existing exports without invoking Blender; supplied LODs remain authoritative. */
export async function optimizeExports(def: AssetDef): Promise<void> {
  const source = def.sourceGlb ?? def.glb;
  await optimizeAsset(source, def.glb, def);
  if (def.tier === 'hero' || def.lods) for (const [lod, ratio] of [['lod1', .12], ['lod2', .03]] as const) {
    // Aliases use the canonical model's supplied tiers, with their own normalization.
    const canonical = `${dirname(source)}/model.${lod}.glb`;
    const supplied = existsSync(canonical) ? canonical : `assets/${def.id}/model.${lod}.glb`, output = def.lods?.[lod];
    if (!output) throw new Error(`${def.id}: missing manifest ${lod} path`);
    const generatedRatio = def.generatedLodRatios?.[lod];
    const handMade = generatedRatio === undefined && existsSync(supplied);
    // Leave room for retained rigid parts and infected stump caps within the LOD1 budget.
    const targetRatio = lod === 'lod1' && (def.category === 'infected' || def.category === 'character') ? .10 : ratio;
    await optimizeAsset(handMade ? supplied : source, output, def, handMade ? 1 : generatedRatio ?? targetRatio, def.lodPrepass?.[lod]);
  }
}
/** Refresh exported collision/minimap metadata after canonical dimensions change, without Blender. */
export function conformLayoutDimensions(definitions: AssetDef[]): void {
  const directory='public/assets/layouts';
  if(!existsSync(directory)) return;
  const byId=new Map(definitions.map(def=>[def.id,def]));
  for(const file of readdirSync(directory).filter(name=>name.endsWith('.layout.json'))) {
    const path=`${directory}/${file}`, before=readFileSync(path,'utf8'), layout=JSON.parse(before) as DistrictLayout;
    for(const placement of layout.placements) {
      const def=byId.get(placement.assetId); if(!def?.world?.solid) continue;
      const {x,y,z}=def.dimensions, [px,py,pz]=placement.position, [sx,sy,sz]=placement.scale;
      const cosine=Math.abs(Math.cos(placement.yaw)), sine=Math.abs(Math.sin(placement.yaw));
      const hx=(cosine*x*sx+sine*z*sz)/2, hz=(sine*x*sx+cosine*z*sz)/2;
      const old=placement.visualAabb, box={min:[px-hx,py,pz-hz],max:[px+hx,py+y*sy,pz+hz]} as typeof old;
      // Authoring places entrance anchors one metre beyond a building's front bound.
      if(layout.buildings.some(b=>b.id===placement.id)) for(const anchor of Object.values(layout.anchors)) {
        if(Math.abs(anchor.position[0]-px)<1e-6 && Math.abs(anchor.position[2]-old.max[2]-1)<1e-6) anchor.position[2]=box.max[2]+1;
      }
      placement.visualAabb=box;
      const collider=layout.colliders.find(c=>c.id===placement.id); if(collider) collider.aabb=box;
      const building=layout.buildings.find(b=>b.id===placement.id); if(building) building.aabb=box;
      const polygon=(a:typeof old)=>[[a.min[0],a.min[2]],[a.max[0],a.min[2]],[a.max[0],a.max[2]],[a.min[0],a.max[2]],[a.min[0],a.min[2]]] as [number,number][];
      const replacePolygon=(p:[number,number][])=>JSON.stringify(p)===JSON.stringify(polygon(old)) ? polygon(box) : p;
      layout.walkable.excluded=layout.walkable.excluded.map(replacePolygon);
      for(const zone of layout.acousticZones) if(zone.id===placement.id) {
        for(const surface of layout.surfaces) if(JSON.stringify(surface.polygon)===JSON.stringify(zone.polygon)) surface.polygon=polygon(box);
        zone.polygon=polygon(box);
      }
      for(const surface of layout.surfaces) surface.polygon=replacePolygon(surface.polygon);
    }
    const after=JSON.stringify(layout,null,2)+'\n'; if(after!==before) writeFileSync(path,after);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  const selected = (manifest as AssetDef[]).filter(d => target === '--production' ? !!d.sourceGlb : d.id === target);
  if (!selected.length) throw new Error('Usage: assets:optimize -- <id>|--production');
  for (const def of selected) { await optimizeExports(def); console.log(def.id); }
  conformLayoutDimensions(manifest as AssetDef[]);
}
