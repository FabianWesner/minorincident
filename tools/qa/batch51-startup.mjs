/** Recheck the three reported first-frame hitches without photo/pose warm-up. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { runSession } from '../playtest/session.ts';

Object.assign(process.env, { PLAYTEST_BACKEND: 'webgpu', PLAYTEST_GOD: '1', PLAYTEST_POSE_PROBES: '0', PLAYTEST_ACCEPTANCE_CAPTURES: '0', PLAYTEST_THREAT_AUDIT: '0', PLAYTEST_THREAT_CAPTURES: '0' });
const rows = [];
for (const level of ['L1', 'L8', 'L9']) for (const quality of ['low', 'high']) {
  const out = `test-results/batch51/startup/${level}-${quality}`, tag = `startup-${level}-${quality}`;
  mkdirSync(out, { recursive: true });
  try {
    const result = await runSession({ origin: 'http://127.0.0.1:4901', out, levels: [level], quality, zoom: 1.5, heroine: 'female', entry: level === 'L1' ? 'new' : 'debug', profile: `${out}/profile`, levelMinutes: 1, stopAfterLevel: true, noSkip: true, tag, sampleSeconds: 20 });
    const frames = JSON.parse(readFileSync(`${out}/${tag}-frames.json`, 'utf8')).filter(f => f.level === level && f.playMs > 200);
    rows.push({ level, quality, run: result.runs[0], framesOver200: frames, issues: result.issues, firstTenSecondsFramesOver200: frames.filter(f => f.tick <= 600) });
  } catch (error) { rows.push({ level, quality, failure: String(error) }); }
  writeFileSync('docs/reports/batch51-qa/startup.json', JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(rows.at(-1)));
}
