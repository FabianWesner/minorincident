import { expect, test } from 'vitest';
import { healthBarColors, nightHealthBarGains } from '../../../src/ui/health';

const luminance = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);

test('ruined-city night bars retain 3:1 fill/background/outline contrast without daylight glare', () => {
  const levels = [luminance(healthBarColors.background), luminance(healthBarColors.fill) * nightHealthBarGains.fill, luminance(healthBarColors.outline) * nightHealthBarGains.outline];
  for (let i = 0; i < levels.length; i++) for (let j = i + 1; j < levels.length; j++) {
    expect((Math.max(levels[i], levels[j]) + .05) / (Math.min(levels[i], levels[j]) + .05)).toBeGreaterThanOrEqual(3);
  }
  expect(levels[2]).toBeLessThan(luminance(healthBarColors.outline));
});
