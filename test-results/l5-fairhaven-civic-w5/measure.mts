import { readFileSync,writeFileSync,statSync,mkdirSync } from 'node:fs';
import { assetIO } from '../../tools/assets/io.ts';
import { validateDocument } from '../../tools/assets/validate.ts';
import { Matrix4, Vector3 } from 'three';
const ids=['bld.apartment-block-a','bld.apartment-block-b','bld.town-hall','bld.church'];
const manifest=JSON.parse(readFileSync('src/assets/manifest.json','utf8'));
const io=await assetIO();const results=[];
// Rasterize projected visible triangles onto one shared 5cm grid. Rubble is inside
// the lot; original foundation, overhangs and roof still participate in both masks.
function mask(doc:any){const cells=new Set<string>();
 for(const n of doc.getRoot().listNodes()){
  if(n.getExtras().hidden===true)continue;
  const matrix=new Matrix4().fromArray(n.getWorldMatrix());
  for(const p of n.getMesh()?.listPrimitives()??[]){
   const positions=p.getAttribute('POSITION'),indices=p.getIndices(),count=indices?.getCount()??positions.getCount();
   const element:number[]=[];
   for(let i=0;i<count;i+=3){const pts=[0,1,2].map(j=>{positions.getElement(indices?.getScalar(i+j)??i+j,element);const v=new Vector3().fromArray(element).applyMatrix4(matrix);return [v.x,v.z];});
    const [a,b,c]=pts;const cross=(u:number[],v:number[],p:number[])=> (v[0]-u[0])*(p[1]-u[1])-(v[1]-u[1])*(p[0]-u[0]);
    if(Math.abs(cross(a,b,c))<1e-8)continue;
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    for(let x=Math.floor(Math.min(...xs)*20);x<=Math.ceil(Math.max(...xs)*20);x++)for(let y=Math.floor(Math.min(...ys)*20);y<=Math.ceil(Math.max(...ys)*20);y++){
     const pt=[(x+.5)/20,(y+.5)/20],cs=[cross(a,b,pt),cross(b,c,pt),cross(c,a,pt)];if(cs.every(v=>v>=-1e-8)||cs.every(v=>v<=1e-8))cells.add(`${x},${y}`);
    }
   }
  }
 }
 return cells;
}
for(const id of ids){const def=manifest.find((x:any)=>x.id===id);const tiers=[];
 for(let lod=0;lod<3;lod++){
  const suffix=lod?`.lod${lod}`:'';const src=`assets/${id}/model${suffix}.glb`,variant=`assets/${id}/model.w5${suffix}.glb`,production=`public/assets/models/${id}.w5${suffix}.glb`;
  const base=await io.read(src),raw=await io.read(variant),doc=await io.read(production);
  const v=validateDocument(doc,{...def,id:id+'.w5',sourceGlb:variant},statSync(production).size,lod,raw);if(v.errors.length)throw new Error(v.errors.join(';'));
  const anchorNames=['root','body','roof','interior','door_front',...def.frontNodes,...def.sockets];const anchors=[];
  for(const name of anchorNames){const a=base.getRoot().listNodes().find((x:any)=>x.getName()===name),b=raw.getRoot().listNodes().find((x:any)=>x.getName()===name);if(!a||!b)throw new Error(`missing ${name}`);
   const delta=Math.max(...a.getWorldMatrix().map((v:number,i:number)=>Math.abs(v-b.getWorldMatrix()[i])));if(delta>1e-6)throw new Error(`${id}:${lod}:${name}: moved ${delta}`);anchors.push({name,delta,translation:b.getWorldTranslation()});
  }
  const a=mask(base),b=mask(raw),intersection=[...a].filter(x=>b.has(x)).length,iou=intersection/(a.size+b.size-intersection);if(iou<.9)throw new Error(`${id}: footprint IoU ${iou}`);
  tiers.push({lod,triangles:v.triangles,drawCalls:v.drawCalls,materials:v.materials,productionBytes:statSync(production).size,sourceBytes:statSync(variant).size,dimensions:v.dimensions,footprintIoU:iou,anchors});
 }
 const item={id,variant:id+'.w5',tiers,independentAcceptance:'pending'};results.push(item);mkdirSync(`test-results/l5-fairhaven-civic-w5/${id}.w5`,{recursive:true});writeFileSync(`assets/${id}.w5/report.json`,JSON.stringify(item,null,2)+'\n');
}
writeFileSync('test-results/l5-fairhaven-civic-w5/measurements.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results.map(x=>({id:x.id,tiers:x.tiers.map(({anchors,...tier})=>tier)})),null,2));
