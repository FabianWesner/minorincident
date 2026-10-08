"""Reference preparation only. Coordinates hand selected after viewing the sheets.
All mapping coordinates below use a 1000 x 1000 normalized sheet coordinate system;
plan.json stores actual pixel coordinates. Never writes outside refs/.
"""
import json,re,shutil,collections
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path('/Users/wesner/Workspace/minorincident'); OUT=ROOT/'epics-pipeline/refs'
manifest=json.loads((ROOT/'src/assets/manifest.json').read_text())
excluded={x['id']:'UI' if x['category']=='ui' else 'pure alias' for x in manifest if x['category']=='ui' or x.get('aliasOf')}
for x in manifest:
 if x['id'].startswith(('ability.','abl.','decal.')) or x['id'] in ['wpn.fists','wpn.kick','decay.graffiti']:
  excluded[x['id']]='ability/action or flat decal (not a 3D object)'
assets={x['id']:dict(x) for x in manifest if x['id'] not in excluded}
# A physical deployable turret is a model even though its ID uses the ability prefix.
assets['abl.turret']=next(dict(x) for x in manifest if x['id']=='abl.turret');excluded.pop('abl.turret',None)
M={}; descriptions={}; origins={i:['manifest'] for i in assets}
def add(id,desc,category=None):
 if id not in assets: assets[id]={'id':id,'category':category or ('vehicle' if id.startswith('veh.') else 'character' if id.startswith(('npc.','char.')) else 'building' if id.startswith(('bld.','int.','kit.')) else 'prop')}
 descriptions[id]=desc;origins.setdefault(id,[]).append('inventory §6 expanded requirement')
def put(sheet,ids,box):
 for id in ids.split():
  if id in assets: M[id]=(sheet,box)
def row(sheet,ids,x0,x1,y0,y1):
 ids=ids.split(); step=(x1-x0)/len(ids)
 for i,id in enumerate(ids): put(sheet,id,(round(x0+i*step),y0,round(x0+(i+1)*step),y1))
# Concrete expansions of §6 wildcard model requirements.
for base in ['veh.sedan-red','veh.sedan-blue','veh.sedan-white','veh.suv-dark','veh.pickup-red','veh.police-sedan','veh.ambulance','veh.school-bus']:
 for state in ['wrecked','burned']: add(base+'.'+state,f'{base.split(".",1)[1].replace("-"," ")} {state} variant: preserve the intact vehicle proportions and identity; crumpled panels, shattered glazing and damaged wheels'+('; charred paint and soot, no active flames' if state=='burned' else '; collision damage, recognizable original paint'))
for id,desc in {
 'prop.hmg-nest':'A defensive sandbag ring containing one mounted heavy machine gun on a sturdy swivel tripod, olive and warm khaki, belt feed and broad shield',
 'veh.military-apc':'An olive green light armored personnel carrier, chunky angular hull, large rugged wheels, roof hatch and mounted heavy machine gun',
 'veh.tank':'An olive green tracked main battle tank, broad bevelled armor, large turret and cannon, compact toy proportions',
 'veh.tank.wrecked':'The same olive tracked tank with battle damage, blackened turret, broken track and dented armor, no active fire',
 'veh.military-apc.wrecked':'The same olive light armored personnel carrier wrecked, damaged mounted HMG and hull, scorched paint and damaged wheels',
 'veh.helicopter-military':'An olive military transport helicopter with side door gun, landing skids and four-blade main rotor, based on the rescue helicopter silhouette',
 'bld.police-station':'Sunset Grove police station hero exterior, brick civic building, blue entrance trim, enclosed yard, sandbag positions and readable armory wing',
 'kit.police-bridge-checkpoint':'A compact bridge checkpoint assembly with motorized boom gate, concrete jersey barriers, crowd control fences and blue/red light bars',
 'bld.apartment-block-a':'Fairhaven apartment block A: intact four-storey warm brick corner building with ground-floor shops, repeated windows and small balconies',
 'bld.apartment-block-b':'Fairhaven apartment block B: intact five-storey cream stucco residential building, ground-floor shops, inset balconies and teal trim',
 'bld.town-hall':'Fairhaven town hall, intact warm brick civic hall with symmetric facade, pale stone entrance steps, clock and modest central tower',
 'bld.church':'Fairhaven church, intact pale stone walls, pitched warm red roof, small bell tower and arched windows',
 'bld.storefront-row':'Fairhaven storefront row: one connected short row of intact two-storey shops with varied warm facades, awnings and broad display windows',
 'bld.metro-entrance':'Fairhaven Metro street entrance, stairwell opening with chunky green railings, canopy, station sign housing and closable shutter',
 'bld.kessler-hardware':'Fairhaven Kessler Hardware storefront, warm brick and wood two-storey shop with broad glazed entrance, striped awning and tool displays, corresponding to Maple Hardware',
 'kit.reception-plaza':'Fairhaven evacuation reception assembly: registration tables, triage canopy, clean tents, folding chairs and water supplies, compact contiguous miniature set',
 'decay.blown-sandbags':'A breached defensive sandbag wall section, torn khaki bags, spilled ochre sand and displaced bags around a broken central opening',
 'decay.fuel-truck-crater':'A blast crater left by the fuel truck, broad concave asphalt depression, fractured raised rim and charred road fragments, no truck or fire',
 'int.basement-cellar':'An isolated roofless basement room cutaway with stairs, storage shelves, one hanging warm bulb and a heavy barrable entrance door',
 'int.metro-station':'Lakeshore Fairhaven Metro station roofless cutaway: concourse, turnstiles, kiosk, benches and platform edge, tiled walls, cool fluorescent strips',
 'int.metro-exit':'Northgate metro exit station roofless cutaway: platform, dead escalator and street exit gate, tiled concrete walls and emergency lamps',
 'kit.metro-tunnel':'One modular metro track tunnel segment with track bed, rails, arched concrete walls, cross-passage door and side maintenance access; front cutaway shows interior',
 'kit.maintenance-corridor':'One modular metro service corridor cutaway, industrial pipes, pump equipment and signal control cabinets, narrow walkable concrete floor',
 'prop.service-gate':'A chunky steel closable maintenance gate with brace brackets, framed industrial panels and a stout handle',
 'prop.fluorescent-strip':'One ceiling-mounted fluorescent strip fixture, rectangular off-white metal housing with frosted tubes and bevelled end caps',
 'prop.emergency-light':'One wall-mounted red emergency lamp, compact industrial gray housing with red translucent cover',
 'kit.shelter-camp':'Compact subway shelter supply assembly with sleeping mats, folded blankets, warm camp lamps and bottled water pallet; no people',
}.items(): add(id,desc)
# Street-facing corridor buildings need separate W2 and W3 references.
for base in ['bld.house-a','bld.house-b','bld.house-c','bld.house-d','bld.house-e','bld.mainstreet-brick','bld.joes-diner','bld.maple-hardware','bld.bus-stop']:
 for state in ['w2','w3']:
  add(base+'.'+state,base.split('.',1)[1].replace('-',' ')+f' {state.upper()} variant, same footprint and recognizable roof, door and window arrangement as {base}; '+('early emergency damage, boarded or broken windows and abandoned entrance clutter' if state=='w2' else 'recent breakdown, broken glazing, soot, damaged signage and localized facade damage; mostly standing'))
