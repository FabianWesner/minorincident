/** Native scope audit and reproducible spatial sweeps. Does not launch a browser or claim GPU/visual acceptance. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { strict as assert } from 'node:assert';
import { cure } from '../../src/levels/L10/district';
import { cureVignetteSet, cureVignetteRoutes, cureLineLength, cureLineDistance } from '../../src/levels/L10/vignettes';
import { cureRoadsideBelt } from '../../src/levels/L10/roadsideBelt';
import { cureCrossingStories } from '../../src/levels/L10/crossingStories';
import { cureForecourtDecor } from '../../src/levels/L10/forecourts';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';

const directory='docs/reports/eg-l10-vignettes/evidence';mkdirSync(directory,{recursive:true});
const layout=JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json','utf8')) as DistrictLayout;
const belt=cureRoadsideBelt(layout.placements),crossings=cureCrossingStories([...layout.placements,...belt]),apron=cureForecourtDecor([...layout.placements,...belt,...crossings]);
const baseline=[...layout.placements,...belt,...crossings,...apron],start=performance.now(),set=cureVignetteSet(baseline),constructionMs=performance.now()-start;
writeFileSync('/private/tmp/eg-l10-vignettes-before.json',JSON.stringify([...belt,...crossings,...apron]));
const all=[...baseline,...set.placements],byId=new Map(all.map(p=>[p.id,p]));
assert.deepEqual(set.missed,[],'Every station, five messages/region and unique helicopter must be admitted');
assert(set.scenes.every(s=>s.pieces.length>=3&&s.pieces.length<=8),'Every scene must be a complete 3–8 piece story');
assert(set.placements.every(p=>p.fixed&&p.decor),'Every new key piece stays fixed and outside the prop sim');
assert(set.placements.every(p=>!p.fieldLight&&!p.roadLife),'No added light/particle capacity');
assert(set.scenes.every(s=>s.pieces.every(id=>byId.has(id))));
const scatter=set.placements.filter(p=>p.id.includes('-scatter-'));
assert.equal(scatter.filter(p=>p.highOnly).length*2,scatter.length,'Low must halve loose scatter exactly');
const casings=set.decals.filter(p=>p.cell===12);assert.equal(casings.filter(p=>p.highOnly).length*2,casings.length);
const colliders=placementColliders(set.placements,[]);
assert(colliders.length>0&&colliders.every(c=>c.aabb.physicsOnly),'Large fixed stories must block the courier without adding AI nav walls');
const consoleAt=cure.anchors['cure-console'];
assert(set.placements.every(p=>Math.hypot(p.position[0]-consoleAt[0],p.position[2]-consoleAt[1])>=60));
const routes=cureVignetteRoutes(),regions=cure.regions.map((r,i)=>{
  const messages=set.decals.filter(d=>!d.ground&&set.scenes.some(s=>s.region===i&&s.pieces.includes(d.scene)));
  const scenes=set.scenes.filter(s=>s.region===i),small=scenes.filter(s=>s.route===`r${i+1}-road`&&!s.large),large=scenes.filter(s=>s.large);
  assert(messages.length>=5,`R${i+1}: five wall messages`);assert(large.length>=2&&large.length<=3,`R${i+1}: 2–3 large set pieces`);
  assert(scenes.filter(s=>s.theme==='home-refuge').length<=1,`R${i+1}: at most one home last refuge`);
  const length=cureLineLength(r.route),eligible=length-(i===6?70:0),density=small.length/eligible*1000;
  assert(density>=15&&density<=25,`R${i+1}: small vignette density ${density}`);
  const bodies=small.flatMap(s=>s.pieces.map(id=>byId.get(id)!)).filter(p=>p.assetId.startsWith('prop.l10-corpse-'));
  assert(bodies.length/eligible*1000>=15&&bodies.length/eligible*1000<=25,`R${i+1}: overland body density`);
  return {region:r.id,routeMetres:+length.toFixed(1),eligibleMetres:+eligible.toFixed(1),smallScenes:small.length,scenesPerKm:+density.toFixed(2),overlandBodies:bodies.length,bodiesPerKm:+(bodies.length/eligible*1000).toFixed(2),large:large.length,messages:messages.length};
});
assert.equal(set.scenes.filter(s=>s.theme==='helicopter-crash').length,1);
assert(set.placements.some(p=>p.id.endsWith('-broken-door')),'The residential refuge needs its broken furniture/door barricade');
const jam=set.scenes.find(s=>s.theme==='evacuation-jam')!;assert(jam);
const jamVehicles=jam.pieces.map(id=>byId.get(id)!).filter(p=>!p.assetId.startsWith('prop.l10-corpse-'));
assert(Math.max(...jamVehicles.map(p=>p.position[0]))-Math.min(...jamVehicles.map(p=>p.position[0]))>=100,'Jam must span at least 100 m');
// Sweep both the canonical route and measured physical crossings at the normal 4.5 m/s movement speed.
// These are geometric coverage inputs; fresh real-input browser traces remain a separate QA item.
let tick=0;const trace:string[]=[];
for(const route of routes){tick+=600;for(let i=1;i<route.line.length;i++){
  const a=route.line[i-1],b=route.line[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(d/4.5);
  for(let k=0;k<n;k++){const t=k/n;trace.push(JSON.stringify({routeTrace:{level:'L10',step:route.id,tick:tick+=60,x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,enemies:0}}));}
}}
writeFileSync('/private/tmp/eg-l10-vignettes-sweep.jsonl',trace.join('\n')+'\n');
writeFileSync(`${directory}/spatial-sweep.jsonl.gz`,gzipSync(trace.join('\n')+'\n'));
writeFileSync(`${directory}/scene-catalogue.json.gz`,gzipSync(JSON.stringify(set)));
const summary={constructionMs:+constructionMs.toFixed(2),scenes:set.scenes.length,newPlacements:set.placements.length,staticBodies:set.placements.filter(p=>p.assetId.startsWith('prop.l10-corpse-')).length,wallMessages:set.decals.filter(d=>!d.ground).length,highScatter:scatter.length,lowScatter:scatter.length/2,highCasings:casings.length,lowCasings:casings.length/2,physicsOnlyColliders:colliders.length,newLights:0,missed:set.missed,regions,
  routeCoverage:routes.map(r=>({id:r.id,length:cureLineLength(r.line),nearBodies:set.placements.filter(p=>p.assetId.startsWith('prop.l10-corpse-')&&cureLineDistance([p.position[0],p.position[2]] as Point,r.line)<=20).length})),
  validation:'Native data/asset/clearance audit; GPU timing and gameplay visual captures are pending under the no-browser rule.'};
writeFileSync(`${directory}/scope-audit.json`,JSON.stringify(summary,null,2)+'\n');
console.log(`L10 vignette scope audit PASS: ${set.scenes.length} complete scenes, ${summary.staticBodies} static bodies, ${summary.wallMessages} wall messages; ${Math.round(constructionMs)} ms generation`);
