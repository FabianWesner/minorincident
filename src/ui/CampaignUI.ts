import type { Game } from '../Game';
import { beginRewards,chooseWeapon,revealCards,pickUpgrades,finishRewards,weaponChoices,rackSize,powerScore,type CampaignSave,type Level } from '../sim/progression/Campaign';
import { SAVE_ERROR,type SaveResult } from '../sim/progression/Save';
import { upgrades } from '../data/upgrades';
import './campaign.css';
const label=(id:string)=>id.split('.').at(-1)!.replaceAll('-',' ');
/** Campaign-only screens. E12 retains briefing/results and E14 retains the gameplay HUD. */
export class CampaignUI {
  readonly root=document.createElement('section');
  private readonly heading=document.createElement('h1');
  private readonly content=document.createElement('div');
  private readonly message=document.createElement('p');
  private picks:string[]=[];
  private offeredMission:object|null=null;
  private menuSave:CampaignSave|null=null;
  constructor(private readonly game:Game){
    this.root.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const buttons=[...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
    this.root.className='campaign-ui';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.heading.id='campaign-title';this.root.setAttribute('aria-labelledby',this.heading.id);this.message.setAttribute('role','status');this.root.append(this.heading,this.content,this.message);document.querySelector('#game')!.append(this.root);
  }
  private screen(title:string):void {this.game.clock.pause();this.game.input.clear();this.game.world.clearInput();this.root.hidden=false;document.body.dataset.campaign='open';this.heading.textContent=title;this.content.replaceChildren();this.message.textContent='';}
  private button(text:string,run:()=>void|Promise<void>,parent:HTMLElement=this.content):HTMLButtonElement {
    const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>{void Promise.resolve().then(run).catch(()=>{this.message.textContent='Could not start the level. Try again.';});});parent.append(b);return b;
  }
  private focus():void {this.content.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});}
  private save():void {if(!this.game.saveCampaign())this.message.textContent='Progress could not be saved. Browser storage is unavailable.';}
  hide():void {this.root.hidden=true;delete document.body.dataset.campaign;}
  showMenu(result:SaveResult):void {
    this.menuSave=result.status==='ok'?result.save:null;this.screen(result.status==='error'?SAVE_ERROR:'Minor Incident');
    if(result.status==='error')this.button('Start new',()=>this.characterSelect());
    else{
      if(this.menuSave){this.button('Continue',async()=>{await this.game.continueCampaign(this.menuSave!);});this.button('Level select',()=>this.levelSelect());}
      this.button('Start new',()=>this.characterSelect());
    }this.focus();
  }
  private characterSelect():void {this.screen('Choose your survivor');for(const character of ['female','male']as const)this.button(character==='female'?'Female survivor':'Male survivor',async()=>{await this.game.startCampaign(character);});this.focus();}
  private levelSelect():void {
    this.screen('Level select');const save=this.menuSave??this.game.campaign;if(!save)return;
    for(let level=1;level<=6;level++){const b=this.button(`Level ${level}`,async()=>{await this.game.continueCampaign(save,level as Level);});b.disabled=level>save.unlockedLevel;}
    this.button('Back',()=>this.showMenu({status:'ok',save}));this.focus();
  }
  /** A paused result screen can still hand off to progression; no sim polling/allocation when idle. */
  update():void {
    const mission=this.game.world.missions,save=this.game.campaign;
    if(!save||!mission||mission.state.phase!=='progression'||this.offeredMission===mission)return;
    this.offeredMission=mission;
    const match=/^L([1-6])$/.exec(mission.def.id);if(!match)return;
    const level=Number(match[1]) as Level;
    if(level===6){this.screen('Campaign complete');this.button('Level select',()=>{this.menuSave=save;this.levelSelect();});this.focus();return;}
    if(level!==save.completedLevels+1){this.screen('Level complete');this.button('Continue',()=>this.game.continueCampaign(save));this.focus();return;}
    beginRewards(save,level);this.save();this.showRewards();
  }
  showRewards():void {
    const save=this.game.campaign!,p=save.pending!;
    if(p.phase==='unlock'){
      this.screen('Unlock reveal');const text=document.createElement('p');text.textContent=`Level ${p.level} complete · Level ${save.unlockedLevel} unlocked · Racks ${rackSize(save.unlockedLevel)}/${rackSize(save.unlockedLevel)}`;this.content.append(text);
      if(!p.weaponChosen){for(const id of weaponChoices[p.level]!)this.button(`Keep ${label(id)}`,()=>{chooseWeapon(save,id);this.save();this.showRewards();});}
      else{const unlocked=document.createElement('p');unlocked.textContent=save.ownedActions.map(label).join(' · ');this.content.append(unlocked);this.button('Choose upgrades',()=>{revealCards(save);this.save();this.picks=[];this.showRewards();});}
    }else if(p.phase==='cards'){
      this.screen('Pick 2 of 3 upgrades');const cards=document.createElement('div');cards.className='upgrade-cards';this.content.append(cards);
      const next=this.button('Set up racks',()=>{pickUpgrades(save,this.picks);this.save();this.game.applyCampaign();this.showRewards();});next.disabled=this.picks.length!==2;
      for(const id of p.cards){const d=upgrades[id],b=this.button(`${d.title} · Tier ${d.tier} — ${d.description}`,()=>{
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
  reset():void {this.offeredMission=null;this.picks=[];this.hide();}
  dispose():void {this.hide();this.root.remove();}
}