for base in ['bld.apartment-block-a','bld.apartment-block-b','bld.town-hall','bld.church','bld.storefront-row','bld.metro-entrance','bld.kessler-hardware','bld.police-station']:
 add(base+'.w5',descriptions[base]+f'; devastated W5 twin of {base}, EXACT same footprint and surviving landmarks; charred surfaces, bullet impacts, broken windows and a partly collapsed facade, no active flames')
for base in ['npc.survivor-group','npc.paramedic','npc.civilian-elderly','npc.civilian-woman-a','npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-b']:
 add(base+'.aftermath',f'{base.split(".",1)[1].replace("-"," ")} aftermath variant, healthy living adult, same base identity and clothing with soot, dust, cloth bandages and small tears; tired expression, relaxed standing pose')
for name,desc in {'dale':'adult mechanic survivor, blue workwear, utility belt and short dark hair','rosa':'adult paramedic survivor, white/red medical uniform and tied-back dark hair','mr-okafor':'elderly Black male survivor, gray hair, cardigan and sensible trousers','mia':'adult woman survivor, red floral dress and light cardigan','sam':'adult hunter survivor, muted green jacket, practical boots and cap','marcus':'adult male subway shelter organizer, practical dark jacket, utility belt and flashlight'}.items():
 add('npc.'+name+'.aftermath',desc+', living healthy survivor with soot, dust and cloth bandages; relaxed stance, chunky quarter-height head and large hands/feet')
for pose in ['sitting','lying','bandaged']:
 add('npc.shelter-survivor.'+pose,'Living injured adult shelter survivor, soot-covered practical civilian clothes, cloth bandages, '+{'sitting':'seated resting pose, knees bent, hands in lap','lying':'lying resting pose, head supported on a small folded blanket','bandaged':'standing with one arm in a sling and a bandaged lower leg'}[pose])
# Restored references also reveal concrete model subassets and gear variants.
legacy_excluded={'fire-engine','inf.schoolgirl','decay.furniture-barricade','prop.flower-bed'}
for ref in sorted((ROOT/'assets').glob('*/reference.png')):
 id=ref.parent.name
 if id in assets or id in legacy_excluded or id.startswith(('ui.','decal.','abl.','ability.','char.survivor.pose-')) or id=='decay.graffiti': continue
 add(id,id.split('.',1)[-1].replace('-',' ').replace('.',' '), 'vehicle' if id.startswith('veh.') else 'character' if id.startswith(('char.','npc.')) else 'building' if id.startswith('bld.') else 'prop')
 origins[id]=['restored assets/<id>/reference.png model subasset']

# Sheet regions (normalized coordinates, hand-selected from visible designs).
s='survivors-corgi-and-equipment'
put(s,'char.survivor-male',(20,135,90,385));put(s,'char.survivor-female',(20,395,90,635));put(s,'char.corgi',(20,655,90,815))
row(s,'equip.backpack-teal equip.backpack-red equip.backpack-green equip.backpack-blue',505,702,850,945)
s='zombies-civilian-characters'
for id,box in {'inf.common-worker':(20,135,105,285),'inf.jogger':(335,135,425,285),'inf.baseball-cap':(20,320,105,465),'inf.suburban-mom':(335,320,415,465),'inf.delivery-driver':(645,320,745,465),'inf.skater':(30,505,110,650),'inf.college-student':(645,500,725,650),'inf.bbq-dad':(645,135,745,285),'inf.cashier':(335,500,415,650),'inf.bathrobe-neighbor':(160,505,245,650),'inf.construction-worker':(765,135,850,285),'inf.crawler':(20,680,125,800),'inf.corpse-poses':(285,855,565,935),'inf.teen-skater':(30,505,110,650)}.items():put(s,id,box)
s='zombies-emergency-workers-and-mutants'
for rownum,pair in enumerate([('inf.riot-cop','inf.hazmat'),('inf.firefighter','inf.bloated'),('inf.screamer','inf.sprinter'),('inf.armored-football','inf.butcher'),('inf.nurse','inf.brute')]):
 for col,id in enumerate(pair):put(s,id,(20+col*480,135+rownum*162,100+col*480,285+rownum*162))
