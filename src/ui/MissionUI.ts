import { devicePrompt } from './devicePrompt';
import { l3EvacuationText } from '../sim/missions/LevelThreeCollapse';
import { cureFinaleText } from '../sim/missions/LevelTenFinale';
import { l4CellarDistance } from '../data/l4';
// Notification identity/text presentation adapted from Bruno Simon folio-2025
// Notifications.js (MIT, 41046b5); sim tick deadlines replace wall-clock timers.
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Mission } from '../sim/missions/Mission';
import type { MissionResult } from '../sim/missions/types';
import './mission.css';
import { attribute, setHidden, style } from './dom';
import { nextLevelAfter } from '../sim/progression/Campaign';
import { checkpointName } from '../data/checkpointNames';

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
  private readonly rows = new Map<Exclude<keyof MissionResult, 'companion'>, HTMLElement>();
  private readonly pins = new Map<string, HTMLSpanElement>();
  private readonly routePin = document.createElement('span');
  private readonly cellarTurn = { x: 0, z: 0 };
  private readonly point = new Vector3();
  private displayedMission: Mission | null = null;
  private phase = '';
  private active = '';
  constructor(private readonly world: SimWorld, private readonly onChange: () => void) {
    for (const [name, element] of Object.entries({ root: this.root, tracker: this.tracker, subtitle: this.subtitle, toast: this.toast, marker: this.marker, map: this.map, panel: this.panel, heading: this.heading, detail: this.detail, button: this.button, result: this.result })) element.dataset.testid = `mission-${name}`;
    this.root.className = 'mission-ui'; this.root.hidden = true;
    this.tracker.className = 'mission-tracker'; this.tracker.setAttribute('aria-live','polite');
    this.subtitle.className = 'mission-subtitle'; this.subtitle.setAttribute('role','status');
    this.toast.className = 'mission-toast'; this.toast.setAttribute('aria-live','polite');
    this.marker.className = 'mission-marker'; this.marker.setAttribute('aria-label','Objective direction');
    this.map.className = 'mission-minimap'; this.map.setAttribute('aria-label','Objective minimap');
    this.routePin.className = 'mission-map-pin'; this.routePin.dataset.testid = 'mission-route-pin'; this.routePin.setAttribute('aria-label', 'Next turn on the cellar route'); this.routePin.style.background = '#64d9ee'; this.routePin.hidden = true; this.map.append(this.routePin);
    this.panel.className = 'mission-panel'; this.panel.setAttribute('aria-label','Mission');
    this.button.type = 'button'; this.button.addEventListener('click',this.accept);
    for (const [key,label] of [['time','Time (seconds)'],['knockdowns','Knockdowns'],['kills','Kills'],['damage','Damage taken'],['deaths','Deaths'],['rescued','Survivors out'],['survivorsIn','Survivors in'],['optionalObjectives','Optional objectives'],['delivered','Delivery'],['infected','Infected now'],['turned','Pedestrians turned'],['escaped','Pedestrians escaped']] as const) {
      const title=document.createElement('dt'), value=document.createElement('dd'); title.textContent=label; title.dataset.testid=`result-label-${key}`; value.dataset.testid=`result-${key}`; value.dataset.stat=key; this.result.append(title,value); this.rows.set(key,value);
    }
    this.panel.append(this.heading,this.detail,this.result,this.button);
    this.root.append(this.tracker,this.map,this.marker,this.subtitle,this.toast,this.panel); document.querySelector('#game')!.append(this.root);
  }
  private readonly accept = (): void => {
    const mission=this.world.missions;if(!mission)return;
    if(mission.state.phase==='briefing')mission.begin();else if(mission.state.phase==='retry')mission.restore();else if(mission.state.phase==='result') { mission.continue(); }
    this.onChange();
  };
  private text(element: HTMLElement, value: string): void { value=devicePrompt(value,document.body.classList.contains('touch-ui')); if(element.textContent!==value)element.textContent=value; }
  /** Native font fallback for the objective arrow must finish before Begin. */
  prepare(): void {
    const rootHidden = this.root.hidden, markerHidden = this.marker.hidden, value = this.marker.textContent;
    const visibility = this.root.style.visibility;
    this.root.style.visibility = 'hidden'; this.root.hidden = this.marker.hidden = false;
    for (const glyph of ['➜', '◆']) { this.text(this.marker, glyph); this.marker.getBoundingClientRect(); }
    this.marker.textContent = value; this.marker.hidden = markerHidden;
    this.root.hidden = rootHidden; this.root.style.visibility = visibility;
  }
  update(camera: PerspectiveCamera, width: number, height: number): void {
    const mission=this.world.missions;if(this.displayedMission!==mission){this.reset();this.displayedMission=mission;}setHidden(this.root,!mission);if(!mission)return;
    const state=mission.state,playing=state.phase==='playing';
    const cinematic=state.cinematic ? mission.def.cinematics[state.cinematic.id] : null;
    this.root.classList.toggle('is-cinematic',!!cinematic);
    setHidden(this.subtitle,!cinematic&&(!state.subtitle||!playing));
    this.text(this.subtitle,cinematic?.caption??state.subtitle?.text??'');
    attribute(this.subtitle,'data-line-id',state.subtitle?.id??'');
    setHidden(this.panel,playing||!!cinematic||!!mission.def.l9&&state.phase==='progression');
    if (this.panel.hidden && this.panel.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur();
    setHidden(this.tracker,!playing);setHidden(this.map,!playing);
    setHidden(this.result,state.phase!=='result');
    if(this.phase!==state.phase){
      this.phase=state.phase;
      const labels={briefing:['Mission briefing',mission.def.briefing,'Begin mission'],retry:['Mission failed',`${state.failure}. Retry from ${checkpointName(mission.def.id,state.checkpoint)}.`,'Retry'],result:mission.def.l6?['Night. Still alive.',this.campaignSummary(),nextLevelAfter(6)?'Continue':'Credits']:mission.def.l1?['Delivery complete. Outbreak: not contained.','The fire station shutter holds, for now.','Continue']:['Level complete','Mission results','Continue'],progression:['Progression','Next: upgrades and loadout setup.',''],playing:['','',''],cinematic:['','','']};
      const [title,detail,button]=labels[state.phase];this.text(this.heading,title);this.text(this.detail,detail);this.text(this.button,button);this.button.hidden=!button;
      if(!this.panel.hidden&&!this.button.hidden)this.button.focus({preventScroll:true});
    }
    if(state.result)for(const [key,element]of this.rows){
      const value=state.result[key],row=element.previousElementSibling as HTMLElement;
      row.hidden=element.hidden=value===undefined;
      this.text(element,value===undefined?'':Array.isArray(value)?value.join(', ')||'None':typeof value==='boolean'?value?'✓':'✗':String(Math.round(value*100)/100));
    }
    const objective=mission.def.steps.find(s=>state.steps[s.id].status==='active');
    if (mission.def.l8 && playing && !objective) this.tracker.hidden = this.map.hidden = true;
    const anchor=state.marker?mission.def.anchors[state.marker]:undefined,player=this.world.entities.get(1);
    const cellarDistance = playing && player && mission.def.l4 && state.l4?.phase === 'collapse' ? l4CellarDistance(player.transform, this.cellarTurn) : null;
    setHidden(this.routePin, cellarDistance === null || !!anchor && Math.hypot(this.cellarTurn.x - anchor.x, this.cellarTurn.z - anchor.z) < 2);
    setHidden(this.marker,!playing||!anchor||!player);
    if(player&&objective&&playing){
      const distance=cellarDistance ?? (anchor?Math.hypot(anchor.x-player.transform.x,anchor.z-player.transform.z):null);
      const seconds = state.deadlineTicks === null ? null : Math.ceil(state.deadlineTicks / 60);
      const timer = seconds === null ? '' : ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      this.text(this.tracker,`${l3EvacuationText(mission) ?? cureFinaleText(mission) ?? objective.text}${distance===null?'':` · ${Math.round(distance)}\u00a0m`}${timer}`);attribute(this.tracker,'data-objective',objective.id);attribute(this.tracker,'data-distance',distance===null?'':String(distance));
      if(this.active!==objective.id){this.active=objective.id;this.text(this.toast,`New objective: ${l3EvacuationText(mission) ?? cureFinaleText(mission) ?? objective.text}`);}
      const boundary = this.world.controls.blockedMove && this.world.controls.blockedMove.until > this.world.tick;
      if (boundary) this.text(this.toast, 'MILITARY ZONE · Stay inside the perimeter');
      setHidden(this.toast,!boundary && this.world.tick-state.steps[objective.id].started>=180);
      if(anchor){
        const direction = this.routePin.hidden ? anchor : this.cellarTurn;
        this.point.set(direction.x,1.8,direction.z).project(camera);
        attribute(this.marker,'data-guidance',this.routePin.hidden?'destination':'street-route');
        const margin=42,cx=width/2,cy=height/2;
        let dx=this.point.x*cx,dy=-this.point.y*cy;
        if(this.point.z>1){dx=-dx;dy=-dy;}
        const offscreen=this.point.z>1||Math.abs(dx)>cx-margin||Math.abs(dy)>cy-margin;
        const scale=offscreen?Math.min((cx-margin)/Math.max(1,Math.abs(dx)),(cy-margin)/Math.max(1,Math.abs(dy))):1;
        style(this.marker,'left',`${cx+dx*scale}px`);style(this.marker,'top',`${cy+dy*scale}px`);
        attribute(this.marker,'data-offscreen',String(offscreen));attribute(this.marker,'data-anchor',state.marker!);
        style(this.marker,'--direction',`${Math.atan2(dy,dx)}rad`);this.text(this.marker,offscreen?'➜':'◆');
        this.marker.classList.toggle('offscreen',offscreen);
      }
      const extent=100;
      if (!this.routePin.hidden) {
        const dx=(this.cellarTurn.x-player.transform.x)/extent*40,dy=(this.cellarTurn.z-player.transform.z)/extent*40,scale=Math.min(1,40/Math.max(1,Math.hypot(dx,dy)));
        style(this.routePin,'left',`${50+dx*scale}%`);style(this.routePin,'top',`${50+dy*scale}%`);
      }
      for(const s of mission.def.steps){
        let pin=this.pins.get(s.id);if(!pin){pin=document.createElement('span');pin.className='mission-map-pin';pin.dataset.testid=`mission-pin-${s.id}`;pin.dataset.objective=s.id;this.map.append(pin);this.pins.set(s.id,pin);}
        setHidden(pin,state.steps[s.id].status!=='active'||s.waypoint===false||!anchor);if(pin.hidden)continue;const a=mission.def.anchors[mission.def.l3 && s.id === 'checkpoint' ? state.marker ?? s.anchor : s.anchor];
        const dx=(a.x-player.transform.x)/extent*40,dy=(a.z-player.transform.z)/extent*40,scale=Math.min(1,40/Math.max(1,Math.hypot(dx,dy)));
        style(pin,'left',`${50+dx*scale}%`);style(pin,'top',`${50+dy*scale}%`);
      }
    }else{
      setHidden(this.toast,true);
      const done=!objective&&playing&&mission.def.l1?[...mission.def.steps].reverse().find(s=>state.steps[s.id].status==='completed'):undefined;
      if(done)this.text(this.tracker,`✓ ${done.text}`);
    }
  }
  reset(): void {this.displayedMission=null;this.root.hidden=true;this.routePin.hidden=true;this.phase=this.active='';for(const pin of this.pins.values())pin.remove();this.pins.clear();}
  private campaignSummary():string {
    const result=this.world.missions?.state.result,previous=this.world.progression?.campaign?.results??{};
    const results={...previous,...(result?{L6:result}:{})},all=Object.values(results);
    return `Campaign summary · ${all.length} levels · Time ${all.reduce((n,r)=>n+r.time,0).toFixed(1)} s · Deaths ${all.reduce((n,r)=>n+r.deaths,0)} · Rescued ${all.reduce((n,r)=>n+r.rescued,0)}`;
  }
  dispose(): void {this.button.removeEventListener('click',this.accept);this.root.remove();}
}
