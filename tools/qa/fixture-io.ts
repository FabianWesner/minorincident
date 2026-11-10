/* eslint-disable @typescript-eslint/no-explicit-any -- QA tool inspects untyped save JSON */
// Read/write QA checkpoint fixtures (tests/fixtures/saves/qa). Node only.
// Format: gzip (or brotli when gzip would exceed ~200 KB) of compact JSON
//   { kind: 'campaign-save' | 'mission-resume', label, level, description, campaign, resume? }
// A duplicated retry checkpoint is stored once: `campaign.cureResume.checkpoint === '$same'` / `resume.checkpoint === '$same'`.
import { brotliCompressSync, brotliDecompressSync, constants, gunzipSync, gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import type { CampaignSave } from '../../src/sim/progression/Campaign';

export interface QaFixture {
  kind: 'campaign-save' | 'mission-resume'; label: string; level: string; description: string;
  campaign: CampaignSave; resume?: { current: unknown; checkpoint: unknown }; progression?: string; [k: string]: unknown;
}
const SAME = '$same';
const limit = 200_000;

export function writeFixture(dir: string, fixture: QaFixture): { path: string; bytes: number } {
  const copy = structuredClone(fixture) as Record<string, any>;
  const dedupe = (o: any): void => { if (o && JSON.stringify(o.current) === JSON.stringify(o.checkpoint)) o.checkpoint = SAME; };
  dedupe(copy.resume); dedupe(copy.campaign?.cureResume);
  const text = JSON.stringify(copy);
  let bytes = gzipSync(text, { level: 9 }), ext = 'json.gz';
  if (bytes.length > limit) { bytes = brotliCompressSync(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: text.length } }); ext = 'json.br'; }
  const path = `${dir}/${fixture.label}.${ext}`;
  writeFileSync(path, bytes);
  return { path, bytes: bytes.length };
}

export function readFixture(path: string): QaFixture {
  const raw = readFileSync(path);
  const f = JSON.parse((path.endsWith('.br') ? brotliDecompressSync(raw) : gunzipSync(raw)).toString()) as any;
  const expand = (o: any): void => { if (o && o.checkpoint === SAME) o.checkpoint = structuredClone(o.current); };
  expand(f.resume); expand(f.campaign?.cureResume);
  return f as QaFixture;
}
