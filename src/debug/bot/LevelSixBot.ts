import { emptyInput, type InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';
export type L6Profile='complete'|'newbie'|'evade-only'|'idle';
/** Ordinary inputs only: defend the rear, collect injured people, close clear gates, walk to Northgate. */
export class LevelSixBot {
  finished=false;
  private readonly walker=new Walker();
  constructor(private readonly w:SimWorld,readonly profile:L6Profile='complete'){}
  sample():InputFrame {
    const w=this.w,m=w.missions!,s=m.state.l6,f=emptyInput(),p=w.entities.get(1)!.transform;
    this.finished=m.state.phase==='result'||m.state.phase==='progression';if(this.finished||!s)return f;
    if(m.state.phase==='briefing')m.begin();if(m.state.phase==='cinematic'){f.interact=true;return f;}
    if(this.profile==='idle'||w.entities.get(1)!.health.current<=0)return f;
    const go=(target:{x:number;z:number},stop:number,key:string)=>{const dir=this.walker.step(w,target,stop,key);if(dir)f.move=dir;return !dir;};
    const friends=s.survivors.filter(r=>r.status==='following');
    const fights=this.profile!=='evade-only';
    const enemies=w.infected!.active.filter(e=>e.health.current>0&&!e.infectionRise&&!e.hidden&&w.infected!.nav.visible(p,e.transform,0)&&Math.hypot(e.transform.x-p.x,e.transform.z-p.z)<(this.profile==='newbie'?16:22)).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z));
    // Close a cleared gate from the valid interaction spot before pursuing another distant target.
    const closeGate=fights&&s.gates.find(g=>!g.closedAt&&p.x>g.x+1&&Math.hypot(p.x-g.x-1.4,p.z-15)<1.7&&friends.every(r=>w.entities.get(r.id)!.transform.x>g.x+2));
    if(closeGate&&(!enemies[0]||Math.hypot(enemies[0].transform.x-p.x,enemies[0].transform.z-p.z)>2.2)){f.interact=true;return f;}
    if(fights&&enemies[0]&&(this.profile!=='newbie'||w.tick%60<45)){
      const e=enemies[0],d=Math.hypot(e.transform.x-p.x,e.transform.z-p.z),side=d<2.2?'LEFT':'RIGHT';f.attackTarget={id:e.id,side};if(side==='LEFT')f.left.held=true;else f.right.held=true;return f;
    }
    if(s.phase==='shelter'||s.phase==='first'||s.phase==='fails'){go({x:0,z:4},.6,'shelter');return f;}
    if(fights){
      const lag=friends.filter(r=>r.straggler&&!r.rejoined).sort((a,b)=>w.entities.get(a.id)!.transform.x-w.entities.get(b.id)!.transform.x)[0];
      if(lag){const at=w.entities.get(lag.id)!.transform;if(!lag.collected){go(at,2,`collect-${lag.id}`);return f;}if(p.x-at.x>5)return f;}
      const gate=s.gates.find(g=>!g.closedAt&&p.x<g.x+8&&friends.every(r=>w.entities.get(r.id)!.transform.x>g.x+2));
      if(gate){if(go({x:gate.x+1.4,z:15},.4,`gate-${gate.id}`))f.interact=true;return f;}
      const tail=friends.length?Math.min(...friends.map(r=>w.entities.get(r.id)!.transform.x)):s.leaderX;
      if(p.x>tail+6)return f;
    }
    const destination=s.leaderZ<14?{x:6,z:15}:p.x>=246&&p.x<249.1?{x:250,z:15}:s.leaderX<252?{x:Math.max(25,s.leaderX-3),z:15}:{x:273,z:15};
    f.walk=this.profile==='newbie';go(destination,.8,'retreat');return f;
  }
}
