import type { PreparedCivilian } from '../render/npc/prepareCivilianGeometry';
import { decodeCivilianBake } from './civilianBakeData';
export const civilianBakeStats = { workers: 0, submitted: 0, completed: 0, prebuilt: 0, failed: 0 };
type Job = { id: number; model: string; lod: string; resolve: (value: PreparedCivilian | undefined) => void };
const queue: Job[] = [], workers: { worker: Worker; job?: Job }[] = [];
let sequence = 0, unavailable = false, idle: ReturnType<typeof setTimeout> | undefined;
function drain(): void {
  if (idle) { clearTimeout(idle); idle = undefined; }
  if (unavailable) { for (const job of queue.splice(0)) job.resolve(undefined); return; }
  const limit = Math.min(8, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
  while (queue.length && workers.length < limit) {
    let worker: Worker;
    try { worker = new Worker(new URL('../render/npc/civilianBake.worker.ts', import.meta.url), { type: 'module' }); }
    catch { unavailable = true; for (const slot of workers.splice(0)) { slot.job?.resolve(undefined); slot.worker.terminate(); } drain(); return; }
    const slot: typeof workers[number] = { worker }; workers.push(slot); civilianBakeStats.workers++;
    worker.onmessage = (event: MessageEvent<{ bytes?: ArrayBuffer; prebuilt?: boolean }>) => {
      const job = slot.job; slot.job = undefined;
      if (job) {
        try {
          if (!event.data.bytes) throw new Error('Worker preparation failed');
          const baked = decodeCivilianBake(event.data.bytes); civilianBakeStats.completed++;
          if (event.data.prebuilt) civilianBakeStats.prebuilt++;
          job.resolve(baked);
        } catch { civilianBakeStats.failed++; job.resolve(undefined); }
      }
      drain();
    };
    worker.onerror = event => {
      event.preventDefault(); unavailable = true;
      for (const slot of workers.splice(0)) { if (slot.job) { civilianBakeStats.failed++; slot.job.resolve(undefined); } slot.worker.terminate(); }
      drain();
    };
  }
  for (const slot of workers) if (!slot.job && queue.length) {
    slot.job = queue.shift()!;
    // CDP's page CPU throttle does not cover worker threads. The diagnostic
    // phone run scales preparation time; the worker excludes HTTP wait time.
    const cpuRate = Number(new URLSearchParams(location.search).get('workerCpu') ?? 1);
    slot.worker.postMessage({ id: slot.job.id, model: slot.job.model, lod: slot.job.lod, cpuRate: Number.isFinite(cpuRate) ? Math.max(1, cpuRate) : 1 });
  }
  if (!queue.length && workers.every(slot => !slot.job)) idle = setTimeout(() => { for (const slot of workers.splice(0)) slot.worker.terminate(); }, 250);
}
/** Worker failure keeps the same loading-phase preparation as the fallback. */
export function loadCivilianBake(model: string, lod: string): Promise<PreparedCivilian | undefined> {
  if (typeof Worker === 'undefined' || unavailable) return Promise.resolve(undefined);
  civilianBakeStats.submitted++;
  return new Promise(resolve => { queue.push({ id: ++sequence, model, lod, resolve }); drain(); });
}
