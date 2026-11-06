import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate } from './evaluate';
import { atomicJson } from './report';
import { provenance } from './probe';
const path = 'docs/reports/fix55-c/L8-enclosure-paths.json', bytes = readFileSync(path), original = JSON.parse(bytes.toString()), cases = [];
try {
  for (const tier of ['low', 'high']) {
    const nativePath = `docs/reports/fix51-verify/receipts/L8-${tier}-complete.json`, native = JSON.parse(readFileSync(nativePath, 'utf8'));
    const verdict = () => evaluate(native, nativePath).find(check => check.id === 'L8-07' && check.clause === 'two independent body-clear enclosure exits at2.5m width')?.status;
    assert.equal(verdict(), 'PASS'); cases.push({ tier, fault: 'original', observed: verdict() });
    for (const fault of ['missing north', 'missing south', 'narrow clearance', 'blocked crossing', 'blocked endpoints', 'disconnected interior', 'disconnected APC', 'ineffective slab control']) {
      const proof = structuredClone(original), row = proof.rows.find((row: { tier: string }) => row.tier === tier), enclosure = row.enclosures[0], gate = enclosure.gates[0];
      if (fault === 'missing north') enclosure.gates = enclosure.gates.filter((gate: { direction: string }) => gate.direction !== 'north');
      if (fault === 'missing south') enclosure.gates = enclosure.gates.filter((gate: { direction: string }) => gate.direction !== 'south');
      if (fault === 'narrow clearance') row.clearanceRadius = .5;
      if (fault === 'blocked crossing') gate.crossing = false;
      if (fault === 'blocked endpoints') gate.endpoints = false;
      if (fault === 'disconnected interior') gate.interiorMetres = null;
      if (fault === 'disconnected APC') gate.escapeMetres = null;
      if (fault === 'ineffective slab control') gate.negativeBlocked = false;
      writeFileSync(path, JSON.stringify(proof)); assert.equal(verdict(), 'FAIL', `${tier}: ${fault}`); cases.push({ tier, fault, observed: verdict() });
      writeFileSync(path, bytes);
    }
  }
} finally { writeFileSync(path, bytes); }
atomicJson('docs/reports/sweep-c5/L8-07/checker-controls.json', { ...provenance(), cases });
console.log('Sixteen semantic width/path faults rejected; exact original evidence restored.');
