import {execFileSync} from 'node:child_process';
import {readdirSync,writeFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {groundTriangles} from '../../../tools/layouts/audit-ground';
import {groundConflicts} from '../../../tools/layouts/ground-layers';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}),reports=[];
for(const base of readdirSync('public/assets/layouts').filter(p=>p.endsWith('.base.glb'))){
 const district=base.split('.')[0],triangles=[];
 for(const name of readdirSync('public/assets/layouts').filter(p=>p.startsWith(`${district}.`) && /\.(base|w[1-5])\.glb$/.test(p))){
 const doc=await io.readBinary(execFileSync('git',['show',`9c35d409:public/assets/layouts/${name}`],{maxBuffer:32*1024*1024}));
 triangles.push(...groundTriangles(doc).map(t=>({...t,id:`${name}:${t.id}`})));
 }
 const conflicts=groundConflicts(triangles);reports.push({district,triangles:triangles.length,conflicts:conflicts.length,examples:conflicts.slice(0,3)});
}
writeFileSync('docs/reports/r12-l9flicker/ground-before.json',JSON.stringify({commit:'9c35d409',reports},null,2));console.log(JSON.stringify(reports.map(({examples,...r})=>r)));
