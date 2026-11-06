import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import type {FixtureReceipt} from './fixtures';
import {atomicJson,reportRoot} from './report';
import {evidenceIsArchivedOrMatches} from './reviews';
type Hashed={file:string;sha256:string};
type Capture=Hashed&{label:string;zoom:number;state?:{tick:number;target:{id:number;hp:number;archetype:string;infected?:object|null;rising?:object};figure?:{drawn:boolean;feet:number[][]}}};
type Row={tier:string;species?:string;settled?:boolean;completed?:boolean;setup:{backend:string;quality:string;target?:{id:number;hp:number};originalSpeciesIds?:number[];roster:number[]};seed:{fixtureRoster?:number[]};attackers?:{hp:number}[];pre?:{tick:number;target:{id:number;hp:number;infected?:object|null}};commands:{keys:string[]}[];captures:Capture[];errors:string[]};
type Input={sourceHash:string;browserHash:string;toolSha256:string;rows:Row[]};
type Review={sourceHash?:string;browserHash?:string;toolSha256?:string;inputSha256?:string;captures:(Hashed&{seen:string})[];sheets?:Hashed[];sheet?:Hashed;rawCleanup:{allPersonallyReviewed:boolean;verifiedAndDeleted:number}};
export const animalSpecies=['lion','gorilla','elephant','zebra','flamingo'];
export function l8AnimalReceipts(sourceHash:string,browserHash:string):{path:string;receipt:FixtureReceipt}[]{
 const root='docs/reports/sweep-c5/L8-08',sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),results=[];
 for(const tier of ['low','high'] as const){
  const checks:FixtureReceipt['checks']=[];
  for(const species of animalSpecies){
   const ip=`${root}/animals-${tier}-${species}.json.gz`,rp=`${root}/animals-${tier}-${species}-review.json`;if(!existsSync(ip)||!existsSync(rp))continue;
   const raw=gunzipSync(readFileSync(ip)),input=JSON.parse(raw.toString()) as Input,review=JSON.parse(readFileSync(rp,'utf8')) as Review,r=input.rows[0];
   if(input.sourceHash!==sourceHash||input.browserHash!==browserHash||![sha(readFileSync('tools/qa/accept/sweep-c5-l8-animals.mjs')),sha(readFileSync(`${root}/animal-one-biter-v1.mjs`))].includes(input.toolSha256)||review.inputSha256!==sha(raw)||review.sourceHash!==sourceHash||review.browserHash!==browserHash||review.toolSha256!==input.toolSha256)continue;
   const seen=review.rawCleanup.allPersonallyReviewed&&review.rawCleanup.verifiedAndDeleted===8&&review.captures.length===8&&review.sheets?.length===1&&review.sheets.every(s=>evidenceIsArchivedOrMatches(s.file,s.sha256))&&r?.captures.length===8&&r.captures.every(c=>review.captures.some(v=>v.file===c.file&&v.sha256===c.sha256&&v.seen.trim()));
   const identity=r?.setup.target?.id,converted=r?.settled&&r.pre?.tick===3594&&r.pre.target.id===identity&&r.pre.target.hp===100&&!r.pre.target.infected&&r.attackers?.length===1&&r.attackers[0].hp===60&&r.seed.fixtureRoster?.length===0&&r.setup.roster.length===0;
   const frames=r&&['healthy','infected','move15','move30'].every(label=>[.5,1.5].every(zoom=>r.captures.some(c=>c.label===label&&c.zoom===zoom&&!!c.state&&(c.state.target.id===identity||!!r.setup.originalSpeciesIds?.includes(c.state.target.id))&&c.state.target.hp>0&&c.state.figure?.drawn&&c.state.figure.feet.length>=2&&(label==='healthy'?!c.state.target.infected:c.state.target.archetype===`infected.${species}`&&!!c.state.target.infected&&!c.state.target.rising))));
   const pass=r?.tier===tier&&r.species===species&&r.setup.backend==='webgl'&&r.setup.quality===tier&&!r.errors.length&&r.commands.some(c=>c.keys.length>0)&&converted&&frames&&seen;
   checks.push({id:'L8-08',clause:`reviewed original ${species} conversion and moving paired views`,tier,policy:'physical-animal',status:pass?'PASS':'FAIL',value:{converted,frames,seen,errors:r?.errors},target:'original healthy same-ID animal turns through one ordinary60HP biter; actual physical movement; all8 normal-L8 paired-zoom panels personally reviewed; exact O-review judges snarl/wounds/legs/readability',receipt:rp});
  }
  for(const mode of ['canopy','postbreach-canopy']){
   const ip=`${root}/${tier}-${mode}.json.gz`,rp=`${root}/${mode==='canopy'?'canopy':'postbreach-canopy'}-review.json`;if(!existsSync(ip)||!existsSync(rp))continue;
   const input=JSON.parse(gunzipSync(readFileSync(ip)).toString()) as Input,review=JSON.parse(readFileSync(rp,'utf8')) as Review,r=input.rows[0];
   const tool=`tools/qa/accept/sweep-c5-l8-canopy${mode==='canopy'?'':'-hold'}.mjs`;
   if(input.sourceHash!==sourceHash||input.browserHash!==browserHash||input.toolSha256!==sha(readFileSync(tool)))continue;
   const seen=review.rawCleanup.allPersonallyReviewed&&review.rawCleanup.verifiedAndDeleted===4&&review.captures.length===4&&!!review.sheet&&evidenceIsArchivedOrMatches(review.sheet.file,review.sheet.sha256)&&r?.captures.length===2&&r.captures.every(c=>review.captures.some(v=>v.file===c.file&&v.sha256===c.sha256&&v.seen.trim()));
   const pass=r?.completed&&r.tier===tier&&!r.errors.length&&r.setup.backend==='webgl'&&r.setup.quality===tier&&r.commands.some(c=>c.keys.length>0)&&seen;
   checks.push({id:'L8-08',clause:`reviewed physical ${mode} night readability`,tier,policy:'physical-animal',status:pass?'PASS':'FAIL',value:{completed:r?.completed,seen,errors:r?.errors},target:'actual qualified campaign WASD approach and paired photos at historical canopy point; exact O-review judges night courier readability',receipt:rp});
  }
  if(!checks.length)continue;const path=`${reportRoot}/receipts/L8-${tier}-animals-browser.json`,receipt:FixtureReceipt={version:1,level:'L8',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],observations:{root},checks};atomicJson(path,receipt);results.push({path,receipt});
 }
 return results;
}