s='weapons-consumables-and-survival-props'
row(s,'wpn.baseball-bat wpn.nail-bat wpn.crowbar wpn.machete wpn.shovel wpn.police-baton',20,546,120,335)
put(s,'wpn.pistol',(566,165,677,320));put(s,'wpn.shotgun',(666,130,870,323));put(s,'wpn.nail-gun',(861,145,980,328))
row(s,'pick.medkit pick.soda pick.energy-drink pick.bandages pick.pistol-ammo pick.shotgun-ammo pick.nail-ammo',20,568,399,517)
put(s,'util.flashlight',(590,432,680,515));put(s,'util.radio',(682,379,738,517));put(s,'util.keys',(743,412,811,517));put(s,'util.batteries',(821,433,875,520));put(s,'util.lockpick-kit',(885,395,980,520))
row(s,'thr.molotov thr.pipe-bomb thr.firecracker-lure',20,237,590,738)
for id,box in {'haz.spike-barricade':(255,597,363,725),'haz.gas-can':(365,612,439,727),'haz.car-alarm':(438,608,481,726),'haz.fuse-box':(484,601,549,729),'haz.propane-tank':(550,590,619,731),'prop.traffic-cone':(620,602,681,729),'prop.folding-chair':(681,610,748,729),'prop.shopping-cart':(740,601,832,735),'prop.mailbox-blue':(835,599,901,727),'prop.trash-bin':(903,586,980,730)}.items():put(s,id,box)
s='heavy-weapons-throwables-and-abilities'
row(s,'wpn.knife wpn.fire-axe wpn.katana',25,980,140,220)
row(s,'wpn.smg wpn.hunting-rifle wpn.assault-rifle',25,980,275,385)
put(s,'wpn.machine-gun',(60,430,490,593));put(s,'wpn.rocket-launcher',(560,445,940,590));put(s,'proj.rocket',(65,650,355,735));put(s,'thr.frag-grenade',(460,620,560,745));put(s,'thr.flashbang',(755,620,850,745));put(s,'abl.turret',(750,780,905,930))
s='melee-extras';put(s,'wpn.police-baton',(20,185,490,930));put(s,'wpn.shovel',(510,185,980,930))
s='living-civilians-and-story-npcs'
for id,box in {'npc.civilian-man-a':(20,120,115,365),'npc.civilian-adult-m':(20,120,115,365),'npc.civilian-man-b':(353,120,453,365),'npc.civilian-woman-a':(680,120,775,365),'npc.civilian-adult-f':(680,120,775,365),'npc.civilian-woman-b':(20,405,115,645),'npc.civilian-kid':(353,412,448,645),'npc.civilian-elderly':(681,404,784,645),'npc.patient-zero-courier':(20,693,100,925),'npc.brother':(280,702,344,925),'npc.mrs-alvarez':(462,698,525,925),'npc.helicopter-pilot':(662,693,725,925),'prop.medical-cooler':(865,720,975,917)}.items():put(s,id,box)
s='emergency-responders-and-survivor-allies'
for i,id in enumerate(['npc.police-officer','npc.paramedic','npc.firefighter-alive','npc.national-guard']):put(s,id,(20+i*245,160,90+i*245,490))
put(s,'npc.survivor-group',(20,560,90,910))
s='heavy-and-special-vehicles'
row(s,'veh.courier-van veh.military-truck veh.box-truck veh.semi-trailer',20,980,190,495)
put(s,'veh.helicopter',(20,565,250,900));put(s,'veh.train-freight',(255,575,505,900))
s='more-vehicles'
put(s,'veh.fuel-truck',(20,185,330,445));put(s,'veh.jeep-red',(345,185,655,445));put(s,'veh.pickup-white',(680,185,980,445));put(s,'veh.police-suv',(20,500,325,700));put(s,'veh.sedan-green',(340,500,655,700));put(s,'veh.suv-green',(680,500,980,700))
s='wrecked-and-burned-vehicles'
for r,state in enumerate(['wrecked','burned']):
 row(s,' '.join(base+'.'+state for base in ['veh.sedan-red','veh.sedan-blue','veh.sedan-white','veh.suv-dark','veh.pickup-red','veh.police-sedan','veh.ambulance','veh.school-bus']),20,990,210+r*395,490+r*395)
