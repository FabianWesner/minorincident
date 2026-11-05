import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import type {FixtureReceipt} from './fixtures';
import {atomicJson,reportRoot} from './report';
import {evidenceIsArchivedOrMatches} from './reviews';
type Hashed={file:string;sha256:string};
type Review={sourceHash:string;browserHash:string;toolSha256:string;inputSha256:string;captures:{file:string;seen:string}[];sheets:Hashed[];artifacts:Hashed[]};
type Input={sourceHash:string;browserHash:string;toolSha256:string;tier:string;error:string|null;result:{yielded:boolean;runs:{finished:boolean;steps:{id:string}[]}[]}};
type Completion={levels:{steps:{id:string;status:string}[]}[];campaign:{cureResume:{current:{state:{states:Record<string,boolean>;counters:Record<string,number>}}}}};
/** Partial physical clauses only: this does not complete either acceptance row. */
export function fix55L10EndingReceipts(sourceHash:string,browserHash:string,batch:3|4):{path:string;receipt:FixtureReceipt}[]{
 const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex'),result:{path:string;receipt:FixtureReceipt}[]=[];
 for(const tier of ['low','high'] as const){
  const inputPath=`docs/reports/fix51-r10c/L10-${tier}-batch-${batch}-input.json`,reviewPath=`docs/reports/fix51-r10c/L10-${tier}-batch-${batch}/review.json`;
  if(!existsSync(inputPath)||!existsSync(reviewPath))continue;
  const input=JSON.parse(readFileSync(inputPath,'utf8')) as Input,review=JSON.parse(readFileSync(reviewPath,'utf8')) as Review;
  if(input.sourceHash!==sourceHash||input.browserHash!==browserHash||input.tier!==tier||input.error||input.toolSha256!==sha(readFileSync('tools/qa/accept/l10-batch-r10.ts'))||review.sourceHash!==sourceHash||review.browserHash!==browserHash||review.toolSha256!==input.toolSha256||review.inputSha256!==sha(readFileSync(inputPath)))continue;
  if(!review.captures.length||review.captures.some(c=>!c.seen.trim())||review.sheets.some(f=>!evidenceIsArchivedOrMatches(f.file,f.sha256))||review.artifacts.some(f=>!existsSync(f.file)||sha(readFileSync(f.file))!==f.sha256))continue;
  const completionPath=review.artifacts.find(a=>a.file.endsWith('/late-input-completion.json.gz'))?.file;
  if(!completionPath)continue;
  const completion=JSON.parse(gunzipSync(readFileSync(completionPath)).toString()) as Completion;
  const state=completion.campaign.cureResume.current.state,path=`${reportRoot}/receipts/L10-${tier}-physical-batch-${batch}.json`;
  const receipt:FixtureReceipt={version:1,level:'L10',tier,sourceHash,fixtureHash:sha(readFileSync(new URL(import.meta.url))),errors:[],checks:[],observations:{inputPath,reviewPath,completionPath,limits:'Protected courier, inherited production Resume; no timing/performance, immunity, direct rocket count or full motion qualification.'}};
  const add=(id:string,clause:string,value:unknown,target:string,pass:boolean)=>receipt.checks.push({id,clause,value,target,status:pass?'PASS':'FAIL',tier,policy:'real-input-webgl2',receipt:reviewPath});
  if(batch===3)add('L10-12','physical Mega fight reaches post-death release',{megaDead:state.states['mega-dead'],steps:input.result.runs[0]?.steps},'actual input reaches release and persistent mission Mega-dead state; direct-hit count/corpse identity remain separate',state.states['mega-dead']===true&&input.result.runs.some(r=>r.steps.some(s=>s.id==='release')));
  else{
   add('L10-14','reviewed actual ending title and returned start menu',{finished:input.result.runs[0]?.finished,steps:completion.levels[0]?.steps,captures:review.captures.map(c=>c.file)},'actual epilogue/credits complete; reviewed title and returned menu captures at both zooms; no species/control timing claim',!input.result.yielded&&input.result.runs.some(r=>r.finished)&&['epilogue','credits'].every(id=>completion.levels[0]?.steps.some(s=>s.id===id&&s.status==='completed'))&&review.captures.filter(c=>c.file.includes('credits-t')).length===2&&review.captures.some(c=>c.file.endsWith('late-input-L10-result.jpg')));
   add('L10-14','physical saved epilogue counter at completion',state.counters['epilogue-ticks'],'7200–10800ticks; low crosses Resume at91s, high whole run; movement input remains untested',state.counters['epilogue-ticks']>=7200&&state.counters['epilogue-ticks']<=10800);
  }
  atomicJson(path,receipt);result.push({path,receipt});
 }
 return result;
}
