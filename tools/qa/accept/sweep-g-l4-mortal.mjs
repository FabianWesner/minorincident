/** Match the G-25 L4 high report with normal courier mortality. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runSession } from '../../playtest/session.ts';
import { provenance } from './probe.ts';

const out = resolve('test-results/sweep-g/G-25-L4-high-mortal');
mkdirSync(out, { recursive: true });
const receipt = { ...provenance(), generatedAt: new Date().toISOString(), immortal: false, backend: 'webgpu', tier: 'high', run: null, error: null };
try {
  receipt.run = await runSession({ origin: process.env.SWEEP_G_ORIGIN ?? 'http://127.0.0.1:4981', out, levels: ['L4'], quality: 'high', zoom: 1.5,
    heroine: 'female', entry: 'debug', profile: resolve(out, 'profile'), levelMinutes: 9, stopAfterLevel: true, tag: 'mortal', noSkip: true });
} catch (error) { receipt.error = String(error); }
finally { writeFileSync('docs/reports/sweep-g/G-25-L4-high-mortal.json', JSON.stringify(receipt, null, 2)); }
process.exitCode = receipt.error || receipt.run?.issues.some(issue => ['console-error', 'page-error'].includes(issue.kind)) ? 1 : 0;
