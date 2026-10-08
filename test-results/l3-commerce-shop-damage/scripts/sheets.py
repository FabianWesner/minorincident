from PIL import Image,ImageDraw
from pathlib import Path
import json
base=Path('test-results/l3-commerce-shop-damage');overview=Image.new('RGB',(1200,8*240),'#292631')
ids=['bld.mainstreet-brick.w2','bld.mainstreet-brick.w3','bld.joes-diner.w2','bld.joes-diner.w3','bld.maple-hardware.w2','bld.maple-hardware.w3','decay.burned-facade.brick','decay.burned-facade.diner']
for row,id in enumerate(ids):
 d=base/id;sheet=Image.new('RGB',(1200,240),'#292631');sd=ImageDraw.Draw(sheet);sd.text((8,6),id+' | FOV25, azimuth45, polar0.30pi | game-sized model views',fill='white')
 ref=Image.open(Path('/Users/wesner/Workspace/minorincident/assets')/id/'reference-upscaled.png').convert('RGB');ref.thumbnail((475,205));sheet.paste(ref,((480-ref.width)//2,30+(205-ref.height)//2))
 sd.text((8,24),'REFERENCE',fill='white');infos=json.loads((d/'game-camera.json').read_text())['views']
 for col,q in enumerate(['high','lod1','lod2']):
  im=Image.open(d/('game-'+q+'.png')).convert('RGB');sheet.paste(im,(480+col*240,48));info=infos[col];sd.text((488+col*240,30),f'LOD{col} | {info["pixelWidth"]} x {info["pixelHeight"]} px',fill='white')
 sheet.save(d/'game-camera.png');overview.paste(sheet,(0,row*240))
overview.save(base/'game-camera-overview.png')