put(s,'veh.wreck',(20,210,135,490))
s='civic-buildings-and-park'
row(s,'bld.police bld.fire-station bld.gazebo bld.hospital-exterior',20,980,190,555)
row(s,'bld.power-substation bld.restroom-block bld.park-lodge bld.reptile-house',20,980,595,945)
s='interiors'
put(s,'int.diner',(20,160,495,535));put(s,'int.food-court',(510,160,980,535));put(s,'int.gym-cafeteria',(20,575,495,945));put(s,'int.mini-mall',(510,575,980,945))
s='shops-interiors-and-retail-props'
put(s,'int.supermarket',(20,155,265,470));put(s,'int.pharmacy-clinic',(765,155,980,470))
s='roadside-diner-gas-station-and-street-props'
put(s,'bld.joes-diner',(20,135,248,470));put(s,'bld.gas-station',(250,135,493,470));put(s,'bld.maple-hardware',(500,135,744,470));put(s,'bld.mainstreet-brick',(750,135,980,470))
s='school-playground-and-gym';put(s,'bld.school-elementary',(20,130,495,440));put(s,'kit.playground',(20,455,495,670))
s='suburban-homes-backyards-and-street-props'
put(s,'bld.house-a',(605,90,805,240));put(s,'bld.house-b',(220,365,330,465));put(s,'bld.house-c',(20,110,145,260));put(s,'bld.safe-house',(505,365,890,600));put(s,'bld.shed',(157,705,243,800));put(s,'kit.porch-stairs',(745,650,870,797))
row(s,'veh.sedan-red veh.sedan-blue veh.sedan-white',20,295,828,928)
put(s,'veh.suv-dark',(535,507,664,607))
for id,box in {'prop.bench':(20,712,100,790),'prop.hedge':(94,661,142,713),'prop.picket-fence':(22,661,89,715),'prop.street-lamp':(600,645,631,782),'prop.street-sign':(635,659,680,754),'prop.utility-pole':(684,645,733,790),'prop.barricade':(438,718,489,790),'prop.flower':(142,659,183,715),'prop.garden-bush':(183,655,242,714),'prop.garden-bush-small':(247,660,285,714),'prop.fire-hydrant':(563,660,595,723)}.items():put(s,id,box)
put(s,'prop.street-tree prop.tree',(183,105,311,296));put(s,'prop.street-tree-blossom',(165,104,245,200))
s='l1v2-key-locations'
put(s,'bld.clinic-annex',(20,150,495,445));put(s,'bld.garage-detached',(510,150,980,445));put(s,'bld.cafe-corner',(210,460,765,665));put(s,'veh.courier-bike',(75,690,355,805));put(s,'prop.package-courier',(850,695,900,790))
row(s,'char.courier-male char.courier-female npc.courier-third npc.courier-fourth',175,815,815,965)
s='l1v2-neighborhood-kit'
row(s,'bld.courier-depot bld.house-d bld.house-e kit.car-wash',20,980,180,590)
put(s,'prop.yard-gate',(20,650,240,925));put(s,'prop.privacy-fence',(370,650,590,925));put(s,'prop.bike-rack',(600,650,780,925))
s='l1v2-neighborhood-kit-2'
row(s,'npc.lab-tech-a npc.lab-tech-b npc.lab-guard npc.depot-clerk',10,990,120,410)
row(s,'house.garage.closed house.garage.open house.garage.half',15,270,465,610)
put(s,'kit.house-variants',(15,460,270,610));put(s,'house.porch-a',(15,632,133,773));put(s,'house.porch-b',(140,630,270,773));put(s,'prop.cafe-patio-set',(15,632,133,773));put(s,'prop.garden-set',(275,460,595,775))
for id,box in {'prop.bbq':(278,470,338,600),'prop.lawn-chair-a':(345,475,396,601),'prop.lawn-chair-b':(399,480,458,601),'prop.kiddie-pool':(460,490,549,600),'prop.gnome':(550,475,595,600),'prop.flamingo':(280,632,340,761),'prop.sprinkler':(340,632,420,761),'prop.hose-reel':(427,632,492,761),'prop.wheelbarrow':(495,632,595,762),'prop.flower-bed.large':(608,470,735,590),'prop.flower-bed.small':(618,605,726,702),'prop.flower-box':(630,720,710,777),'prop.crates':(755,475,829,590),'prop.carpet':(838,493,903,577),'prop.trash-bags':(905,480,984,590),'prop.alley-set':(750,470,985,775),'prop.broken-chair':(757,615,809,770),'prop.recycling-bin':(811,615,872,760),'prop.laundry-line':(875,610,986,775),'prop.lab-signs':(275,820,512,923),'house.driveway.empty':(10,787,109,926),'house.driveway.anchor':(105,787,206,926),'house.driveway.hoop':(188,760,273,926),'kit.edge-roadwork':(743,815,989,934)}.items():put(s,id,box)
s='street-and-camp-props'
row(s,'prop.dumpster prop.fire-extinguisher prop.folding-chair',20,980,150,395)
row(s,'prop.pallet prop.plank-stack prop.sandbag-pallet',20,980,445,670)
row(s,'prop.shopping-cart prop.sofa prop.vending-cart',20,980,720,960)
s='event-props-ammo-and-gear'
put(s,'prop.stop-here-sign-trailer',(655,180,960,550));put(s,'prop.scoreboard',(335,190,635,525));put(s,'prop.tear-gas-canister',(760,590,850,930))
s='parks-baseball-field-and-campsite'
put(s,'kit.campground',(745,180,965,550));put(s,'kit.creek-bridge-wood',(515,270,735,550));put(s,'bld.dugout',(185,705,255,796));put(s,'kit.bleachers',(20,710,159,797));put(s,'prop.picnic-table',(740,625,885,720));put(s,'prop.tent',(792,314,929,465));put(s,'kit.rail-crossing',(5,5,10,10)) # replaced below
s='bridges-roads-and-terrain-kits'
put(s,'kit.bleachers',(20,610,245,915));put(s,'kit.creek-bridge-wood',(262,620,490,915));put(s,'kit.rail-crossing',(510,600,750,920));put(s,'kit.river-terrain',(770,600,985,920));put(s,'kit.highway-onramp',(655,180,980,535))
s='town-edge-bridge-rail-and-power';put(s,'bld.river-bridge',(20,165,245,365));put(s,'bld.tunnel-portal',(345,550,632,905))
s='highway-helipad-and-safe-zone';put(s,'bld.civic-center',(20,230,480,900));put(s,'bld.helipad',(765,480,975,665))
s='emergency-services-buildings-vehicles-and-props'
put(s,'veh.fire-engine',(600,470,987,630));put(s,'kit.police-checkpoint',(20,130,250,440));put(s,'kit.evac-camp',(745,130,980,440));put(s,'prop.checkpoint-gate',(30,640,100,718));put(s,'prop.crowd-fence',(337,647,405,715));put(s,'prop.jersey-barrier',(505,650,575,715))
s='decay-and-destruction'
put(s,'decay.dropped-belongings',(20,180,280,430));put(s,'decay.broken-glass debris.glass',(330,320,450,430));put(s,'decay.boarded-windows',(500,180,575,430));put(s,'decay.burned-facade',(20,540,485,740));put(s,'decay.collapsed-facade',(535,550,705,755));put(s,'decay.rubble-pile debris.rubble',(705,580,975,755));put(s,'decay.downed-power-line',(20,780,250,935));put(s,'decay.fallen-tree',(250,770,465,935));put(s,'decay.crater',(490,780,650,935));put(s,'decay.body-bag',(650,780,760,935));put(s,'decay.abandoned-checkpoint',(785,770,975,935))
s='gore-gibs-and-blood';put(s,'gib.chunk-set',(30,175,170,375));put(s,'gib.limb-generic',(510,210,690,455))
s='infected-animals'
for id,box in {'inf.cat-black':(20,180,150,340),'inf.cat-tabby':(345,180,490,340),'inf.crow':(680,180,820,340),'inf.dog-dachshund':(20,445,170,620),'inf.dog-k9':(345,440,490,620),'inf.dog-retriever':(680,445,835,620),'inf.flamingo':(20,725,165,925),'inf.gorilla':(345,725,480,925),'inf.lion':(680,725,830,925)}.items():put(s,id,box)
s='animals-pets-and-zoo';put(s,'bld.zoo-gate',(20,420,325,695));put(s,'amb.zebra',(685,755,840,950));put(s,'amb.elephant',(820,755,915,950));put(s,'amb.pigeon',(770,190,895,265))
# Existing images override drafted sources and need only a hero cleanup.
existing={ 'prop.porta-potty':'portable-toilet','veh.police-sedan':'police-car','prop.gas-pump':'gas-pump','veh.ambulance':'ambulance','veh.pickup-red':'pickup-truck','prop.jukebox':'jukebox','veh.school-bus':'school-bus','bld.bus-stop':'bus-stop','prop.bus-stop':'bus-stop','prop.light-tower':'light-tower','prop.light-tower-trailer':'light-tower','prop.vending-machine':'vending-machine'}
existing={id:ROOT/'experiment'/folder/'reference-upscaled.png' for id,folder in existing.items()}
legacy_matches={'veh.fire-engine':'fire-engine','npc.civilian-adult-m':'npc.civilian-man-a','npc.civilian-adult-f':'npc.civilian-woman-a','npc.survivor-group':'npc.survivor-ally-mechanic','decay.burned-facade':'decay.burned-facade.house','veh.wreck':'veh.sedan-red.wrecked'}
for id in assets:
 folder=ROOT/'assets'/id
 for name in ['reference-upscaled.png','reference.png']:
  if (folder/name).exists(): existing[id]=folder/name;break
 else:
  folder=ROOT/'assets'/legacy_matches.get(id,id)
  for name in ['reference-upscaled.png','reference.png']:
   if (folder/name).exists(): existing[id]=folder/name;break

