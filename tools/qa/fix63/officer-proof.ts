/** Boundary controls run the production PO 11-05 officer evaluator. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { l3SegmentOnePass } from '../accept/battery-fixtures';
const cases = [
  {name:'one officer kill at1percent share and99HP damage qualifies',report:{s1:{officerKills:1,playerKills:99,damage:99},outcome:'complete' as const,deaths:0},expected:true},
  {name:'zero officer kills fails',report:{s1:{officerKills:0,playerKills:99,damage:0},outcome:'complete' as const,deaths:0},expected:false},
  {name:'exactly100HP fails',report:{s1:{officerKills:5,playerKills:0,damage:100},outcome:'complete' as const,deaths:0},expected:false},
  {name:'incomplete route stays unqualified',report:{s1:{officerKills:5,playerKills:0,damage:0},outcome:'timeout' as const,deaths:0},expected:undefined},
  {name:'retry guard stays unqualified',report:{s1:{officerKills:5,playerKills:0,damage:0},outcome:'complete' as const,deaths:1},expected:undefined},
  {name:'missing segment observation stays unqualified',report:{s1:null,outcome:'complete' as const,deaths:0},expected:undefined},
].map(c=>{const actual=l3SegmentOnePass(c.report);assert.equal(actual,c.expected,c.name);return {...c,expected:c.expected??'NOT CHECKED',actual:actual??'NOT CHECKED'};});
writeFileSync('docs/reports/fix63-a/L3-07-checker-proof.json',JSON.stringify({checkerSha256:createHash('sha256').update(readFileSync('tools/qa/accept/battery-fixtures.ts')).digest('hex'),method:'Synthetic clause controls against the same function used by the native battery.',cases},null,2)+'\n');
console.log('L3-07: all6 boundary/absence controls pass');
