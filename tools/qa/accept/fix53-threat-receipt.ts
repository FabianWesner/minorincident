/** Freeze current row-specific native threat evidence without erasing historical FAILs. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { provenance } from './probe';
const id=process.argv[2];if(!['L5-05','L6-05','L6-07','L7-05'].includes(id))throw new Error('Use assigned threat row');
const level=id.split('-')[0],identity=provenance();
const report=JSON.parse(readFileSync(`docs/reports/fix51-verify/${level}.json`,'utf8'));
assert.equal(report.sourceHash,identity.sourceHash);
const row=report.rows.find((r:{id:string})=>r.id===id);assert(row&&row.checks.length);
const receipts=[...new Set(row.checks.map((c:{receipt:string})=>c.receipt))] as string[];
const evidence=receipts.map(file=>({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}));
const review:Record<string,string>={
 'L5-05':'P: Can a competent player still walk to the survivors, collect them and leave without protecting them? Current numeric route/contact/reach checks pass; only the PO can close the prior finding.',
 'L6-05':'Current low/high complete and stationary breach-contact/reach checks pass. Prior zero-contact finding remains open for PO confirmation; this does not rewrite the historical result.',
 'L6-07':'P: Does covering the retreat while protecting the group feel dangerous enough? Current ordinary mortal route loses80HP and meets attack/cap targets at both qualities. Prior finding remains open.',
 'L7-05':'Current low/high complete/stationary contact, rate and bounded reach checks pass. Prior zero-contact finding remains open for PO confirmation.'
};
writeFileSync(`docs/reports/fix53-b/${id}.json`,JSON.stringify({...identity,row:id,expected:row.expected,currentStatus:row.currentStatus,automatedComplete:row.automatedComplete,historicalStatus:row.status,historical:row.historical,method:'Fresh current-source native complete and survival-protected stationary routes. Competent metrics use ordinary mortal complete input; stationary probes establish passive potential contact. No criteria, counts, clocks, caps or policy changes.',checks:row.checks,evidence,remaining:review[id]},null,2)+'\n');
console.log(id,row.currentStatus,'historical',row.status);
