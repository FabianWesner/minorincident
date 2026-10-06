// Notification identity/text presentation adapted from Bruno Simon folio-2025
// Notifications.js (MIT, 41046b5); sim tick deadlines replace wall-clock timers.
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Mission } from '../sim/missions/Mission';
import type { MissionResult } from '../sim/missions/types';
import './mission.css';

/** Mission-only UI; progression choices and the full combat HUD remain E13/E14 consumers. */
export class MissionUI {
  readonly root = document.createElement('div');
  private readonly tracker = document.createElement('div');
  private readonly subtitle = document.createElement('div');
  private readonly toast = document.createElement('div');
  private readonly marker = document.createElement('div');
  private readonly map = document.createElement('div');
  private readonly panel = document.createElement('section');
  private readonly heading = document.createElement('h1');
  private readonly detail = document.createElement('p');
  private readonly button = document.createElement('button');
  private readonly result = document.createElement('dl');
  private readonly rows = new Map<keyof MissionResult, HTMLElement>();
  private readonly pins = new Map<string, HTMLSpanElement>();
  private readonly point = new Vector3();
  private displayedMission: Mission | null = null;
  private phase = '';
  private active = '';
  constructor(private readonly world: SimWorld, private readonly onChange: () => void) {
    this.root.className = 'mission-ui'; this.root.hidden = true;
    this.tracker.className = 'mission-tracker'; this.tracker.setAttribute('aria-live','polite');
    this.subtitle.className = 'mission-subtitle'; this.subtitle.setAttribute('role','status');
    this.toast.className = 'mission-toast'; this.toast.setAttribute('aria-live','polite');
    this.marker.className = 'mission-marker'; this.marker.setAttribute('aria-label','Objective direction');
    this.map.className = 'mission-minimap'; this.map.setAttribute('aria-label','Objective minimap');
    this.panel.className = 'mission-panel'; this.panel.setAttribute('aria-label','Mission');
    this.button.type = 'button'; this.button.addEventListener('click',this.accept);
    for (const [key,label] of [['time','Time (seconds)'],['kills','Kills'],['damage','Damage taken'],['deaths','Deaths'],['rescued','Rescued'],['optionalObjectives','Optional objectives']] as const) {
      const title=document.createElement('dt'), value=document.createElement('dd'); title.textContent=label; value.dataset.stat=key; this.result.append(title,value); this.rows.set(key,value);
    }
    this.panel.append(this.heading,this.detail,this.result,this.button);
    this.root.append(this.tracker,this.map,this.marker,this.subtitle,this.toast,this.panel); document.querySelector('#game')!.append(this.root);
  }
  private readonly accept = (): void => {
    const mission=this.world.missions;if(!mission)return;
    if(mission.state.phase==='briefing')mission.begin();else if(mission.state.phase==='retry')mission.restore();else if(mission.state.phase==='result')mission.continue();
    this.onChange();
  };
  private text(element: HTMLElement, value: string): void { if(element.textContent!==value)element.textContent=value; }
  update(camera: PerspectiveCamera, width: number, height: number): void {
    const mission=this.world.missions;if(this.displayedMission!==mission){this.reset();this.displayedMission=mission;}this.root.hidden=!mission;if(!mission)return;
    const state=mission.state,playing=state.phase==='playing';
    const cinematic=state.cinematic ? mission.def.cinematics[state.cinematic.id] : null;
    this.root.classList.toggle('is-cinematic',!!cinematic);
    this.subtitle.hidden=!cinematic&&(!state.subtitle||!playing);
    this.text(this.subtitle,cinematic?.caption??state.subtitle?.text??'');
    this.subtitle.dataset.lineId=state.subtitle?.id??'';
    this.panel.hidden=playing||!!cinematic;
    this.tracker.hidden=this.map.hidden=!playing;
    this.result.hidden=state.phase!=='result';
    if(this.phase!==state.phase){
      this.phase=state.phase;
      const labels={briefing:['Mission briefing',mission.def.briefing,'Begin mission'],retry:['Mission failed',`${state.failure}. Retry from ${state.checkpoint??'level start'}.`,'Retry'],result:['Level complete','Mission results','Continue'],progression:['Progression','Next: upgrades and loadout setup.',''],playing:['','',''],cinematic:['','','']};
      const [title,detail,button]=labels[state.phase];this.text(this.heading,title);this.text(this.detail,detail);this.text(this.button,button);this.button.hidden=!button;
      if(!this.panel.hidden&&!this.button.hidden)this.button.focus({preventScroll:true});
    }
    if(state.result)for(const [key,element]of this.rows){const value=state.result[key];this.text(element,Array.isArray(value)?value.join(', ')||'None':String(Math.round(value*100)/100));}
    const objective=mission.def.steps.find(s=>state.steps[s.id].status==='active');
    const anchor=state.marker?mission.def.anchors[state.marker]:undefined,player=this.world.entities.get(1);
    this.marker.hidden=!playing||!anchor||!player;
    if(anchor&&player&&objective&&playing){
      const distance=Math.hypot(anchor.x-player.transform.x,anchor.z-player.transform.z);
      this.text(this.tracker,`${objective.text} · ${Math.round(distance)} m`);this.tracker.dataset.objective=objective.id;this.tracker.dataset.distance=String(distance);
      if(this.active!==objective.id){this.active=objective.id;this.text(this.toast,`New objective: ${objective.text}`);}
      this.toast.hidden=this.world.tick-state.steps[objective.id].started>180;
      this.point.set(anchor.x,1.8,anchor.z).project(camera);
      const margin=42,cx=width/2,cy=height/2;
      let dx=this.point.x*cx,dy=-this.point.y*cy;
      if(this.point.z>1){dx=-dx;dy=-dy;}
      const offscreen=this.point.z>1||Math.abs(dx)>cx-margin||Math.abs(dy)>cy-margin;
      const scale=offscreen?Math.min((cx-margin)/Math.max(1,Math.abs(dx)),(cy-margin)/Math.max(1,Math.abs(dy))):1;
      this.marker.style.left=`${cx+dx*scale}px`;this.marker.style.top=`${cy+dy*scale}px`;
      this.marker.dataset.offscreen=String(offscreen);this.marker.dataset.anchor=state.marker!;
      this.marker.style.setProperty('--direction',`${Math.atan2(dy,dx)}rad`);this.text(this.marker,offscreen?'➜':'◆');
      this.marker.classList.toggle('offscreen',offscreen);
      const extent=100;
      for(const s of mission.def.steps){
        let pin=this.pins.get(s.id);if(!pin){pin=document.createElement('span');pin.className='mission-map-pin';pin.dataset.objective=s.id;this.map.append(pin);this.pins.set(s.id,pin);}
        pin.hidden=state.steps[s.id].status!=='active';if(pin.hidden)continue;const a=mission.def.anchors[s.anchor];
        const dx=(a.x-player.transform.x)/extent*40,dy=(a.z-player.transform.z)/extent*40,scale=Math.min(1,40/Math.max(1,Math.hypot(dx,dy)));
        pin.style.left=`${50+dx*scale}%`;pin.style.top=`${50+dy*scale}%`;
      }
    }else{this.toast.hidden=true;}
  }
  reset(): void {this.displayedMission=null;this.root.hidden=true;this.phase=this.active='';for(const pin of this.pins.values())pin.remove();this.pins.clear();}
  dispose(): void {this.button.removeEventListener('click',this.accept);this.root.remove();}
}
