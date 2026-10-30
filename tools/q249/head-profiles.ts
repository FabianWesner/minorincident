/** Source-specific neck fields, baked once; paint and facial geometry remain authored. */
import type{Document}from'@gltf-transform/core';import{execFileSync}from'node:child_process';import{readFileSync,writeFileSync}from'node:fs';import{PNG}from'pngjs';import{assetIO}from'../assets/io';
let atlas:PNG|undefined;
export async function prepareHeadProfile(doc:Document,id:string){
 const root=doc.getRoot().listNodes().find(n=>n.getName()==='root');if(!root)return;
 if(['inf.hazmat','inf.firefighter'].includes(id)){root.setExtras({...root.getExtras(),q249NeckBlend:true});return;}
 if(id==='inf.suburban-mom'){
  root.setExtras({...root.getExtras(),q249HeadProfile:'long-hair',q249HeadPivot:[.1630594,1.13,0],q249HeadBottom:1.13});
  if(!atlas){const io=await assetIO(),d=await io.readBinary(execFileSync('git',['show','4698e5aa0:assets/inf.suburban-mom/model.skin.glb'],{maxBuffer:64e6}));const p='test-results/q249/rollout/head-atlas';writeFileSync(p+'.png',d.getRoot().listTextures()[0].getImage()!);execFileSync('sips',['-s','format','png',p+'.png','--out',p+'-decoded.png'],{stdio:'ignore'});atlas=PNG.sync.read(readFileSync(p+'-decoded.png'));}
  for(const n of doc.getRoot().listNodes())for(const p of n.getMesh()?.listPrimitives()??[]){
   const ps=p.getAttribute('POSITION')!,uv=p.getAttribute('TEXCOORD_0'),js=p.getAttribute('JOINTS_0'),ws=p.getAttribute('WEIGHTS_0'),groups=new Map<string,number[]>();
   for(let i=0;i<ps.getCount();i++){const key=ps.getElement(i,[] as number[]).map(v=>Math.round(v*1e5)).join(',');const group=groups.get(key)??[];group.push(i);groups.set(key,group);}
   const members=[...groups.values()],indexOf=new Int32Array(ps.getCount()),field:number[]=[],fixed:boolean[]=[],adj=members.map(()=>new Set<number>());
   members.forEach((m,k)=>{m.forEach(i=>indexOf[i]=k);const y=ps.getElement(m[0],[] as number[])[1];let brown=0,head=0;for(const i of m){if(uv){const[u,v]=uv.getElement(i,[] as number[]),png=atlas!,x=Math.max(0,Math.min(png.width-1,Math.floor(u*png.width))),y=Math.max(0,Math.min(png.height-1,Math.floor(v*png.height))),[r,g,b]=png.data.slice((y*png.width+x)*4,(y*png.width+x)*4+3);brown+=Number(r>g*1.35&&g>b*1.1&&r>45);}if(js&&ws){const j=js.getElement(i,[] as number[]),w=ws.getElement(i,[] as number[]);head+=w.reduce((s,v,k)=>s+(n.getSkin()?.listJoints()[j[k]]?.getName()==='head'?v:0),0);}}
    const anchor=y>1.30||y>.94&&brown>m.length*.45||y>1.13&&head/m.length>.85;
    field[k]=anchor?1:0;fixed[k]=anchor||y<.92||head/m.length<.05;
   });
   const ix=p.getIndices();if(ix)for(let i=0;i<ix.getCount();i+=3){const t=[0,1,2].map(k=>indexOf[ix.getScalar(i+k)]);for(const a of t)for(const b of t)if(a!==b)adj[a].add(b);}
   let frontier=field.flatMap((v,i)=>v===1?[i]:[]);const seen=new Set(frontier);for(let ring=0;ring<6;ring++){const next:number[]=[];for(const a of frontier)for(const b of adj[a])if(!seen.has(b)){seen.add(b);next.push(b);if(field[b]===0)fixed[b]=false;}frontier=next;}
   for(let iter=0;iter<180;iter++){const next=field.slice();for(let i=0;i<field.length;i++)if(!fixed[i]&&adj[i].size)next[i]=[...adj[i]].reduce((s,k)=>s+field[k],0)/adj[i].size;for(let i=0;i<field.length;i++)field[i]=next[i];}
   const weights=new Float32Array(ps.getCount()),core=new Float32Array(ps.getCount());members.forEach((m,k)=>m.forEach(i=>{const q=ps.getElement(i,[] as number[]);const shoulder=Math.abs(q[2])>.22?Math.max(0,Math.min(1,(q[1]-1.14)/.12)):1;weights[i]=field[k]*shoulder;core[i]=Number(weights[i]>.99&&ps.getElement(i,[] as number[])[1]>1.26);}));
   p.setAttribute('_Q249_WEIGHT',doc.createAccessor().setType('SCALAR').setArray(weights));p.setAttribute('_Q249_HEAD',doc.createAccessor().setType('SCALAR').setArray(core));
  }return;
 }
 if(id!=='inf.crawler')return;
 for(const n of doc.getRoot().listNodes())for(const p of n.getMesh()?.listPrimitives()??[]){const ps=p.getAttribute('POSITION')!,values=new Float32Array(ps.getCount());for(let i=0;i<ps.getCount();i++){const[x,y]=ps.getElement(i,[] as number[]);values[i]=Number(x>=.38&&y>=.44);}p.setAttribute('_Q249_HEAD',doc.createAccessor().setType('SCALAR').setArray(values));}
 root.setExtras({...root.getExtras(),q249HeadProfile:'crawler',q249HeadPivot:[.19,.57,0]});
}
