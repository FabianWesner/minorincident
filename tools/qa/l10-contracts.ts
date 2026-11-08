/** Existing exact mechanics fixtures, kept separate from input-only route receipts. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runFixtures } from './accept/fixtures';
const out=process.argv.find((arg,i)=>process.argv[i-1]==='--out')??'test-results/l10-pacing/contracts.json';
const results=[];
const hash=createHash('sha256');
for(const path of execFileSync('git',['ls-files','src','layouts/D-CURE'],{encoding:'utf8'}).trim().split('\n').sort())hash.update(path).update(readFileSync(path));
const sourceHash=hash.digest('hex');
for(const tier of ['low','high'] as const)results.push(await runFixtures('L10',tier,sourceHash,out));
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({method:'Existing controlled fixtures: exact dog, charge boundary, minigun, cure and damage contracts. These do not establish route delivery or renderer pixels.',results},null,2));
console.log(JSON.stringify(results.map(r=>({tier:r.tier,checks:r.checks.length,failures:r.checks.filter(c=>c.status!=='PASS'),errors:r.errors})),null,2));
if(results.some(r=>r.errors.length||r.checks.some(c=>c.id.startsWith('L10-')&&c.status!=='PASS')))process.exitCode=1;
