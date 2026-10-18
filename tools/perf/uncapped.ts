/** Timing probes must own quiet-run's exclusive reservation before removing vsync. */
export function uncappedArgs(): string[] {
  if (process.env.MI_PERF_LOCK_HELD !== '1') throw new Error('Uncapped rendering requires tools/perf/quiet-run.sh');
  return ['--disable-frame-rate-limit', '--disable-gpu-vsync'];
}
