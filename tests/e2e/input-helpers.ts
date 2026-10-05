import type { Page } from '@playwright/test';

export async function tick(page: Page, ticks = 1) {
  return page.evaluate(async (n) => { await window.__SS__!.step(n); return window.__SS__!.getState().input.frame; }, ticks);
}