# Descriptions for non-drafted models and design details not conveyed by IDs.
descriptions.update({
 'wpn.halligan':'A firefighter Halligan pry bar, dark steel shaft, forked claw on one end and perpendicular adze/spike on the other, rounded chunky handles',
 'prop.axe-rack':'A fire station wall-mounted red tool rack holding several chunky fire axes, simple metal frame and brackets',
 'prop.armory-table':'A police armory pickup table, chunky steel legs, wooden top, one laid-out handgun and equipment case',
 'int.fire-station-bay':'Roofless fire station truck bay cutaway: vehicle bay, lockers, radio desk, kitchen corner, benches and red rotating alarm beacons',
 'kit.army-checkpoint':'A compact army checkpoint assembly, T-walls and bastion walls, razor wire, sandbag nests, watchtower, loudspeaker pole and floodlights',
 'veh.evac-bus':'An evacuation coach bus, cream and teal civilian livery, broad windows with seated adult silhouettes, clean roof and bus doors, no lettering',
 'thr.smoke-grenade':'A compact cylindrical smoke grenade, olive casing, metal pull ring and cap, orange band; held-item model, no smoke cloud',
 'bld.house-b':'Suburban house B, warm cream wood siding, gabled roof and porch, distinct roof outline from house A',
 'bld.house-c':'Suburban house C, small warm cream house with garage frontage and red gabled roof',
 'prop.cafe-patio-set':'One compact cafe patio furniture assembly, wooden table, two chairs and flower pots; isolate furniture from surrounding bikes and other porch props',
 'npc.survivor-group':'One adult mechanic survivor from the group, work overalls, utility belt and short hair; one human only, use the first mechanic figure in the crop',
 'inf.teen-skater':'Young ADULT infected skater, beanie, hoodie and loose trousers, desaturated skin and red eyes; age at least 18',
 'inf.skater':'Young ADULT infected skater, beanie, hoodie and loose trousers, desaturated skin and red eyes; age at least 18',
 'inf.college-student':'Young ADULT infected college student, skirt and cardigan, red eyes and torn clothing; age at least 18',
 'inf.corpse-poses':'One adult infected civilian corpse in a sprawled horizontal pose, chunky toy proportions, no detached extras',
 'gib.chunk-set':'One representative chunky red stylized gib from the crop, bevelled irregular block shape, no realistic organs',
 'gib.limb-generic':'One generic detached adult infected arm from the crop, torn sleeve and flat palette-red stump cap, chunky low-poly shape',
 'debris.wood-small':'One small broken warm brown wooden plank with jagged bevelled ends',
 'debris.metal':'One bent gray metal debris panel, bevelled edges, simplified dent and torn corner',
 'decay.looted-store':'One roofless looted shop-front section with empty shelves and a small merchandise scatter, broken display window',
 'decay.damaged-sign':'One bent and damaged freestanding shop sign, cracked sign panel, warm frame and simplified chipped edges',
 'decay.makeshift-barricade':'One coherent makeshift barricade assembly of a damaged car body and stacked furniture, chunky street defensive obstacle',
 'bld.gas-station':'Sunset Fuel fictional gas station, canopy, shop and price-sign housing; omit existing real-world trademark and all lettering',
 'prop.tear-gas-canister':'One cylindrical olive tear gas canister with simple metal ring and top, no emitted smoke',
})
# Corrections after viewing every saved crop in labelled contact proofs.
s='survivors-corgi-and-equipment'
put(s,'char.survivor-male',(20,135,110,337));put(s,'char.survivor-female',(20,378,108,581));put(s,'char.corgi',(20,625,98,755));row(s,'equip.backpack-teal equip.backpack-red equip.backpack-green equip.backpack-blue',502,747,838,936)
s='zombies-civilian-characters'
put(s,'inf.common-worker',(15,120,120,280));put(s,'inf.jogger',(332,120,415,280));put(s,'inf.construction-worker',(668,120,775,280))
put(s,'inf.skater inf.teen-skater',(15,308,95,457));put(s,'inf.baseball-cap',(258,308,378,457));put(s,'inf.college-student',(499,308,591,457));put(s,'inf.suburban-mom',(733,308,831,457))
put(s,'inf.bbq-dad',(12,489,130,648));put(s,'inf.delivery-driver',(261,489,367,648));put(s,'inf.cashier',(500,489,574,648));put(s,'inf.bathrobe-neighbor',(732,489,849,648));put(s,'inf.crawler',(15,684,160,796));put(s,'inf.corpse-poses',(391,850,531,906))
s='zombies-emergency-workers-and-mutants'
for r,pair in enumerate([('inf.riot-cop','inf.hazmat'),('inf.firefighter','inf.bloated'),('inf.screamer','inf.sprinter'),('inf.armored-football','inf.butcher'),('inf.nurse','inf.brute')]):
 for c,id in enumerate(pair):put(s,id,(15+c*490,112+r*167,102+c*490+(20 if id in ['inf.brute','inf.bloated'] else 0),259+r*167))
