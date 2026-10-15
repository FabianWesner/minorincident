import type { Game } from '../Game';
import { revealCards,pickUpgrades,finishRewards,rackSize,nextLevelAfter,lastLevel,powerScore,type CampaignSave,type Level } from '../sim/progression/Campaign';
import { SAVE_ERROR,type SaveResult } from '../sim/progression/Save';
import { upgrades } from '../data/upgrades';
import { madeBy } from '../data/madeBy';
import './campaign.css';
const label=(id:string)=>id.split('.').at(-1)!.replaceAll('-',' ');
/** Campaign-only screens. E12 retains briefing/results and E14 retains the gameplay HUD. */
export class CampaignUI {
  readonly root=document.createElement('section');
  private readonly heading=document.createElement('h1');
  private readonly content=document.createElement('div');
  private readonly message=document.createElement('p');
  private creditsTimer: ReturnType<typeof setTimeout> | undefined;
  private picks:string[]=[];
  private offeredMission:object|null=null;
  private endingPhase: string | null = null;
  constructor(private readonly game:Game){
    this.root.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const buttons=[...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
    this.root.className='campaign-ui';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.heading.id='campaign-title';this.root.setAttribute('aria-labelledby',this.heading.id);this.message.setAttribute('role','status');this.root.append(this.heading,this.content,this.message);document.querySelector('#game')!.append(this.root);
  }
  private screen(title:string):void {this.game.ui.show(null);this.game.clock.pause();this.game.input.clear();this.game.world.clearInput();this.root.hidden=false;document.body.dataset.campaign='open';this.heading.textContent=title;this.content.replaceChildren();this.message.textContent='';}
  private button(text:string,run:()=>void|Promise<void>,parent:HTMLElement=this.content):HTMLButtonElement {
    const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>{void Promise.resolve().then(run).catch(()=>{this.message.textContent='Could not start the level. Try again.';});});parent.append(b);return b;
  }
  private focus():void {this.content.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});}
  private save():void {if(!this.game.saveCampaign())this.message.textContent='Progress could not be saved. Browser storage is unavailable.';}
  hide():void {this.root.hidden=true;delete document.body.dataset.campaign;}
  showMenu(result:SaveResult):void {
    this.game.ui.init(true);
    if (result.status === 'ok') this.game.campaign = result.save;
    if (result.status !== 'error') { this.hide(); this.game.ui.show('title'); return; }
    this.screen(SAVE_ERROR);
    this.button('Start new', () => { this.hide(); this.game.ui.show('character'); });
    this.focus();
  }
  /** A paused result screen can still hand off to progression; no sim polling/allocation when idle. */
  update():void {
    const mission=this.game.world.missions,save=this.game.campaign;
    const ending = mission?.state.epilogue;
    if (save && ending && ending.phase !== 'playable') {
      // A phase autosave may precede the credits objective's completion in the same tick.
      if (ending.phase === 'done' && mission.state.phase === 'playing') return;
      if (ending.phase === 'credits') {
        const roll = this.content.querySelector<HTMLElement>('.credits-roll');
        if (roll) roll.style.animationDelay = `-${ending.phaseTicks / 60}s`;
      }
      if (this.endingPhase === ending.phase) return;
      this.endingPhase = ending.phase;
      if (ending.phase === 'done') { this.offeredMission = mission; this.showMenu({ status: 'ok', save }); return; }
      const paused = this.game.clock.paused;
      if (ending.phase === 'title') {
        this.screen('Minor Incident'); this.root.classList.add('epilogue-title');
        this.heading.dataset.testid = 'epilogue-title';
        const line = document.createElement('p'); line.textContent = 'The outbreak is over.'; this.content.append(line);
      } else { this.root.classList.remove('epilogue-title'); delete this.heading.dataset.testid; this.credits(save, true); }
      // Title/credits use the saved simulation phase clock; focus/menu still pause normally.
      if (!paused) this.game.clock.resume();
      return;
    }
    if(!save||!mission||mission.state.phase!=='progression'||this.offeredMission===mission)return;
    this.offeredMission=mission;
    const match=/^L([1-9]|10)$/.exec(mission.def.id);if(!match)return;
    const level=Number(match[1]) as Level;
    // Game persists completion and aftermath on level.completed, before this navigation can unload the world.
    if(level===lastLevel){this.credits(save);return;}
    // Finishing level N continues with N+1, not with the furthest unlocked level (replays and L2-completed saves).
    void this.game.continueCampaign(save,nextLevelAfter(level)??undefined);
  }
  /** The end of the campaign: shown after the last level (L10) and whenever the next level is not built yet. */
  credits(save:CampaignSave, ending = false):void {
    clearTimeout(this.creditsTimer);
    this.screen('Credits');const credits=document.createElement('div');credits.className='credits-roll';this.content.append(credits);
    for(const line of ['Minor Incident',madeBy.headline,`${madeBy.author.name}: ${madeBy.author.role.toLowerCase()}`,...madeBy.groups.map(g=>`${g.heading}: ${g.names.join(', ')}`),'Built with three.js and Rapier. Technology reference: Bruno Simon (MIT).',madeBy.thanks]){const p=document.createElement('p');p.textContent=line;credits.append(p);}
    if (ending) { credits.style.animationPlayState = 'paused'; credits.style.animationDelay = `-${(this.game.world.missions?.state.epilogue?.phaseTicks ?? 0) / 60}s`; }
    else this.creditsTimer=setTimeout(()=>{if(!this.root.hidden)this.showMenu({status:'ok',save});},12000);
    const back = this.button(ending ? 'Skip / Main menu' : 'Main menu',()=>{
      if (ending) { this.game.world.missions?.l10?.epilogue.skip(); this.game.clock.resume(); }
      else this.showMenu({status:'ok',save});
    }); back.dataset.testid = 'ending-credits-back'; this.focus();
  }
  showRewards():void {
    const save=this.game.campaign!,p=save.pending!;
    if(p.phase==='unlock'){
      this.screen('Unlock reveal');const text=document.createElement('p');text.textContent=`Level ${p.level} complete · Level ${save.unlockedLevel} unlocked · Racks ${rackSize(save.unlockedLevel)}/${rackSize(save.unlockedLevel)}`;this.content.append(text);
      {const unlocked=document.createElement('p');unlocked.textContent=save.ownedActions.map(label).join(' · ');this.content.append(unlocked);this.button('Choose upgrades',()=>{revealCards(save);this.save();this.picks=[];this.showRewards();});}
    }else if(p.phase==='cards'){
      this.screen('Pick 2 of 3 upgrades');const cards=document.createElement('div');cards.className='upgrade-cards';this.content.append(cards);
      const next=this.button('Set up racks',()=>{pickUpgrades(save,this.picks);this.save();this.game.applyCampaign();this.showRewards();});next.disabled=this.picks.length!==2;
      for(const id of p.cards){const d=upgrades[id],b=this.button(`${d.title} · Tier ${d.tier} · ${d.description}`,()=>{
        if(this.picks.includes(id))this.picks=this.picks.filter(p=>p!==id);else if(this.picks.length<2)this.picks.push(id);else this.message.textContent='Pick exactly two cards. Deselect one to change your choice.';
        b.setAttribute('aria-pressed',String(this.picks.includes(id)));next.disabled=this.picks.length!==2;
      },cards);b.dataset.upgrade=id;b.setAttribute('aria-pressed',String(this.picks.includes(id)));}
    }else{
      this.screen('Rack setup');const size=rackSize(save.unlockedLevel),racks=structuredClone(save.racks),summary=document.createElement('p');summary.textContent=`${size} actions per side · Power ${powerScore(save)}`;this.content.append(summary);
      for(const side of ['LEFT','RIGHT']as const){const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=side;group.append(legend);this.content.append(group);
        for(const id of save.ownedActions){const b=this.button(`${side}: ${label(id)}`,()=>{
          const index=racks[side].indexOf(id);
          if(index>=0){if(racks[side].length===1){this.message.textContent='Each rack needs at least one action.';return;}racks[side].splice(index,1);}
          else{if(racks[side].length>=size){this.message.textContent=`${side} rack is full (${size}/${size}). Remove an action first.`;return;}racks[side].push(id);}
          b.setAttribute('aria-pressed',String(racks[side].includes(id)));this.message.textContent=`${side}: ${racks[side].map(label).join(', ')} (${racks[side].length}/${size})`;
        },group);b.setAttribute('aria-pressed',String(racks[side].includes(id)));}
      }
      this.button('Mission briefing',async()=>{finishRewards(save,racks);this.save();await this.game.continueCampaign(save);});
    }this.focus();
  }
  reset():void {clearTimeout(this.creditsTimer);this.offeredMission=null;this.endingPhase=null;this.root.classList.remove('epilogue-title');delete this.heading.dataset.testid;this.picks=[];this.hide();}
  dispose():void {clearTimeout(this.creditsTimer);this.hide();this.root.remove();}
}
