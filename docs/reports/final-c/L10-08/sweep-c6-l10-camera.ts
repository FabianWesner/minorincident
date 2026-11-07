import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {View} from '../../../src/render/View';
import {l10Framing} from '../../../src/levels/L10/cameraFraming';
import {cameraFraming} from '../../../src/data/cameraFraming';
import {provenance} from './probe';
import {atomicJson} from './report';
const rows=[];
for(const tier of ['low','high'])for(const position of [{id:'road',x:600,z:0},{id:'road',x:980,z:80},{id:'road',x:1500,z:100},{id:'road',x:2100,z:-75},{id:'road',x:2630,z:45},{id:'corridor',x:3100,z:0},{id:'finale',x:4000,z:0}])for(const weapon of ['weapon.pistol','weapon.rocket-launcher']){
 const view=new View(),finale=position.id==='finale';view.resize(1280,720);view.framing=(x,z)=>l10Framing(x,z,finale);view.reset({...position,y:.72});view.setEquippedWeapon(weapon);view.zoom(100,true);view.update({...position,y:.72},0);
 const state=view.getState(),combined=state.regionScale*state.zoom;
 rows.push({tier,position,weapon,regionScale:state.regionScale,playerZoom:state.zoom,zoomLimits:state.zoomLimits,radius:state.radius,combined,expectedBase:position.id==='road'?1.3:1,basePass:Math.abs(state.regionScale-(position.id==='road'?1.3:1))<1e-8,maxPass:combined<=2+1e-8,nominalRadius:cameraFraming.radiusM});
}
atomicJson('docs/reports/final-c/L10-08/camera-capability.json',{...provenance(),toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'Actual production View and L10 framing callback, ordinary setEquippedWeapon plus maximal user zoom request,1280×720; positions in road/corridor/finale. Identical quality-independent rig exercised under both labels. Pure renderer-camera capability check, no GPU or performance timing and no physical backtrack claim. Road with rocket represents permitted backtracking after its later checkpoint pickup.',rows});
console.log(rows.map(row=>({tier:row.tier,place:row.position.id,weapon:row.weapon,combined:row.combined,pass:row.maxPass})));
