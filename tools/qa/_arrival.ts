import { runFinaleCalibration } from '../sim-runner/l10-finale-calibration';
/** Temporary look-l10 probe: finale calibration summary (Mega arrival). */
const r = await runFinaleCalibration((process.argv[2] ?? 'high') as 'high' | 'low') as Record<string, unknown>;
const { timeline, activity, ...rest } = r;
console.log(JSON.stringify(rest).slice(0, 2500));
console.log(JSON.stringify(timeline).slice(0, 3000));
