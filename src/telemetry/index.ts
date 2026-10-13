import type { Game } from '../Game';
import { Telemetry, type TelemetryMode } from './Telemetry';
import { browserTransport } from './transport';

/**
 * Anonymous play analytics + input-log replays (docs/tools/telemetry.md): always on for real players of the live site.
 * Off for automation (webdriver), local dev, test/scene-lab URLs (not ?debug=true: the PO plays PROD with it). `?telemetry=record` keeps the log in memory
 * without any network (used by the replay determinism test); `?telemetry=live` forces sending (local wrangler checks).
 */
export function telemetryMode(params: URLSearchParams, host: string, webdriver: boolean): TelemetryMode | null {
  // Explicit overrides for verification: `record` keeps the log in memory only, `live` sends even from localhost/automation.
  const forced = params.get('telemetry');
  if (forced === 'record' || forced === 'live') return forced;
  if (['test', 'testApi', 'scenelab', 'inspect', 'motionlab', 'perf', 'lookdev'].some(key => params.has(key))) return null;
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
