/** Evidence from public/perf-device.html. Browser emulation is never accepted as physical-device evidence. */
export interface DeviceEvidence {
  version: number; physicalDevice: boolean; deviceClass: string; platform: string; model: string;
  recordedAt: string; userAgent: string; scenario: string; quality: string; backend: string;
  durationMs: number; frameMs: number[]; fpsP50: number; infected: number;
}
export function validateDeviceEvidence(value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['Not a device recording'];
  const d = value as DeviceEvidence, errors: string[] = [];
  if (d.version !== 1 || d.physicalDevice !== true || d.deviceClass !== 'mid-range') errors.push('Requires declared physical mid-range hardware');
  if (!['ios', 'android'].includes(d.platform) || !(d.platform === 'ios' ? /iPhone|iPad|iPod/i : /Android/i).test(d.userAgent ?? '')) errors.push('OS and device user-agent mismatch');
  if (typeof d.model !== 'string' || d.model.trim().length < 3 || !Number.isFinite(Date.parse(d.recordedAt))) errors.push('Missing model or recording date');
  if (d.scenario !== 'perf-l6-mainstreet' || d.quality !== 'low' || !['webgl', 'webgpu'].includes(d.backend) || d.infected !== 100) errors.push('Requires low-tier L6 scene with 100 living infected');
  if (!Array.isArray(d.frameMs) || d.frameMs.length < 600 || d.frameMs.some(ms => !Number.isFinite(ms) || ms <= 0)) return [...errors, 'Requires at least 600 valid rendered-frame intervals'];
  const sorted = [...d.frameMs].sort((a, b) => a - b), fps = 1000 / sorted[Math.ceil(sorted.length * .5) - 1];
  if (!Number.isFinite(d.durationMs) || d.durationMs < sorted.reduce((a, b) => a + b, 0) * .9) errors.push('Recording duration does not cover its frames');
  if (!Number.isFinite(d.fpsP50) || Math.abs(d.fpsP50 - fps) > .01 || fps < 30) errors.push('Measured p50 must be >=30fps and match raw frames');
  return errors;
}
