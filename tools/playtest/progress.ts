interface Point { x: number; z: number }
export interface ProgressSample {
  context: string; text: string; distance: number | null; player: Point | null; marker: Point | null; tick: number; nowMs: number;
}
/** Progress comes only from the visible HUD, courier and marker. */
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
  private previousPlayer: Point | null = null;
  private previousTick = 0;
  update(s: ProgressSample): { seconds: number; reason: string | null } {
    const text=s.text.replace(/ · [\d.]+\s?m\b/g,'');
    let reason: string | null=null;
    // Ring reads are cached between frames. A respawn can leave the old gate's
    // ring paired with the new HUD distance; wait for a matching visible sample.
    const marker=s.marker&&s.player&&s.distance!==null&&Math.abs(Math.hypot(s.marker.x-s.player.x,s.marker.z-s.player.z)-s.distance)>5?null:s.marker;
    const shifted=!!(s.player&&this.previousPlayer&&Math.hypot(s.player.x-this.previousPlayer.x,s.player.z-this.previousPlayer.z)>Math.max(5,(s.tick-this.previousTick)/60*40));
    this.previousPlayer=s.player?{...s.player}:null;this.previousTick=s.tick;
    if(s.context!==this.context||text!==this.text||shifted) {
      this.context=s.context;this.text=text;this.best=s.distance??Infinity;reason=shifted?'view-change':'hud-change';
      this.playerOrigin=s.player?{...s.player}:null;this.markerOrigin=marker?{...marker}:null;
      this.playerFar=this.markerFar=0;
    } else if(s.distance!==null&&s.distance<this.best-2) {this.best=s.distance;reason='nearer';}
    this.playerOrigin??=s.player?{...s.player}:null;this.markerOrigin??=marker?{...marker}:null;
    if(!reason&&this.playerOrigin&&this.markerOrigin&&s.player&&marker) {
      const px=s.player.x-this.playerOrigin.x,pz=s.player.z-this.playerOrigin.z;
      const mx=marker.x-this.markerOrigin.x,mz=marker.z-this.markerOrigin.z;
      const playerTravel=Math.hypot(px,pz),markerTravel=Math.hypot(mx,mz);
      // Both must advance beyond their furthest observed positions in the same direction.
      // A moving ring alone, or repeated motion over the same ground, earns no progress.
      if(playerTravel>this.playerFar+2&&markerTravel>this.markerFar+2&&px*mx+pz*mz>0) {
        this.playerFar=playerTravel;this.markerFar=markerTravel;this.best=s.distance??this.best;reason='moving-marker';
      }
    }
    if(reason){this.tick=s.tick;this.wall=s.nowMs;}
    return {seconds:Math.max(0,Math.min((s.tick-this.tick)/60,(s.nowMs-this.wall)/1000)),reason};
  }
}
