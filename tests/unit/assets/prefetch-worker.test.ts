import { expect, test, vi } from 'vitest';

test('gameplay prefetch uses one worker per level/tier and releases it after completion or error', async () => {
  vi.resetModules();
  class WorkerMock {
    static instances: WorkerMock[] = [];
    onmessage?: (event: { data: { ok: boolean } }) => void;
    onerror?: (error: Error) => void;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor(readonly url: URL, readonly options: WorkerOptions) { WorkerMock.instances.push(this); }
  }
  vi.stubGlobal('document', {}); vi.stubGlobal('Worker', WorkerMock);
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  try {
    const { prefetchLevel } = await import('../../../src/assets/prefetch');
    const pending = prefetchLevel('L3', 4, 'low');
    await prefetchLevel('L3', 4, 'low');
    expect(WorkerMock.instances).toHaveLength(1);
    const worker = WorkerMock.instances[0];
    expect(worker.options).toEqual({ type: 'module' }); expect(worker.url.pathname).toContain('prefetch.worker.ts');
    expect(worker.postMessage).toHaveBeenCalledWith({ level: 'L3', concurrency: 4, quality: 'low' });
    expect(fetch).not.toHaveBeenCalled(); expect(worker.terminate).not.toHaveBeenCalled();
    worker.onmessage!({ data: { ok: true } }); await pending; expect(worker.terminate).toHaveBeenCalledOnce();
    const failed = prefetchLevel('L4', 4, 'low');
    WorkerMock.instances[1].onerror!(new Error('worker unavailable')); await failed;
    expect(WorkerMock.instances[1].terminate).toHaveBeenCalledOnce();
    const retried = prefetchLevel('L4', 4, 'low'); expect(WorkerMock.instances).toHaveLength(3);
    WorkerMock.instances[2].onmessage!({ data: { ok: true } }); await retried;
  } finally { vi.unstubAllGlobals(); }
});
