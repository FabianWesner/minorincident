import { execFileSync } from 'node:child_process';
import { loadavg } from 'node:os';

/** One-second capacity telemetry. RSS is a conservative sum, not physical footprint; GPU counters are system-wide. */
export type Sample = { at: number; rssMiB: number; cpuPercent: number; load: number[]; gpuPercent: number | null; gpuAllocatedMiB: number | null; otherCpuPercent: number; swapMiB: number | null };
export function sample(): Sample {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,%cpu='], { encoding: 'utf8' }).trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
  const owned = new Set([process.pid]);
  for (let count = 0; count < rows.length; count++) { const before = owned.size; for (const [pid, ppid] of rows) if (owned.has(ppid)) owned.add(pid); if (before === owned.size) break; }
  const mine = rows.filter(([pid]) => owned.has(pid)), other = rows.filter(([pid]) => !owned.has(pid));
  let gpuPercent: number | null = null, gpuAllocatedMiB: number | null = null, swapMiB: number | null = null;
  if (process.platform === 'darwin') {
    const gpu = execFileSync('/usr/sbin/ioreg', ['-r', '-c', 'AGXAccelerator', '-d', '1'], { encoding: 'utf8' });
    const utilization = gpu.match(/"Device Utilization %"=(\d+)/), memory = gpu.match(/"Alloc system memory"=(\d+)/);
    if (utilization) gpuPercent = Number(utilization[1]);
    if (memory) gpuAllocatedMiB = Number(memory[1]) / 1048576;
    const swap = execFileSync('sysctl', ['-n', 'vm.swapusage'], { encoding: 'utf8' }).match(/used = ([\d.]+)M/);
    if (swap) swapMiB = Number(swap[1]);
  }
  return { at: Date.now(), rssMiB: mine.reduce((n, r) => n + r[2], 0) / 1024, cpuPercent: mine.reduce((n, r) => n + r[3], 0), load: loadavg(), gpuPercent, gpuAllocatedMiB, otherCpuPercent: other.reduce((n, r) => n + r[3], 0), swapMiB };
}
