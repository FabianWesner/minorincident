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
  private playerOrigin: Point | null = null;
  private markerOrigin: Point | null = null;
  private playerFar = 0;
  private markerFar = 0;
  update(s: ProgressSample): { seconds: number; reason: string | null } {
    const text=s.text.replace(/ · [\d.]+\s?m\b/g,'');
    let reason: string | null=null;
    if(s.context!==this.context||text!==this.text) {
      this.context=s.context;this.text=text;this.best=s.distance??Infinity;reason='hud-change';
      this.playerOrigin=s.player?{...s.player}:null;this.markerOrigin=s.marker?{...s.marker}:null;
      this.playerFar=this.markerFar=0;
    } else if(s.distance!==null&&s.distance<this.best-2) {this.best=s.distance;reason='nearer';}
    this.playerOrigin??=s.player?{...s.player}:null;this.markerOrigin??=s.marker?{...s.marker}:null;
    if(!reason&&this.playerOrigin&&this.markerOrigin&&s.player&&s.marker) {
      const px=s.player.x-this.playerOrigin.x,pz=s.player.z-this.playerOrigin.z;
      const mx=s.marker.x-this.markerOrigin.x,mz=s.marker.z-this.markerOrigin.z;
      const playerTravel=Math.hypot(px,pz),markerTravel=Math.hypot(mx,mz);
      // Both must advance beyond their furthest observed positions in the same direction.
      // A moving ring alone, or repeated motion over the same ground, earns no progress.
      if(playerTravel>this.playerFar+2&&markerTravel>this.markerFar+2&&px*mx+pz*mz>0) {
        this.playerFar=playerTravel;this.markerFar=markerTravel;reason='moving-marker';
      }
    }
    if(reason){this.tick=s.tick;this.wall=s.nowMs;}
    return {seconds:Math.max(0,Math.min((s.tick-this.tick)/60,(s.nowMs-this.wall)/1000)),reason};
  }
}
