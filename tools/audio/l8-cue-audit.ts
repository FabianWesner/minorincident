/** Decode the shipped sprites at their actual catalog offsets; native content audit, no browser needed. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { audioCues } from '../../src/data/audioCues';
const prefix = /^telegraph\.(flamingo\.dive|zebra\.(stampede|kick)|monkey\.(grab|debris)|lion\.(roar|pounce|flank)|gorilla\.(roar|pound|grab-throw)|elephant\.(charge|swipe))(\.|$)/;
const rate = 8000, rows = [];
for (const codec of ['webm', 'm4a']) {
  const path = `public/assets/audio/telegraph.${codec}`;
  const bytes = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], { maxBuffer: 16 * 1024 * 1024 });
  const pcm = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const cues = Object.values(audioCues).filter(c => prefix.test(c.id)).map(c => {
    const samples = pcm.subarray(Math.ceil(c.offset * rate), Math.floor((c.offset + c.duration) * rate));
    let peak = 0, power = 0; for (const s of samples) { peak = Math.max(peak, Math.abs(s)); power += s * s; }
    return { id: c.id, offset: c.offset, duration: c.duration, peak, rms: Math.sqrt(power / (samples.length || 1)), pass: samples.length >= c.duration * rate - 2 && peak > .001 };
  });
  rows.push({ codec, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), duration: pcm.length / rate, cues });
}
const pass = rows.every(r => r.cues.length === 52 && r.cues.every(c => c.pass));
mkdirSync('test-results/l8-audio', { recursive: true });
writeFileSync('test-results/l8-audio/sprites.json', JSON.stringify({ pass, method: 'Decode both shipped codecs and check all 13 L8 special cues plus their four variations at catalog offsets. Listening quality requires Browser QA.', rows }, null, 2) + '\n');
console.log(JSON.stringify({ pass, codecs: rows.map(r => ({ codec: r.codec, cues: r.cues.length, duration: r.duration })) }));
if (!pass) process.exitCode = 1;
