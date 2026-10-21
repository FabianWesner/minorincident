interface Point { x: number; z: number }
export interface ProgressSample {
  context: string; text: string; distance: number | null; player: Point | null; marker: Point | null; tick: number; nowMs: number;
}
/** Observational only: the playtest's input decisions do not consume this measurement. */
export class PlaytestProgress {
  private context = '';
  private text = '';
  private best = Infinity;
  private tick = 0;
  private wall = 0;
  update(s: ProgressSample): { seconds: number; reason: string | null } {
    const text=s.text.replace(/ · [\d.]+\s?m\b/g,'');
    let reason: string | null=null;
    if(s.context!==this.context||text!==this.text) {
      this.context=s.context;this.text=text;this.best=s.distance??Infinity;reason='hud-change';
    } else if(s.distance!==null&&s.distance<this.best-2) {this.best=s.distance;reason='nearer';}
    if(reason){this.tick=s.tick;this.wall=s.nowMs;}
    return {seconds:Math.max(0,Math.min((s.tick-this.tick)/60,(s.nowMs-this.wall)/1000)),reason};
  }
}
