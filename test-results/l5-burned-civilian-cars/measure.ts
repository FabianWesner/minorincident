import {writeFileSync,readFileSync,statSync,mkdirSync} from 'node:fs';
import {assetIO} from '../../tools/assets/io';
import {triangleCount} from '../../tools/assets/delivery';
import {geometryHash} from '../../tools/assets/validate';
const io=await assetIO();const result=[];
for(const id of ['veh.sedan-red','veh.sedan-blue','veh.sedan-white','veh.suv-dark']){
 const base=await io.read(`public/assets/models/${id}.glb`);
 const anchors=base.getRoot().listNodes().filter(n=>!n.getMesh()&&!n.getName().startsWith('light:')&&(n.getName()===id || /^(body$|wheel|door|driverSeat$|exit|col:|axle|seat)/.test(n.getName())));
 const tiers=[];
 for(const lod of [0,1,2]){
  const path=`public/assets/models/${id}.burned${lod?`.lod${lod}`:''}.glb`;
  const doc=await io.read(path);const nodes=doc.getRoot().listNodes();
  const lookup=new Map(nodes.map(n=>[n.getName(),n]));
  const drift=anchors.filter(n=>lookup.has(n.getName())).map(n=>Math.hypot(...n.getWorldTranslation().map((v,i)=>v-lookup.get(n.getName())!.getWorldTranslation()[i])));
  const matrixDrift=anchors.filter(n=>lookup.has(n.getName())).map(n=>Math.max(...n.getWorldMatrix().map((v,i)=>Math.abs(v-lookup.get(n.getName())!.getWorldMatrix()[i]))));
  const missing=anchors.filter(n=>!lookup.has(n.getName())).map(n=>n.getName());
  const metadata=JSON.parse(readFileSync(`public/assets/models/${id}.burned.meta.json`,'utf8'));
  tiers.push({lod,triangles:triangleCount(doc),bytes:statSync(path).size,
   materials:doc.getRoot().listMaterials().length,draws:nodes.reduce((sum,n)=>sum+(n.getMesh()?.listPrimitives().length??0),0),
   maxAnchorDrift:Math.max(0,...drift),maxAnchorMatrixDrift:Math.max(0,...matrixDrift),missingAnchors:missing,
   activeLights:nodes.filter(n=>n.getExtras().ss_light).length,
   emissiveMaterials:doc.getRoot().listMaterials().filter(m=>m.getName().startsWith('emi_')).length,
   geometryHash:geometryHash(doc),dimensions:lod===0?metadata.runtime.dimensions:undefined});
 }
 result.push({id:`${id}.burned`,tiers});
}
mkdirSync('test-results/l5-burned-civilian-cars',{recursive:true});
writeFileSync('test-results/l5-burned-civilian-cars/metrics.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
