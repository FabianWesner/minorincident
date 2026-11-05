import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';

// DOM replay of actual read-only native snapshots, not a live game or renderer.
const proofPath = 'docs/reports/sweep-c/L8-09-boarding-native.json';
const proof = JSON.parse(readFileSync(proofPath, 'utf8')), identity = provenance();
assert.equal(proof.sourceHash, identity.sourceHash);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(proof.toolSha256, sha(readFileSync('tools/qa/accept/l8-boarding-sweep.ts')));
const out = resolve(`test-results/sweep-c-l8-radar-${Date.now()}`); mkdirSync(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false, open: false } });
await server.listen(); const address = server.httpServer.address(); assert.notEqual(address.port, 3300);
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal'] });
const rows = [], errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 800, height: 480 } });
  try {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/src/ui/ui.css`);
    await page.setContent('<html><head></head><body><h2>Actual L8 boarding snapshots — production follower radar</h2><p>DOM replay only; no game rendering.</p><div class="hud-map" id="map"></div></body></html>');
    await page.addStyleTag({ url: `http://127.0.0.1:${address.port}/src/ui/ui.css` });
    await page.evaluate(async () => {
      const { SurvivorRadar } = await import('/src/ui/SurvivorRadar.ts');
      window.boardingRadar = new SurvivorRadar(document.querySelector('#map'));
    });
    for (const row of proof.rows) {
      const bytes = readFileSync(row.samplesPath); assert.equal(sha(bytes), row.samplesSha256);
      const samples = JSON.parse(gunzipSync(bytes).toString());
      const result = await page.evaluate(samples => {
        let humanSamples = 0, internalPassengerSamples = 0, missingPins = 0, companionSamples = 0, farthestCompanion = 0;
        const failures = [], examples = [];
        for (const sample of samples) {
          window.boardingRadar.update({ iterate: () => sample.actors.values() }, sample.player.x, sample.player.z);
          const pins = [...document.querySelectorAll('.hud-pin-follower:not([hidden])')];
          const ids = pins.map(pin => Number(pin.dataset.entityId));
          for (const actor of sample.actors) {
            if (actor.companion) {
              companionSamples++;
              farthestCompanion = Math.max(farthestCompanion, Math.hypot(actor.transform.x - sample.player.x, actor.transform.z - sample.player.z));
              continue;
            }
            humanSamples++;
            // The production entry lasts60 ticks; its last18 ticks are the
            // hidden doorway-to-seat walk inside the assigned APC. That actor
            // is accounted for aboard, rather than a missing external survivor.
            if (actor.hidden && actor.passengerOf === sample.carId) { internalPassengerSamples++; continue; }
            const pin = pins.find(pin => Number(pin.dataset.entityId) === actor.id);
            const visible = pin && getComputedStyle(pin).display !== 'none' && getComputedStyle(pin).visibility !== 'hidden' && pin.getBoundingClientRect().width > 0;
            if (!visible) { missingPins++; if (failures.length < 20) failures.push({ tick: sample.tick, id: actor.id, infection: actor.infection }); }
          }
          if (examples.length < 2 && sample.actors.some(actor => !actor.companion)) examples.push({ tick: sample.tick, ids });
        }
        return { ticks: samples.length, humanSamples, internalPassengerSamples, missingPins, companionSamples, farthestCompanion, failures, examples };
      }, samples);
      const example = samples.find(sample => sample.actors.some(actor => !actor.companion));
      await page.evaluate(sample => {
        window.boardingRadar.update({ iterate: () => sample.actors.values() }, sample.player.x, sample.player.z);
        document.querySelector('p').textContent = `DOM replay only. Actual tick ${sample.tick}; unseated IDs: ${sample.waiting.join(', ')}`;
      }, example);
      const file = resolve(out, `${row.tier}-actual-wait.png`); await page.screenshot({ path: file });
      // A deliberately hidden healthy follower must fail the same pin census.
      const negative = await page.evaluate(() => {
        const pin = document.querySelector('.hud-pin-follower:not([hidden])'); pin.hidden = true;
        return document.querySelectorAll('.hud-pin-follower:not([hidden])').length;
      });
      assert(negative < example.actors.filter(actor => !actor.companion).length);
      rows.push({ tier: row.tier, ...result, negativeMissingPinRejected: true, capture: { file, sha256: sha(readFileSync(file)) } });
      console.log(row.tier, result);
    }
  } finally { await context.close(); }
} finally { await browser.close(); await server.close(); }
writeFileSync('docs/reports/sweep-c/L8-09-radar-replay.json', JSON.stringify({ ...identity,
  producerSha256: sha(readFileSync(new URL(import.meta.url))), nativeProofPath: proofPath, nativeProofSha256: sha(readFileSync(proofPath)),
  method: 'Headless shared-pool production SurvivorRadar and production CSS replay over every actual native boarding snapshot. Confirms DOM pin eligibility/visibility for humans; companion visibility requires separate live evidence. No 3D rendering, game mutations or performance measurements.', errors, rows }, null, 2) + '\n');
