import { parseArgs } from 'node:util';
import { api, defaultBase } from './api';

/** npm run telemetry:stats -- [--days 14] [--json] [--replays [--level L1] [--outcome quit|home|complete|restart|close] [--limit 30]] [--base URL]
 * Prints the play-analytics report (players/day, session length, level funnel, deaths and quits with positions, perf per device)
 * or lists recent replays. Needs TELEMETRY_READ_TOKEN (env or repo .env). */
const { values } = parseArgs({ options: { days: { type: 'string', default: '14' }, json: { type: 'boolean', default: false }, replays: { type: 'boolean', default: false }, level: { type: 'string' }, outcome: { type: 'string' }, limit: { type: 'string', default: '30' }, base: { type: 'string', default: defaultBase } } });

if (values.replays) {
  const query = new URLSearchParams({ limit: values.limit! }); if (values.level) query.set('level', values.level); if (values.outcome) query.set('outcome', values.outcome);
  const { replays } = await (await api(`replays?${query}`, values.base)).json() as { replays: Record<string, number | string>[] };
  if (values.json) console.log(JSON.stringify(replays, null, 2));
  else for (const r of replays) console.log(`${r.attempt_id}  ${String(r.level).padEnd(3)} ${String(r.outcome).padEnd(8)} ${String((Number(r.ticks) / 3600).toFixed(1)).padStart(5)} min  ${String(r.chunks).padStart(3)} chunks ${(Number(r.bytes) / 1024).toFixed(0).padStart(6)} KB  ${r.day}  build ${r.build}`);
  console.error(`${replays.length} replays. Replay one with: npm run replay -- <id> --shots 12 --video out.webm`);
} else {
  type Spot = { x: number; z: number; n: number; avg_tick: number };
  const stats = await (await api(`stats?days=${values.days}`, values.base)).json() as {
    days: number; since: string; totals: Record<string, number>; players_per_day: { day: string; players: number; sessions: number; avg_min: number }[];
    session_length: { median_s: number; p90_s: number; buckets: Record<string, number> };
    level_funnel: { level: string; starts: number; completes: number; completion_rate: number; restarts: number; quits: number; median_clear_s: number }[];
    deaths: { level: string; deaths: number; by_cause: Record<string, number>; hot_spots: Spot[] }[]; quits: { level: string; hot_spots: Spot[] }[];
    perf: { device: string; backend: string; quality: string; samples: number; frame_p50_ms: number; frame_p95_ms: number; sim_ms: number; draw_calls: number }[];
    devices: unknown; builds: unknown; replays: { count: number; bytes: number };
  };
  if (values.json) console.log(JSON.stringify(stats, null, 2));
  else {
    const t = stats.totals;
    console.log(`Minor Incident play stats, last ${stats.days} days (since ${stats.since})`);
    console.log(`players ${t.players}  sessions ${t.sessions}  returning players ${t.returning_players}  avg session ${t.avg_session_min} min (active ${t.avg_active_min} min)`);
    console.log('\nPlayers per day'); for (const d of stats.players_per_day) console.log(`  ${d.day}  players ${String(d.players).padStart(4)}  sessions ${String(d.sessions).padStart(4)}  avg ${d.avg_min} min`);
    const s = stats.session_length; console.log(`\nSession length: median ${Math.round(s.median_s / 60 * 10) / 10} min, p90 ${Math.round(s.p90_s / 60 * 10) / 10} min  ${JSON.stringify(s.buckets)}`);
    console.log('\nLevel funnel'); for (const f of stats.level_funnel) console.log(`  ${f.level}  starts ${f.starts}  completes ${f.completes} (${Math.round(f.completion_rate * 100)}%)  restarts ${f.restarts}  quits ${f.quits}  median clear ${f.median_clear_s}s`);
    console.log('\nDeaths (10 m grid, top spots: x z count avg-tick)'); for (const d of stats.deaths) console.log(`  ${d.level}  ${d.deaths} deaths  ${JSON.stringify(d.by_cause)}\n      ${d.hot_spots.slice(0, 6).map((h: Spot) => `(${h.x},${h.z}) n=${h.n} t=${h.avg_tick}`).join('  ')}`);
    console.log('\nQuits'); for (const q of stats.quits) console.log(`  ${q.level}  ${q.hot_spots.slice(0, 6).map((h: Spot) => `(${h.x},${h.z}) n=${h.n} t=${h.avg_tick}`).join('  ')}`);
    console.log('\nPerf per device'); for (const p of stats.perf) console.log(`  ${p.device}/${p.backend}/${p.quality}  samples ${p.samples}  frame p50 ${p.frame_p50_ms} ms p95 ${p.frame_p95_ms} ms  sim ${p.sim_ms} ms  draw calls ${p.draw_calls}`);
    console.log(`\nDevices ${JSON.stringify(stats.devices)}  builds ${JSON.stringify(stats.builds)}  replays ${stats.replays.count} (${(stats.replays.bytes / 1048576).toFixed(1)} MB)`);
  }
}
