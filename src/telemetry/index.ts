import type { Game } from '../Game';
import { Telemetry, type TelemetryMode } from './Telemetry';
import { browserTransport } from './transport';

/**
 * Anonymous play analytics + input-log replays (docs/tools/telemetry.md): always on for real players of the live site.
 * Off for automation (webdriver), local dev, test/debug/scene-lab URLs. `?telemetry=record` keeps the log in memory
 * without any network (used by the replay determinism test).
 */
export function telemetryMode(params: URLSearchParams, host: string, webdriver: boolean): TelemetryMode | null {
  if (params.get('telemetry') === 'record') return 'record';
  if (['test', 'testApi', 'scenelab', 'inspect', 'motionlab', 'perf', 'lookdev'].some(key => params.has(key)) || params.get('debug') === 'true') return null;
  if (webdriver) return null;
  if (host === 'localhost' || host === '[::1]' || host.startsWith('127.') || host === '0.0.0.0' || host.endsWith('.local')) return null;
  return 'live';
}

export function installTelemetry(game: Game, mode: TelemetryMode): Telemetry {
  const telemetry = new Telemetry(game, { mode, transport: browserTransport });
  game.telemetry = telemetry;
  return telemetry;
}
export { Telemetry };
