import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
import { validateDeviceEvidence, type DeviceEvidence } from '../../tools/performance/deviceEvidence';
test('T-E18-08 @E18-AC08 @manual recorded physical iOS and Android L6 p50 >=30fps', () => {
  const dir = 'test-results/perf/devices';
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')) : [];
  const recordings = files.map(file => ({ file, evidence: JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as DeviceEvidence }));
  for (const platform of ['ios', 'android']) {
    const matching = recordings.filter(r => r.evidence.platform === platform && validateDeviceEvidence(r.evidence).length === 0);
    expect(matching.length, `AC08 needs a physical ${platform} recording from /perf-device.html in ${dir}; emulation does not satisfy it. Errors: ${JSON.stringify(recordings.map(r => ({ file: r.file, errors: validateDeviceEvidence(r.evidence) })))}`).toBeGreaterThan(0);
  }
});
