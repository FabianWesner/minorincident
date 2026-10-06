import { axeTool } from '../../tools/axe-tool';
import { expect, test } from './fixtures';
import { missionSandbox } from '../fixtures/scenarios/mission-sandbox';
import { menuUrl, keyboardActivate } from './ui-helpers';
interface AxeResult { violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }
declare global { interface Window { axe: { run(context: Element): Promise<AxeResult> } } }
test('T-E14-09 @E14 @E14-AC09 keyboard focus, accessible names and axe no critical menu violations', async ({ page }) => {
  // Test-only audit tool; never imported into the game bundle.
  const axe = axeTool();
  await page.goto(menuUrl); await expect(page.getByTestId('menu-title')).toBeVisible();
  await page.addScriptTag({ content: axe });
  const audit = async (id: string) => {
    const panel = page.getByTestId(id); await expect(panel).toBeVisible();
    const result = await panel.evaluate(element => window.axe.run(element));
    expect(result.violations.filter(v => v.impact === 'critical')).toEqual([]);
    for (const button of await panel.getByRole('button').all()) await expect(button).toHaveAccessibleName(/\S/);
    const focused = panel.locator(':focus'); expect(await focused.count()).toBe(1);
    const focus = await focused.evaluate(e => ({ visible: e.matches(':focus-visible'), outline: getComputedStyle(e).outlineWidth }));
    expect(focus.visible).toBe(true); expect(parseFloat(focus.outline)).toBeGreaterThanOrEqual(2);
  };
  await page.keyboard.press('Tab'); await audit('menu-title');
  await keyboardActivate(page, 'title-credits'); await audit('menu-credits');
  await keyboardActivate(page, 'credits-back'); await keyboardActivate(page, 'title-settings'); await audit('menu-settings');
  await keyboardActivate(page, 'settings-back'); await keyboardActivate(page, 'start-game'); await audit('menu-character');
  await keyboardActivate(page, 'character-female'); await audit('menu-levels');
  await keyboardActivate(page, 'level-L1'); await expect(page.getByTestId('mission-button')).toBeVisible(); await audit('mission-panel');
  await keyboardActivate(page, 'mission-button'); await page.keyboard.press('Escape'); await audit('menu-pause');
  const def = missionSandbox(); def.id = 'L1'; def.steps[0].timer = 1 / 60;
  await page.evaluate(async def => { const api = window.__SS__!; await api.loadScenario('mission-sandbox'); api.pause(); api.missions.load(def); api.missions.begin(); await api.step(1); }, def);
  await audit('mission-panel'); await expect(page.getByTestId('mission-heading')).toHaveText('Mission failed');
  await keyboardActivate(page, 'mission-button');
  await page.evaluate(() => window.__SS__!.cheats.completeObjective());
  await audit('mission-panel'); await expect(page.getByTestId('mission-heading')).toHaveText('Level complete');
  await keyboardActivate(page, 'mission-button'); await expect(page.getByTestId('menu-upgrades')).toBeVisible(); await audit('menu-upgrades');
  await keyboardActivate(page, 'upgrade-health'); await audit('menu-rack');
});
