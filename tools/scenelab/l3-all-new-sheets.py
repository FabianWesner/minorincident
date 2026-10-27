"""L3 native figure and production scene sheets, at most eleven report captures."""
from pathlib import Path
import json,math
from PIL import Image,ImageDraw,ImageFont
ROOT=Path('test-results/l3-all-new');OUT=Path('docs/reports/l3-all-new');OUT.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',15)
def label(image,text):
    panel=Image.new('RGB',(image.width,image.height+30),'#24242c');panel.paste(image,(0,30));ImageDraw.Draw(panel).text((7,6),text,font=font,fill='white');return panel
def stack(images):
    canvas=Image.new('RGB',(max(i.width for i in images),sum(i.height for i in images)+8*(len(images)-1)),'#181820');y=0
    for image in images:canvas.paste(image,((canvas.width-image.width)//2,y));y+=image.height+8
    return canvas
def figure(receipt):
    x0,y0,x1,y1=receipt['bounds']
    return Image.open(receipt['file']).convert('RGB').crop((math.floor(x0)-10,math.floor(y0)-10,math.ceil(x1)+10,math.ceil(y1)+10))
def row(cells):
    width=max(330,max(im.width for im,_ in cells)+12);height=max(im.height for im,_ in cells)+32
    image=Image.new('RGB',(width*len(cells),height),'#24242c');d=ImageDraw.Draw(image)
    for n,(im,title) in enumerate(cells):image.paste(im,(n*width+(width-im.width)//2,30));d.text((n*width+5,6),title,font=font,fill='white')
    return image
rows=[]
for backend in ['webgl2','webgpu']:
    for tier in ['low','high']:
        folder=ROOT/(f'figures-{tier}' if backend=='webgl2' else f'figures-webgpu-{tier}')
        if not (folder/'receipts.json').exists():continue
        receipts=json.loads((folder/'receipts.json').read_text())
        if len(receipts)!=8:continue
        for pixels in [120,400]:
            cells=[]
            for yaw in [-45,135]:
                for variant in ['old','new']:
                    r=next(r for r in receipts if r['variant']==variant and r['targetPixels']==pixels and r['yaw']==yaw)
                    cells.append((figure(r),f'{"GL2" if backend=="webgl2" else "GPU"} {tier} | {variant} {pixels}px {"front" if yaw==-45 else "back"}'))
            rows.append(row(cells))
if len(rows)>=2:label(stack(rows[:2]),'L3 pilot | low WebGL2 | native old/new, front/back').save(ROOT/'pilot-guard-low.jpg',quality=92,optimize=True)
if len(rows)==8:label(stack(rows),'Guard body/rig | L3 game camera | old main 83503eb18 | real held guns: sheets 11/12').save(OUT/'01-national-guard.jpg',quality=92,optimize=True)
tone_rows=[]
for pixels in [120,400]:
    cells=[]
    for tone in [0,3,5]:
        folder=ROOT/('figures-low' if tone==0 else f'skin-tone-{tone}-low')
        if not (folder/'receipts.json').exists():continue
        receipts=json.loads((folder/'receipts.json').read_text())
        if len(receipts)!=8:continue
        r=next(r for r in receipts if r['variant']=='new' and r['targetPixels']==pixels and r['yaw']==-45)
        cells.append((figure(r),f'L3 GL2 low | tone {tone} | {pixels}px'))
    if len(cells)==3:tone_rows.append(row(cells))
if len(tone_rows)==2:label(stack(tone_rows),'Face and wrist tones | camouflage, flags, gloves and backpack remain authored').save(OUT/'02-skin-tones.jpg',quality=92,optimize=True)
crowds=[]
for variant in ['old','new']:
    p=ROOT/f'crowd-{variant}-low/shot-0003.png'
    if p.exists():crowds.append(label(Image.open(p).convert('RGB'),f'{"BEFORE | main 83503eb18" if variant=="old" else "AFTER | L3 v2 cast"} | 30 figures, L3 low, WebGL2'))
if len(crowds)==2:stack(crowds).save(OUT/'03-l3-crowd-old-new.jpg',quality=92,optimize=True)
names=['l3-station-ready','l3-station-attack','l3-fallback-squad','l3-boulevard','l3-army-arrival']
for n,name in enumerate(names,4):
    for tier in ['low','high']:
        folder=ROOT/f'story-new-{tier}'/name
        paths=[folder/f'shot-{frame:04}.png' for frame in [0,30,60]]
        if all(p.exists() for p in paths):
            images=[Image.open(p).convert('RGB') for p in paths]
            for im in images:im.thumbnail((800,450),Image.Resampling.LANCZOS)
            contact=Image.new('RGB',(1600,900),'#181820')
            for k,im in enumerate(images):contact.paste(im,((k%2)*800,(k//2)*450))
            contact.save(folder/'sheet.jpg',quality=92,optimize=True)
    paths=[ROOT/f'story-new-{tier}'/name/'sheet.jpg' for tier in ['low','high']]
    if all(p.exists() for p in paths):stack([label(Image.open(p).convert('RGB'),f'{name} | {tier} | L3 game camera') for p,tier in zip(paths,['low','high'])]).save(OUT/f'{n:02}-{name}.jpg',quality=92,optimize=True)
states=[]
for state in ['healthy','turned','corpse']:
    for tier in ['low','high']:
        p=ROOT/f'states-new-{tier}'/f'npc.national-guard-{state}'/'sheet.jpg'
        if p.exists():states.append(label(Image.open(p).convert('RGB'),f'national guard | {state}, {tier} | production clips and hand-prop lifecycle'))
if len(states)==6:stack(states).save(OUT/'09-states-and-motion.jpg',quality=92,optimize=True)
high_crowds=[ROOT/f'crowd-{variant}-high/shot-0003.png' for variant in ['old','new']]
if all(p.exists() for p in high_crowds):stack([label(Image.open(p).convert('RGB'),f'L3 30-figure crowd | {variant} high | WebGL2') for p,variant in zip(high_crowds,['old','new'])]).save(OUT/'10-crowd-high.jpg',quality=92,optimize=True)
checkpoint=[]
for tier in ['low','high']:
    folder=ROOT/f'checkpoint-new-{tier}/l3-army-inner-cover'
    for name,view in [('close.png','back / neck'),('close-front.png','front / both hand grips')]:
        p=folder/name
        if p.exists():checkpoint.append(label(Image.open(p).convert('RGB'),f'L3 army inner cover | {tier} | {view}'))
if len(checkpoint)==4:stack(checkpoint).save(OUT/'11-army-close.jpg',quality=92,optimize=True)
l4=[ROOT/f'l4-weapons-new-{tier}'/f'close-{azimuth}.png' for tier in ['low','high'] for azimuth in [45,225]]
if all(p.exists() for p in l4):stack([label(Image.open(p).convert('RGB'),f'L4 shared combat path | {tier} | azimuth {azimuth} | real rifle, HMG, hunting rifle') for p,(tier,azimuth) in zip(l4,[(t,a) for t in ['low','high'] for a in [45,225]])]).save(OUT/'12-l4-weapons.jpg',quality=92,optimize=True)