s='infected-animals'
# Entire small turnaround panels keep tails, ears, wings and paws complete.
for r,ids in enumerate(['inf.cat-black inf.cat-tabby inf.crow','inf.dog-dachshund inf.dog-k9 inf.dog-retriever','inf.flamingo inf.gorilla inf.lion']):
 row(s,ids,15,986,165+r*263,420+r*263)
s='animals-pets-and-zoo'
put(s,'amb.pigeon',(770,250,978,400));put(s,'amb.zebra',(493,749,672,910));put(s,'amb.elephant',(663,725,779,913))
s='parks-baseball-field-and-campsite'
put(s,'bld.dugout',(130,622,248,768));put(s,'prop.picnic-table',(124,531,222,615));put(s,'prop.tent',(770,173,875,278));put(s,'prop.street-tree-blossom',(18,795,110,941));put(s,'prop.tree prop.street-tree',(108,797,182,941))
s='event-props-ammo-and-gear'
put(s,'prop.scoreboard',(265,135,491,540));put(s,'prop.stop-here-sign-trailer',(506,152,743,545));put(s,'prop.tear-gas-canister',(813,257,905,531));put(s,'thr.smoke-grenade',(819,625,902,898))
s='l1v2-key-locations'
put(s,'bld.cafe-corner',(345,413,650,626));put(s,'veh.courier-bike',(168,645,360,799));put(s,'prop.package-courier',(648,653,791,790));put(s,'char.courier-female',(190,811,247,969));put(s,'char.courier-male',(590,811,642,969))
s='decay-and-destruction'
put(s,'decay.broken-glass debris.glass',(386,240,477,347));put(s,'decay.rubble-pile debris.rubble',(775,532,860,640));put(s,'decay.burned-facade',(15,459,140,668));put(s,'decay.collapsed-facade',(528,438,707,678));put(s,'decay.body-bag',(674,746,748,892))
s='suburban-homes-backyards-and-street-props'
put(s,'bld.house-b',(10,360,210,603));row(s,'veh.sedan-red veh.sedan-blue veh.sedan-white',18,299,850,925)
s='l1v2-neighborhood-kit'
put(s,'prop.yard-gate',(20,650,145,925));put(s,'prop.privacy-fence',(367,650,485,925));put(s,'prop.bike-rack',(590,650,725,925))
s='weapons-consumables-and-survival-props'
for id,box in {'pick.medkit':(22,414,107,518),'pick.soda':(125,413,170,518),'pick.energy-drink':(184,408,223,518),'pick.bandages':(236,425,306,516),'pick.pistol-ammo':(317,409,395,516),'pick.shotgun-ammo':(417,409,487,516),'pick.nail-ammo':(491,397,570,523)}.items():put(s,id,box)
s='heavy-weapons-throwables-and-abilities'
row(s,'wpn.knife wpn.fire-axe wpn.katana',20,985,115,245);row(s,'wpn.smg wpn.hunting-rifle wpn.assault-rifle',20,985,255,414);put(s,'wpn.machine-gun',(45,420,500,610));put(s,'wpn.rocket-launcher',(550,450,980,610))
s='heavy-and-special-vehicles';row(s,'veh.courier-van veh.military-truck veh.box-truck veh.semi-trailer',15,989,160,499)
# Bounds enlarged for long rotors and roofs, preserve source design.
put(s,'veh.helicopter',(10,550,257,935))
s='emergency-services-buildings-vehicles-and-props';put(s,'prop.jersey-barrier',(472,644,519,718))
# No isolated police-station exterior appears on the sheets: the civic first tile is a baseball grandstand.
M.pop('bld.police',None)
descriptions['bld.police']='Sunset Grove police station exterior, low civic brick building, blue trim and wide glazed entrance, small enclosed yard; the police checkpoint kit is a separate location'
descriptions['amb.pigeon']='One healthy gray pigeon from the lower healthy flock in the crop; no red infected eyes'
descriptions['amb.zebra']='One healthy black-and-white zebra from the crop, complete hooves and tail'
descriptions['amb.elephant']='One healthy gray elephant from the crop, rounded chunky body, trunk and large ears'
descriptions['prop.picnic-table']='One wooden picnic table with attached bench seats from the crop'
descriptions['kit.house-variants']='One detached garage module from the crop, use the complete closed-door version as the hero; retain its chunky suburban trim'
descriptions['house.porch-a']='One porch furniture assembly: two wooden rocking chairs with flower pots as shown, not a building'
descriptions['house.porch-b']='One porch accessory assembly: bikes, small wagon and ball as shown, not a building'
descriptions['kit.edge-roadwork']='One coherent roadwork kit assembly with the barricade, orange fence and small excavator from the crop'
descriptions['prop.lab-signs']='One representative framed rectangular industrial lab access sign from the crop, blank panel with no lettering'
descriptions['decay.dropped-belongings']='One representative dropped travel suitcase from the crop, red hard shell, wheels and extended handle'
descriptions['decay.rubble-pile']='One medium rubble pile from the crop, brick, stone and concrete fragments in a coherent low mound'
descriptions['debris.rubble']='One representative concrete and brick rubble fragment from the medium rubble pile in the crop'
descriptions['debris.glass']='One representative chunky translucent broken glass shard from the crop'

