/** Bake measured radial body adjustments into man-a and woman-a pilot GLBs. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { Matrix3, Matrix4, Vector3 } from 'three';
import { getBounds, prune } from '@gltf-transform/functions';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from '../assets/io';
import { skinCrowdBakes } from '../assets/skin-crowd-bakes';

const manifest=JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as AssetDef[];
const ratios=JSON.parse(readFileSync('docs/reports/slim/measurements.json','utf8')) as {rows:{id:string;ratios?:Record<string,number|null>}[]};
const measured=(id:string)=>ratios.rows.find(r=>r.id===id)?.ratios;
const target=measured('char.courier-female');
if(!target)throw Error('Missing heroine anatomy');
const cap=(wanted:number|null|undefined,current:number|null|undefined)=>wanted==null||current==null?1:Math.min(1,1.15*wanted/current);
const factors=(id:string)=>{const r=measured(id);if(!r)throw Error(`Missing measurements: ${id}`);return {
  upperArm:cap(target.upperArmRadius,r.upperArmRadius), forearm:cap(target.forearmRadius,r.forearmRadius),
  thigh:cap(target.thighRadius,r.thighRadius), calf:cap(target.calfRadius,r.calfRadius),
  torsoWidth:cap(target.torsoWidth,r.torsoWidth),torsoDepth:cap(target.torsoDepth,r.torsoDepth),
  shoeLength:cap(target.shoeLength,r.shoeLength),shoeHeight:cap(target.shoeHeight,r.shoeHeight),
};};
const jointShort=(n:string)=>n.replace(/^survivor\d+_/,'');
function deform(doc:Awaited<ReturnType<Awaited<ReturnType<typeof assetIO>>['readBinary']>>, id:string) {
  const ns=doc.getRoot().listNodes(), f=factors(id), positions=new Map<string,Vector3>();
  const point=(name:string)=>{let p=positions.get(name);if(!p){const node=ns.find(n=>jointShort(n.getName())===name);if(!node)throw Error(`${id}: missing joint ${name}`);p=new Vector3().setFromMatrixPosition(new Matrix4().fromArray(node.getWorldMatrix()));positions.set(name,p);}return p!;};
  const limb=(p:Vector3,start:string,end:string,scale:number)=>{const a=point(start),b=point(end),axis=b.clone().sub(a).normalize(),t=p.clone().sub(a).dot(axis),radial=p.clone().sub(a).addScaledVector(axis,-t);return p.clone().addScaledVector(radial,scale-1);};
  for(const node of ns){const mesh=node.getMesh(),skin=node.getSkin();if(!mesh||!skin)continue;
    const worlds=skin.listJoints().map((j,i)=>new Matrix4().fromArray(j.getWorldMatrix()).multiply(new Matrix4().fromArray(skin.getInverseBindMatrices()!.getElement(i,[]))));
    for(const prim of mesh.listPrimitives()){
      const pos=prim.getAttribute('POSITION')!,indices=prim.getAttribute('JOINTS_0'),weights=prim.getAttribute('WEIGHTS_0');if(!indices||!weights)continue;
      const out=pos.clone().setArray(new Float32Array(pos.getCount()*3)).setNormalized(false),normal=prim.getAttribute('NORMAL'),nout=normal?.clone();
      const skinPoint=(raw:Vector3,j:number,w:number)=>raw.clone().applyMatrix4(worlds[j]).multiplyScalar(w);
      const apply=(p:Vector3,joints:number[],ws:number[])=>{
        let result=p.clone();const groups:{name:string;w:number}[]=[];
        for(let k=0;k<ws.length;k++)if(ws[k]){const n=jointShort(skin.listJoints()[joints[k]].getName());groups.push({name:n,w:ws[k]});}
        const weighted=(names:RegExp,scale:number,start:(n:string)=>string,end:(n:string)=>string)=>{
          const selected=groups.filter(g=>names.test(g.name));if(!selected.length||scale>=1)return;
          const sum=selected.reduce((a,g)=>a+g.w,0),deformed=selected.reduce((a,g)=>a.add(limb(p,start(g.name),end(g.name),scale).multiplyScalar(g.w)),new Vector3()).divideScalar(sum);
          result.lerp(deformed,Math.min(1,sum));
        };
        weighted(/^(arm|elbow)[LR]$/,f.upperArm,n=>`arm${n.slice(-1)}`,n=>`foreArm${n.slice(-1)}`);
        weighted(/^foreArm(?:Twist)?[LR]$/,f.forearm,n=>`foreArm${n.slice(-1)}`,n=>`hand${n.slice(-1)}`);
        weighted(/^leg[LR]$/,f.thigh,()=> 'hip',n=>`shin${n.slice(-1)}`);
        weighted(/^shin[LR]$/,f.calf,n=>`shin${n.slice(-1)}`,n=>`foot${n.slice(-1)}`);
        const torso=groups.filter(g=>/^(torso|spine|chest)$/.test(g.name)).reduce((a,g)=>a+g.w,0);
        if(torso){const q=p.clone();q.x*=f.torsoDepth;q.z*=f.torsoWidth;result.lerp(q,Math.min(1,torso));}
        for(const side of ['L','R']){const shoe=groups.filter(g=>new RegExp(`^(foot|toe)${side}$`).test(g.name)).reduce((a,g)=>a+g.w,0);if(shoe){const anchor=point(`foot${side}`),q=p.clone().sub(anchor);q.x*=f.shoeLength;q.y*=f.shoeHeight;q.z*=Math.min(f.shoeLength,f.shoeHeight);result.lerp(anchor.add(q),Math.min(1,shoe));}}
        return result;
      };
      for(let i=0;i<pos.getCount();i++){
        const raw=new Vector3().fromArray(pos.getElement(i,[])),js=indices.getElement(i,[]),ws=weights.getElement(i,[]);
        let p=new Vector3();for(let k=0;k<ws.length;k++)if(ws[k])p.add(skinPoint(raw,js[k],ws[k]));
        const after=apply(p,js,ws);out.setElement(i,after.toArray());
        if(nout&&normal){const n=new Vector3().fromArray(normal.getElement(i,[])),eps=1e-4,cols=[new Vector3(eps,0,0),new Vector3(0,eps,0),new Vector3(0,0,eps)].map(d=>apply(p.clone().add(d),js,ws).sub(after).divideScalar(eps));const jac=new Matrix3().set(cols[0].x,cols[1].x,cols[2].x,cols[0].y,cols[1].y,cols[2].y,cols[0].z,cols[1].z,cols[2].z).invert().transpose();nout.setElement(i,n.applyMatrix3(jac).normalize().toArray());}
      }
      prim.setAttribute('POSITION',out);if(nout)prim.setAttribute('NORMAL',nout);
    }
  }
  for(const skin of doc.getRoot().listSkins()){const matrices=new Float32Array(skin.listJoints().length*16);skin.listJoints().forEach((joint,i)=>new Matrix4().fromArray(joint.getWorldMatrix()).invert().toArray(matrices,i*16));skin.setInverseBindMatrices(skin.getInverseBindMatrices()!.clone().setArray(matrices));}
  return f;
}
const io=await assetIO(),outDir='public/assets/models/slim-pilot';mkdirSync(outDir,{recursive:true});mkdirSync('docs/reports/slim/pilot/input',{recursive:true});
const receipt=[];
for(const id of ['npc.civilian-man-a','npc.civilian-woman-a']){
  const def=manifest.find(d=>d.id===id)!;const original=[def.sourceGlb!,def.glb,...Object.values(def.lods??{}),...[def.glb,...Object.values(def.lods??{})].map(p=>p.replace('.glb','.low.glb')).filter(existsSync)];const prepared=[];
  for(const input of [...new Set(original)]){
    const d=await io.read(input);writeFileSync(`docs/reports/slim/pilot/input/${id}.${input.split('/').at(-1)}`,readFileSync(input));const scale=deform(d,id);await d.transform(prune({keepLeaves:true,keepAttributes:true}));
    const output=input===def.sourceGlb?`assets/${id}/model.slim.skin.glb`:`${outDir}/${id}.${input.split('/').at(-1)}`;mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});await io.write(output,d);if(input===def.glb){const body=d.getRoot().listNodes().find(n=>n.getName()==='skin_body');if(body){const b=getBounds(body);def.dimensions={...def.dimensions,x:b.max[0]-b.min[0],y:b.max[1]-b.min[1],z:b.max[2]-b.min[2]};}}prepared.push({input,output,scale});
  }
  def.sourceGlb=`assets/${id}/model.slim.skin.glb`;def.glb=`${outDir}/${id}.${def.glb.split('/').at(-1)}`;def.lods=Object.fromEntries(Object.entries(def.lods??{}).map(([k,v])=>[k,`${outDir}/${id}.${v.split('/').at(-1)}`]));
  receipt.push({id,scale:factors(id),files:prepared});
}
writeFileSync('src/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const bakes=JSON.parse(readFileSync('src/assets/civilianBakes.json','utf8'));for(const item of receipt)Object.assign(bakes,await skinCrowdBakes(manifest.find(d=>d.id===item.id)!));writeFileSync('src/assets/civilianBakes.json',JSON.stringify(bakes,null,2)+'\n');
writeFileSync('docs/reports/slim/pilot/build.json',JSON.stringify({heroine:target,receipt},null,2)+'\n');console.log(JSON.stringify(receipt.map(r=>({id:r.id,scale:r.scale,files:r.files.length}))));
