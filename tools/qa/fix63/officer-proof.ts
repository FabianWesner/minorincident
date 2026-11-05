/** Boundary controls run the production PO 11-05 officer evaluator. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { l3SegmentOnePass } from '../accept/battery-fixtures';
const cases = [
  {name:'one officer hit with no kill qualifies',report:{s1:{completed:true,officerHits:1,officerKills:0,playerKills:99,damage:99},outcome:'complete' as const,deaths:0},expected:true},
  {name:'zero officer hits fails despite kills',report:{s1:{completed:true,officerHits:0,officerKills:5,playerKills:0,damage:0},outcome:'complete' as const,deaths:0},expected:false},
  {name:'exactly100HP fails',report:{s1:{completed:true,officerHits:1,officerKills:0,playerKills:0,damage:100},outcome:'complete' as const,deaths:0},expected:false},
  {name:'later death does not invalidate measured segment',report:{s1:{completed:true,officerHits:1,officerKills:0,playerKills:0,damage:0},outcome:'complete' as const,deaths:1},expected:true},
  {name:'unfinished later route does not invalidate measured segment',report:{s1:{completed:true,officerHits:1,officerKills:0,playerKills:0,damage:0},outcome:'timeout' as const,deaths:0},expected:true},
  {name:'unfinished segment stays unqualified',report:{s1:{completed:false,officerHits:1,officerKills:0,playerKills:0,damage:0},outcome:'timeout' as const,deaths:0},expected:undefined},
  {name:'missing segment observation stays unqualified',report:{s1:null,outcome:'complete' as const,deaths:0},expected:undefined},
].map(c=>{const actual=l3SegmentOnePass(c.report);assert.equal(actual,c.expected,c.name);return {...c,expected:c.expected??'NOT CHECKED',actual:actual??'NOT CHECKED'};});
mkdirSync('docs/reports/fix64-a', { recursive: true });
writeFileSync('docs/reports/fix64-a/L3-07-checker-proof.json',JSON.stringify({checkerSha256:createHash('sha256').update(readFileSync('tools/qa/accept/battery-fixtures.ts')).digest('hex'),method:'Synthetic clause controls against the same function used by the native battery; the row is limited to visible squad hits and player damage in segment 1.',cases},null,2)+'\n');
console.log('L3-07: all7 boundary/absence controls pass');
