import type { CampaignSave } from '../sim/progression/Campaign';
import type { Tier } from '../levels/districts/types';

/** What Game and the UI call; the implementation (Telemetry) is loaded lazily and may be absent. */
export interface LevelStartInfo { id: string; seed?: number; tier?: Tier; campaign: CampaignSave | null }
export interface TelemetrySink {
  /** A mission level finished loading and is about to be played (also after a restart). `null` = not a recordable run. */
  levelLoaded(start: LevelStartInfo | null): void;
  /** The player confirmed a restart; the running attempt ends now. */
  restarting(): void;
  /** Back to the title screen from a level (pause menu). */
  home(): void;
  /** The scenario was unloaded (title backdrop). */
  scenarioUnloaded(): void;
  /** Wheel/pinch zoom changed the follow camera (a sim input through the spawn frustum). */
  zoom(delta: number): void;
}
