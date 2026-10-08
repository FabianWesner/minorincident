import { assetIO } from '../../../tools/assets/io';
import { triangleCount } from '../../../tools/assets/delivery';
import { Matrix4, Vector3 } from 'three';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const manifest=JSON.parse(readFileSync('src/assets/manifest.json','utf8'));
const io=await assetIO();
const output='test-results/l3-commerce-shop-damage'; mkdirSync(output,{recursive:true});
const ids=['bld.mainstreet-brick','bld.joes-diner','bld.maple-hardware','decay.burned-facade.brick','decay.burned-facade.diner'];
const stats:any[]=[]; const footprints:any[]=[];
for(const id of ids){
 const def=manifest.find((a:any)=>a.id===id);
 const baseline=await io.read(def.glb);
 for(const suffix of id.startsWith('bld.')?['','w2','w3']:['']){
  for(const tier of [0,1,2]){
   const path=def.glb.replace('.glb',`${suffix?'.'+suffix:''}${tier?'.lod'+tier:''}.glb`);
   const doc=await io.read(path), root=doc.getRoot();
   const nodes=root.listNodes(),meshNodes=nodes.filter(n=>n.getMesh());
   const row={id:id+(suffix?'.'+suffix:''),tier,triangles:triangleCount(doc),draws:meshNodes.reduce((s,n)=>s+n.getMesh()!.listPrimitives().length,0),materials:root.listMaterials().length,bytes:readFileSync(path).length,anchors:[] as any[]};
   if(suffix){
    for(const base of baseline.getRoot().listNodes().filter(n=>!n.getMesh() && /^(root|roof|interior|door_|col:)/.test(n.getName()))){
     const sibling=nodes.find(n=>n.getName()===base.getName());
     if(!sibling)throw Error(row.id+' LOD'+tier+' Missing anchor '+base.getName());
     const delta=Math.max(...base.getWorldMatrix().map((v,k)=>Math.abs(v-sibling.getWorldMatrix()[k])));
     row.anchors.push({name:base.getName(),matrixDelta:delta});if(delta>.001)throw Error(row.id+' anchor drift '+base.getName()+': '+delta);
    }
    const cap=[30000,12000,4000][tier];if(row.triangles>cap||row.draws>8)throw Error('Cap failed '+row.id);
   }
   stats.push(row);
   if(id.startsWith('bld.')){
    const polygons:number[][][]=[];
    for(const node of meshNodes){const matrix=new Matrix4().fromArray(node.getWorldMatrix());
     for(const primitive of node.getMesh()!.listPrimitives()){
      const pos=primitive.getAttribute('POSITION')!,indices=primitive.getIndices();
      for(let i=0;i<(indices?.getCount()??pos.getCount());i+=3){const points:number[][]=[];
       for(let j=0;j<3;j++){const v=new Vector3().fromArray(pos.getElement(indices?.getScalar(i+j)??i+j,[])).applyMatrix4(matrix);points.push([v.x,v.z]);}
       polygons.push(points);
      }
     }
    }
    footprints.push({id:row.id,tier,polygons});
   }
  }
 }
}
writeFileSync(output+'/metrics.json',JSON.stringify(stats,null,2)+'\n');writeFileSync('.cache/assets/commerce-footprints.json',JSON.stringify(footprints));
