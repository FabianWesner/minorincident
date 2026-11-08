"""Prepare immutable before inputs, check Blender reproducibility, assemble one small review JPEG."""
import hashlib
import json
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT/'.cache/r15-farmassets'
REPORT = ROOT/'docs/reports/r15-farmassets'
IDS = ['veg.corn-block','bld.farm-barn-ruin','bld.farm-house-ruin','prop.farm-tractor','prop.farm-combine']
BASE = '08149d1a'
REPORT.mkdir(parents=True,exist_ok=True)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare():
    def old(path):
        return subprocess.check_output(['git','show',f'{BASE}:{path}'],cwd=ROOT)
    for asset in IDS:
        for lod in ['', '.lod1', '.lod2']:
            path=f'assets/{asset}/model{lod}.glb'
            dest=CACHE/'before'/path
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(old(path))
    baseline=CACHE/'baseline'
    baseline.mkdir(parents=True,exist_ok=True)
    source=old('src/levels/L10/farmLayout.ts').decode()
    for before,after in [("'../districts/types'","'../../../src/levels/districts/types'"),
                         ("'../../assets/worldDefinitions'","'../../../src/assets/worldDefinitions'"),
                         ("'../../core/Rng'","'../../../src/core/Rng'"),
                         ("'./district'","'../../../src/levels/L10/district'")]:
        source=source.replace(before,after)
    (baseline/'farmLayout.ts').write_text(source)
    manifest=json.loads(old('src/assets/manifest.json'))
    (baseline/'manifest.json').write_text(json.dumps([d for d in manifest if d['id'] in IDS],indent=2)+'\n')


def determinism():
    rows=json.loads((REPORT/'asset-budgets.json').read_text())
    files=[ROOT/'assets'/r['id']/('model'+('.burned' if r['burned'] else '')+(f'.lod{r["lod"]}' if r['lod'] else '')+'.glb') for r in rows]
    before={str(p.relative_to(ROOT)):digest(p) for p in files}
    with (CACHE/'rebuild.log').open('w') as log:
        subprocess.run([sys.executable,'tools/blender/run.py','tools/blender/build_l10_farm.py'],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True)
    after={str(p.relative_to(ROOT)):digest(p) for p in files}
    result=dict(baseRevision=BASE,files=len(files),identical=before==after,sha256=after)
    (REPORT/'determinism.json').write_text(json.dumps(result,indent=2)+'\n')
    if not result['identical']:
        raise SystemExit('Non-deterministic source GLB rebuild')
    print(f'{len(files)} source GLBs reproduce byte for byte')


def inputs():
    # The runner's --with option filters its git file list; it does not discover
    # ignored cache files. Send these small native inputs as one temporary archive.
    with tarfile.open(ROOT/'.r15-farmassets-input.tar.gz','w:gz') as archive:
        for directory in [CACHE/'baseline',CACHE/'unfolded']:
            for path in sorted(directory.rglob('*')):
                if path.is_file():
                    archive.add(path,arcname=str(path.relative_to(ROOT)))


def compose():
    render=CACHE/'renders'
    def font(size):
        for path in ['/System/Library/Fonts/Supplemental/Arial.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
            if Path(path).exists():
                return ImageFont.truetype(path,size)
        return ImageFont.load_default()
    body,title=font(16),font(23)
    canvas=Image.new('RGB',(1200,3400),'#1b2029')
    draw=ImageDraw.Draw(canvas)
    draw.text((14,10),'L10 farm rebuild | before 08149d1a / after | native Blender, game camera',font=title,fill='white')
    draw.text((14,42),'Corn detail: tapered stalks, curled dry leaves, ears, colour variation and soil furrows | radius 8 m',font=body,fill='#e3c9a6')
    for col,phase in enumerate(['before','after']):
        draw.text((col*600+12,65),phase.upper(),font=body,fill='white')
        image=Image.open(render/f'corn-close-{phase}.png').convert('RGB')
        image.thumbnail((600,338),Image.Resampling.LANCZOS)
        canvas.paste(image,(col*600,87))
    y=435
    columns=['Before / zoom 1','After / zoom 1','Before / zoom 1.5','After / zoom 1.5']
    for i,label in enumerate(columns):
        draw.text((i*300+9,y),label,font=body,fill='#e3c9a6')
    y+=24
    for label,caption in [('field-high','Corn field: high detail, same nine tiles / authored colour and soil'),
                          ('field-low','Corn field: low quality LOD1, same nine tiles / planted rows'),
                          ('barn','Barn: roof mass, real doorway, silo, hay bales and torn roof / rafters'),
                          ('house','Farmhouse: sagged / burned roof and chimney'),
                          ('machines','Machinery: rusted tractor and burned combine, field edge')]:
        draw.text((10,y),caption,font=body,fill='white')
        y+=21
        for col,(phase,zoom) in enumerate([('before',1),('after',1),('before',1.5),('after',1.5)]):
            image=Image.open(render/f'{label}-{phase}-z{zoom}.png').convert('RGB')
            image.thumbnail((300,169),Image.Resampling.LANCZOS)
            canvas.paste(image,(col*300,y))
        y+=177
    draw.text((14,y),'Authored asset sheet | all rebuilt LODs and burned variants | neutral inspection light',font=title,fill='white')
    y+=34
    for col in range(3):
        draw.text((230+col*320,y),f'LOD{col}',font=body,fill='#e3c9a6')
    y+=23
    stats=json.loads((REPORT/'asset-budgets.json').read_text())
    rows=[(asset,False) for asset in IDS]+[(asset,True) for asset in IDS if asset!='veg.corn-block']
    for asset,burned in rows:
        label=asset.replace('bld.','').replace('prop.','').replace('veg.','')
        draw.text((12,y+35),label,font=body,fill='white')
        draw.text((12,y+58),'burned' if burned else 'dry / rusted',font=body,fill='#e3c9a6')
        for lod in range(3):
            image=Image.open(render/f'sheet-{asset}{"-burned" if burned else ""}-lod{lod}.png').convert('RGB')
            image.thumbnail((270,180),Image.Resampling.LANCZOS)
            x=230+lod*320
            canvas.paste(image,(x,y))
            count=next(r['triangles'] for r in stats if r['id']==asset and r['burned']==burned and r['lod']==lod)
            draw.text((x+3,y+155),f'{count} triangles',font=body,fill='white')
        y+=181
    canvas=canvas.crop((0,0,1200,y+35))
    ImageDraw.Draw(canvas).text((12,y+5),'Inspection fixture, fixed metres / lens. Runtime grade, wind, crop fade and HUD are not rendered here.',font=font(14),fill='#bcc6d7')
    canvas.save(REPORT/'compare.jpg',quality=86,optimize=True)
    shutil.copyfile(render/'camera.json',REPORT/'camera.json')
    print(f'Wrote {canvas.width} x {canvas.height}, {(REPORT/"compare.jpg").stat().st_size//1024} KiB')


if '--prepare' in sys.argv:
    prepare()
elif '--determinism' in sys.argv:
    determinism()
elif '--inputs' in sys.argv:
    inputs()
else:
    compose()