# Keep whole silhouettes where narrow crops touched hands, toes or tails.
s='zombies-civilian-characters'
put(s,'inf.jogger',(332,120,415,288));put(s,'inf.baseball-cap',(258,307,378,463));put(s,'inf.suburban-mom',(733,307,831,463));put(s,'inf.construction-worker',(668,120,775,285))
s='zombies-emergency-workers-and-mutants'
put(s,'inf.brute',(505,777,620,941));put(s,'inf.nurse',(15,777,86,941))
s='infected-animals'
for r,ids in enumerate(['inf.cat-black inf.cat-tabby inf.crow','inf.dog-dachshund inf.dog-k9 inf.dog-retriever','inf.flamingo inf.gorilla inf.lion']):row(s,ids,15,986,136+r*280,410+r*280)
s='emergency-responders-and-survivor-allies';put(s,'npc.survivor-group',(18,550,110,920));put(s,'npc.national-guard',(745,145,842,495))
s='suburban-homes-backyards-and-street-props';put(s,'prop.bench',(15,719,102,797));put(s,'kit.porch-stairs',(744,661,875,799))
s='street-and-camp-props';put(s,'prop.folding-chair',(710,145,935,400));put(s,'prop.dumpster',(30,145,305,400))
s='weapons-consumables-and-survival-props'
put(s,'wpn.shotgun',(663,129,879,330));put(s,'wpn.nail-bat',(97,124,198,337));put(s,'wpn.machete',(279,115,355,337))
s='heavy-and-special-vehicles';put(s,'veh.box-truck',(489,164,735,500));put(s,'veh.helicopter',(10,550,270,935))
s='more-vehicles';put(s,'veh.police-suv',(15,455,330,715));put(s,'veh.jeep-red',(345,150,660,450));put(s,'veh.pickup-white',(660,160,985,450));put(s,'veh.suv-green',(665,445,985,714));put(s,'veh.fuel-truck',(15,145,335,450))
s='heavy-weapons-throwables-and-abilities';put(s,'wpn.hunting-rifle',(330,255,677,415))

# Recover descriptive inventory notes, and retain provenance for missing-model rows.
missing=(ROOT/'tools/assets/missing-models.md').read_text()
for line in missing.splitlines():
 if not line.startswith('| `'): continue
 id=re.search(r'`([^`]+)`',line).group(1)
 if id in excluded: continue
 cells=[c.strip() for c in line.split('|')]
 if id not in assets: add(id,cells[3])
 origins.setdefault(id,[]).append('tools/assets/missing-models.md')
 if id not in descriptions: descriptions[id]=cells[3]
