import { EventEmitter } from 'node:events';
import type { Page } from '@playwright/test';
import { describe, expect, test, vi } from 'vitest';
import { attachErrorGuard } from '../e2e/fixtures';

const request = (url = '/score.webm', type = 'media', error = 'net::ERR_ABORTED') => ({ url: () => url, resourceType: () => type, failure: () => ({ errorText: error }) });
describe('browser error guard', () => {
  test('a completed replacement range recovers a media loop cancellation', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const page = new EventEmitter(), guard = attachErrorGuard(page as unknown as Page);
    page.emit('requestfailed', request()); page.emit('requestfinished', request());
    vi.mocked(Date.now).mockReturnValue(12000); page.emit('requestfinished', request());
    guard.dispose(); expect(guard.errors).toEqual([]);
  });
  test('an unrecovered cancellation still fails, even with an earlier successful request', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const page = new EventEmitter(), guard = attachErrorGuard(page as unknown as Page);
    page.emit('requestfinished', request()); vi.mocked(Date.now).mockReturnValue(5000);
    page.emit('requestfailed', request()); guard.dispose(); expect(guard.errors).toHaveLength(1);
  });
  test('non-media cancellations and failed media connections remain failures', () => {
    const page = new EventEmitter(), guard = attachErrorGuard(page as unknown as Page);
    page.emit('requestfailed', request('/app.js', 'script')); page.emit('requestfinished', request('/app.js', 'script'));
    page.emit('requestfailed', request('/score.webm', 'media', 'net::ERR_CONNECTION_RESET')); page.emit('requestfinished', request());
    guard.dispose(); expect(guard.errors).toHaveLength(2);
  });
});
