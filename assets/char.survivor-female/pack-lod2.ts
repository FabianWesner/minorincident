// Build --lod2 variants into .cache/m1-art/{female,man,driver}-lod2.glb,
// then run: npx tsx assets/char.survivor-female/pack-lod2.ts
import {MeshoptSimplifier} from 'meshoptimizer';
import {Matrix4, Matrix3, Vector3} from 'three';
import {optimizeAsset} from '../../tools/assets/optimize';
import {assetIO} from '../../tools/assets/io';
import {triangleCount, semanticNodeNames} from '../../tools/assets/delivery';
import manifest from '../../src/assets/manifest.json';
import type {AssetDef} from '../../src/assets/types';
const io=await assetIO();
await MeshoptSimplifier.ready;
for(const [id,file] of [['char.survivor-female','female'],['npc.civilian-man-a','man'],['inf.delivery-driver','driver']]) {
  const def=manifest.find(d=>d.id===id) as AssetDef;
  const output=def.lods!.lod2!;
  await optimizeAsset(`.cache/m1-art/${file}-lod2.glb`,output,def,.02);
  const doc=await io.read(output), hero=await io.read(def.glb);
  // Contract nodes retain a coarse version of their real source geometry,
  // including the miniature backpack mascot and articulated hand silhouettes.
  for(const name of new Set([...def.requiredNodes,...semanticNodeNames(hero)])) {
    const original=hero.getRoot().listNodes().find(n=>n.getName()===name)!;
    let node=doc.getRoot().listNodes().find(n=>n.getName()===name);
    if(!node) {
      node=doc.createNode(name).setTranslation(original.getTranslation()).setRotation(original.getRotation()).setScale(original.getScale()).setExtras(original.getExtras());
      const parent=doc.getRoot().listNodes().find(n=>n.getName()===original.getParentNode()?.getName());
      if(parent) parent.addChild(node); else doc.getRoot().listScenes()[0].addChild(node);
    }
    let hasGeometry=false; node.traverse(n=>{if(n.getMesh())hasGeometry=true;});
    if(hasGeometry) continue;
    const mesh=doc.createMesh(name), buffer=doc.getRoot().listBuffers()[0];
    const inverse=new Matrix4().fromArray(original.getWorldMatrix()).invert();
    original.traverse(part=>{
      const relative=new Matrix4().multiplyMatrices(inverse,new Matrix4().fromArray(part.getWorldMatrix()));
      const normalMatrix=new Matrix3().getNormalMatrix(relative);
      for(const source of part.getMesh()?.listPrimitives()??[]) {
        const position=source.getAttribute('POSITION')!;
        const positions=new Float32Array(position.getCount()*3);
        for(let i=0;i<position.getCount();i++) positions.set(position.getElement(i,[0,0,0]),i*3);
        for(let i=0;i<positions.length;i+=3) new Vector3().fromArray(positions,i).applyMatrix4(relative).toArray(positions,i);
        const input=Uint32Array.from(source.getIndices()!.getArray()!);
        // The conventional simplifier keeps tiny disconnected details intact;
        // vertex clustering makes these omitted decorations a true distant tier.
        let [indices]=MeshoptSimplifier.simplifySloppy(input,positions,3,null,36,1);
        if(!indices.length) [indices]=MeshoptSimplifier.simplify(input,positions,3,36,1);
        const attribute=(array:Float32Array)=>doc.createAccessor().setType('VEC3').setArray(array).setBuffer(buffer);
        const prim=doc.createPrimitive().setAttribute('POSITION',attribute(positions)).setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
        const normal=source.getAttribute('NORMAL');
        if(normal) {
          const normals=new Float32Array(normal.getCount()*3);
          for(let i=0;i<normal.getCount();i++) normals.set(normal.getElement(i,[0,0,0]),i*3);
          for(let i=0;i<normals.length;i+=3) new Vector3().fromArray(normals,i).applyMatrix3(normalMatrix).normalize().toArray(normals,i);
          prim.setAttribute('NORMAL',attribute(normals));
        }
        const material=source.getMaterial()!;
        prim.setMaterial(doc.getRoot().listMaterials().find(m=>m.getName()===material.getName())??doc.createMaterial(material.getName()).setBaseColorFactor(material.getBaseColorFactor()));
        mesh.addPrimitive(prim);
      }
    });
    if(mesh.listPrimitives().length) node.setMesh(mesh); else mesh.dispose();
  }
  for(const scene of doc.getRoot().listScenes()) {const extras=scene.getExtras();delete extras.deliveryLodGenerated;scene.setExtras(extras);}
  await io.write(output,doc);
  await io.write(`assets/${id}/model.lod2.glb`,doc);
  console.log(id,triangleCount(doc));
}