# Matching style sheet chosen by category; text items use it only for style.
style={ 'vehicle':'heavy-and-special-vehicles','building':'civic-buildings-and-park','character':'living-civilians-and-story-npcs','infected':'zombies-civilian-characters','weapon':'weapons-consumables-and-survival-props','prop':'street-and-camp-props'}
plan=[]
for id,a in sorted(assets.items()):
 dest=OUT/id;dest.mkdir(exist_ok=True)
 description=descriptions.get(id,id.split('.',1)[-1].replace('-',' ').replace('.',' '))
 if id.startswith('char.survivor-'):description+='; red clothing, teal backpack, red sneakers, oversized head and hands'
 if id.startswith('inf.') and id not in descriptions:description+='; adult infected with desaturated skin, torn clothes and glowing red eyes' if 'dog' not in id and 'cat' not in id and id not in ['inf.crow','inf.lion','inf.gorilla','inf.flamingo'] else '; stylized infected animal with glowing red eyes'
 entry={'id':id,'category':a['category'],'source':'text','sheet':None,'box':None,'description':description}
 if id in existing:
  source=existing[id]
  if not (dest/'existing.png').exists() or (dest/'existing.png').stat().st_size!=source.stat().st_size: shutil.copy2(source,dest/'existing.png')
  (dest/'crop.png').unlink(missing_ok=True)
  entry.update(source='existing',existing=str(source))
 elif id in M:
  sheet,box=M[id];source=ROOT/'initial-drafts'/f'{sheet}.png';im=Image.open(source);w,h=im.size
  box=[round(box[0]*w/1000),round(box[1]*h/1000),round(box[2]*w/1000),round(box[3]*h/1000)]
  assert 0<=box[0]<box[2]<=w and 0<=box[1]<box[3]<=h,(id,box)
  im.crop(box).save(dest/'crop.png');entry.update(source='sheet',sheet=str(source),box=box)
 plan.append(entry)
 matching=entry['sheet'] or str(ROOT/'initial-drafts'/f'{style[a["category"]]}.png')
 context=f'load the matching sheet {matching} with view_image for style context'
 if entry['source']=='sheet':context+=', and crop.png for the exact design (do NOT redesign, only clarify). The crop may include neighboring objects, repeated views or scenery: use only the named asset; do not reproduce the whole crop as a scene'
 elif entry['source']=='existing':context+=f', and {entry["existing"]} (also copied to existing.png) with view_image for the exact design; preserve the same design and only derive the single isolated three-quarter hero from it; do NOT regenerate turnarounds'
 else:context+='; this is a new text design, follow the asset description'
 # Variants anchor on intact reference first, to preserve footprint and identity.
 base=next((id[:-len(suffix)] for suffix in ['.w2','.w3','.w5','.aftermath','.wrecked'] if id.endswith(suffix) and id[:-len(suffix)] in assets),None)
 anchor=f'\nFor this variant first view {OUT/base}/hero.png if available, otherwise its crop.png or existing.png if present; preserve the base footprint, proportions and identity.' if base else ''
 if id.startswith('npc.shelter-survivor.'): anchor+='\nKeep the explicitly requested resting/injured pose in every view; it overrides the default standing A-pose.'
 required='(a) hero.png — ONE view of the object, three-quarter front from slightly above (≈30°), the whole object centred with ~10 % margin, plain light-neutral background (#d9d6d0) or transparent, no ground shadow clutter, no text/labels, even soft lighting, ≥ 1536 px on the long side (upscale if needed). This is the image-to-3D input: single isolated object, clean silhouette.'
 if entry['source']=='existing':required+='\nOnly hero.png is required for this existing reference. Do not generate a turnaround; return "turnaround": null.'
 else:required+='\n(b) turnaround.png — front, side, back and three-quarter views side by side, same scale, same style (characters: relaxed A-pose-ish stance, arms slightly away from the body).'
 prompt=f'''# Task: clean reference images for {id} (for image-to-3D)
Work ONLY in {dest}/. Asset: {description}. Style: the game's stylized chunky low-poly toy look (warm saturated colours, soft light, slight bevels) — {context}.{anchor}
Use the built-in imagegen tool. For interiors use an isolated roofless room cutaway. For kits/sets use ONE compact coherent assembly with components visibly connected or supported on a small neutral base; never a contact sheet of loose objects in hero.png. Produce:
{required}
Generate once; regenerate once only if clearly wrong (wrong design, cropped, cluttered background). Copy chosen files from $CODEX_HOME/generated_images. Write prompt.md with the prompts used and today's date. Inspect saved image dimensions and report actual pixel size. Preserve provided crop.png and existing.png. Never modify game code, manifest, specs or source sheets. Do not push, merge or deploy.
Final message = one JSON object: {{"id":"{id}","hero":"<path>","turnaround":"<path or null>","hero_px":[w,h],"attempts":n,"notes":"..."}}
'''
 (OUT/'briefs'/f'{id}.md').write_text(prompt)
(OUT/'plan.json').write_text(json.dumps(plan,indent=2)+'\n')
jobs=[{'slug':'ref-'+p['id'].replace('.','_'),'prompt_file':'briefs/'+p['id']+'.md','workspace':str(ROOT),'model':'gpt-6.1-sol','effort':'low','sandbox':'danger-full-access','max_seconds':1500} for p in plan]
(OUT/'jobs.json').write_text(json.dumps(jobs,indent=2)+'\n')
summary={'total':len(plan),'categories':dict(collections.Counter(p['category'] for p in plan)),'sources':dict(collections.Counter(p['source'] for p in plan)),'unclassified':[],'excluded':excluded,'origins':origins}
summary['excluded_restored_references']=[f.parent.name for f in (ROOT/'assets').glob('*/reference.png') if f.parent.name not in assets]
(OUT/'coverage.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['origins','excluded']},indent=2))

# Contact proofs contain every sheet crop, labelled by ID, for visual verification.
crops=[p for p in plan if p['source']=='sheet'] if '--proofs' in __import__('sys').argv else []
for page in range(0,len(crops),36):
 canvas=Image.new('RGB',(1440,1440),'#ece9e4');d=ImageDraw.Draw(canvas)
 for j,p in enumerate(crops[page:page+36]):
  im=Image.open(OUT/p['id']/'crop.png').convert('RGB');im.thumbnail((232,204))
  x=(j%6)*240;y=(j//6)*240;canvas.paste(im,(x+(240-im.width)//2,y+22));d.text((x+3,y+3),p['id'],fill='black')
 canvas.save(OUT/f'crop-proof-{page//36}.jpg',quality=87)
