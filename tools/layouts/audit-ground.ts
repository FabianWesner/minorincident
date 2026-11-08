import { type Document, type Primitive, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { groundConflicts, type GroundTriangle } from './ground-layers';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export function groundTriangles(doc: Document): (GroundTriangle & {primitive: Primitive; indices: number[]; layer: number})[] {
  const triangles: (GroundTriangle & {primitive: Primitive; indices: number[]; layer: number})[] = [];
  for(const [nodeIndex,node] of doc.getRoot().listNodes().entries()) {
      const matrix=node.getWorldMatrix();
      for(const [primitiveIndex,primitive] of (node.getMesh()?.listPrimitives()??[]).entries()) {
        const material=primitive.getMaterial()?.getName()??'',pos=primitive.getAttribute('POSITION');if(!pos)continue;
        const ids=primitive.getIndices()?.getArray()??Array.from({length:pos.getCount()},(_,i)=>i);
        const point=(index:number)=>{const v=pos.getElement(index,[]);return [matrix[0]*v[0]+matrix[4]*v[1]+matrix[8]*v[2]+matrix[12],matrix[1]*v[0]+matrix[5]*v[1]+matrix[9]*v[2]+matrix[13],matrix[2]*v[0]+matrix[6]*v[1]+matrix[10]*v[2]+matrix[14]];};
        for(let i=0;i<ids.length;i+=3) {
          const p=[point(ids[i]),point(ids[i+1]),point(ids[i+2])],y=p[0][1];
          if(!p.every(v=>Math.abs(v[1]-y)<1e-5))continue;
          const normalY=(p[1][2]-p[0][2])*(p[2][0]-p[0][0])-(p[1][0]-p[0][0])*(p[2][2]-p[0][2]);if(normalY<=0)continue;
          triangles.push({primitive, indices: [ids[i],ids[i+1],ids[i+2]], layer: Number(primitive.getMaterial()?.getExtras().groundLayer ?? 0), id:`${nodeIndex}:${primitiveIndex}:${i/3}`,material,y,points:p.map(v=>[v[0],v[2]])});
        }
      }
    }
  return triangles;
}
export async function auditGround(paths: string[], together = false) {
  await MeshoptDecoder.ready;
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
  const reports=[];
  const groups = new Map<string,string[]>();
  for (const path of paths) { const key=together?path.replace(/\.(base|w\d+)\.glb$/, ''):path; const row=groups.get(key)??[];row.push(path);groups.set(key,row); }
  for(const [path,files] of groups) {
    const triangles=[];
    for (const file of files) { const doc=await io.read(file);triangles.push(...groundTriangles(doc).map(t=>({...t,id:`${file}:${t.id}`}))); }
    const byId = new Map(triangles.map(t=>[t.id,t]));
    const conflicts=groundConflicts(triangles).filter(c => { const a=byId.get(c.first)!,b=byId.get(c.second)!; return a.layer===b.layer || (a.y>b.y && a.layer<b.layer) || (b.y>a.y && b.layer<a.layer); });reports.push({path,triangles:triangles.length,conflicts});
  }
  return reports;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),outIndex=args.indexOf('--out'),out=outIndex<0?null:args.splice(outIndex,2)[1];
  const check=args.includes('--check'),paths=args.filter(a=>!a.startsWith('--'));
  const reports=await auditGround(paths,args.includes('--together'));if(out)writeFileSync(out,JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports.map(r=>({path:r.path,triangles:r.triangles,conflicts:r.conflicts.length,examples:r.conflicts.slice(0,5)}))));
  if(check&&reports.some(r=>r.conflicts.length))process.exitCode=1;
}
