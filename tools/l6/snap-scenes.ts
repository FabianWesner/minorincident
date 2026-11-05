import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import manifest from '../../src/assets/manifest.json';
import type {AssetDef} from '../../src/assets/types';
import type {DistrictLayout} from '../../src/levels/districts/types';
import {buildScene,type SceneSpec} from '../../src/debug/scenelab/spec';
import {SimWorld} from '../../src/sim/world/SimWorld';
const assets=new Map((manifest as AssetDef[]).map(a=>[a.id,a])),source=JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json','utf8')) as DistrictLayout;
for(const file of readdirSync('tools/l6/scenes')){
 const path=`tools/l6/scenes/${file}`,spec=JSON.parse(readFileSync(path,'utf8')) as SceneSpec,built=buildScene(spec,assets,source),w=new SimWorld();await w.init();w.loadComposition(built.composition,[built.layout],1);
 for(const a of spec.actors??[]){const p=a.at!,nav=w.infected!.nav;if(nav.clear(p[0],p[1],.65))continue;let found=false;for(let r=.5;r<=5&&!found;r+=.5)for(let k=0;k<16;k++){const x=p[0]+Math.cos(k*Math.PI/8)*r,z=p[1]+Math.sin(k*Math.PI/8)*r;if(nav.clear(x,z,.65)){a.at=[x,z];found=true;break;}}if(!found)throw new Error(`No free point ${file}/${a.id}`);}
 w.dispose();writeFileSync(path,JSON.stringify(spec,null,2)+'\n');
}
