import { heldHandoverProbe, readHandoverFixture } from '../../../tools/playtest/fixes-13j-handover';
import { test } from '../fixtures';

test.use({ viewport: { width: 1280, height: 720 } });

test('Q-123 L6 to L7 handover stays playable for 90 seconds with A and W held across the transition', async ({ page, baseURL }) => {
  test.setTimeout(600_000);
  const observations = await heldHandoverProbe(page, baseURL!, readHandoverFixture());
  await test.info().attach('three-held-key-handovers', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' });
});
