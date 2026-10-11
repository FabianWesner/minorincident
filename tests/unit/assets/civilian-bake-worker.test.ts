import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const slots: FakeWorker[] = [];
class FakeWorker {
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: ErrorEvent) => void;
  messages: unknown[] = [];
  terminate = vi.fn();
  constructor() { slots.push(this); }
  postMessage(value: unknown): void { this.messages.push(value); }
}
vi.mock('../../../src/assets/civilianBakeData', () => ({ decodeCivilianBake: (bytes: ArrayBuffer) => { if (!bytes.byteLength) throw Error('Invalid data'); return { geometry: 'prepared' }; } }));
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); slots.length = 0;
  vi.stubGlobal('Worker', FakeWorker); vi.stubGlobal('navigator', { hardwareConcurrency: 5 }); vi.stubGlobal('location', { search: '' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
test('reserves a core for the UI and transfers preparation and transfers queued jobs to the next free slot', async () => {
  const pool = await import('../../../src/assets/civilianBake');
  const jobs = Array.from({ length: 6 }, (_, i) => pool.loadCivilianBake(`model${i}`, 'lod1'));
  expect(slots).toHaveLength(4); expect(slots.every(slot => slot.messages.length === 1)).toBe(true);
  for (let i = 0; i < 6; i++) slots[i % 4].onmessage!({ data: { bytes: new ArrayBuffer(1) } } as MessageEvent);
  expect(await Promise.all(jobs)).toEqual(Array(6).fill({ geometry: 'prepared' }));
  expect(pool.civilianBakeStats).toMatchObject({ submitted: 6, completed: 6, failed: 0 });
  vi.advanceTimersByTime(249); expect(slots.every(slot => slot.terminate.mock.calls.length === 0)).toBe(true);
  vi.advanceTimersByTime(1); expect(slots.every(slot => slot.terminate.mock.calls.length === 1)).toBe(true);
});
test('invalid data falls back without disabling later preparation', async () => {
  const pool = await import('../../../src/assets/civilianBake');
  const job = pool.loadCivilianBake('model', 'lod2'); slots[0].onmessage!({ data: {} } as MessageEvent);
  expect(await job).toBeUndefined(); expect(pool.civilianBakeStats.failed).toBe(1);
  const next = pool.loadCivilianBake('next', 'lod1'); slots[0].onmessage!({ data: { bytes: new ArrayBuffer(1) } } as MessageEvent);
  expect(await next).toEqual({ geometry: 'prepared' });
});
test('counts generated assets only after their transferred payload decodes successfully', async () => {
  const pool = await import('../../../src/assets/civilianBake');
  const job = pool.loadCivilianBake('model', 'lod1');
  slots[0].onmessage!({ data: { bytes: new ArrayBuffer(1), prebuilt: true } } as MessageEvent);
  expect(await job).toEqual({ geometry: 'prepared' });
  expect(pool.civilianBakeStats.prebuilt).toBe(1);
});
test('worker failure releases active and queued jobs and disables the failed pool', async () => {
  const pool = await import('../../../src/assets/civilianBake');
  const jobs = Array.from({ length: 6 }, () => pool.loadCivilianBake('model', 'lod1'));
  const preventDefault = vi.fn(); slots[0].onerror!({ preventDefault } as unknown as ErrorEvent);
  expect(await Promise.all(jobs)).toEqual(Array(6).fill(undefined)); expect(preventDefault).toHaveBeenCalled();
  expect(slots.every(slot => slot.terminate.mock.calls.length === 1)).toBe(true);
  expect(await pool.loadCivilianBake('next', 'lod0')).toBeUndefined(); expect(slots).toHaveLength(4);
});
test('passes the diagnostic worker throttle and handles unavailable workers', async () => {
  vi.stubGlobal('location', { search: '?workerCpu=4' });
  const pool = await import('../../../src/assets/civilianBake'); const job = pool.loadCivilianBake('model', 'lod0');
  expect(slots[0].messages[0]).toMatchObject({ model: 'model', lod: 'lod0', cpuRate: 4 });
  slots[0].onmessage!({ data: {} } as MessageEvent); await job;
  vi.stubGlobal('Worker', undefined); expect(await pool.loadCivilianBake('next', 'lod1')).toBeUndefined();
});
test('worker constructor failure falls back for every pending job', async () => {
  vi.stubGlobal('Worker', class { constructor() { throw Error('Unavailable'); } });
  const pool = await import('../../../src/assets/civilianBake');
  expect(await pool.loadCivilianBake('model', 'lod1')).toBeUndefined(); expect(await pool.loadCivilianBake('next', 'lod2')).toBeUndefined();
});
