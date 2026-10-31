from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
root=Path('docs/reports/slim/merge');out=root/'sheets';out.mkdir(exist_ok=True)
views=['front','side','three-quarter']
for quality in ['high','low']:
 for zoom in [1.5,.5]:
  for tier in range(5):
   paths=[root/'crops'/f'{phase}-{quality}'/f'z{zoom}-t{tier}-{v}.jpg' for phase in ['main','slim','merged'] for v in views]
   if not all(p.exists() for p in paths):continue
   images=[Image.open(p).convert('RGB') for p in paths]
   factor=min(490/max(im.width for im in images),610/max(im.height for im in images))
   canvas=Image.new('RGB',(1500,2010),'#ddd');d=ImageDraw.Draw(canvas);d.text((12,8),f'Male courier | {quality} | game zoom {zoom} | gear tier {tier} | same pixel scale across rows',fill='black')
   for i,im in enumerate(images):
    row,col=divmod(i,3);im=im.resize((round(im.width*factor),round(im.height*factor)),Image.Resampling.LANCZOS)
    x=col*500+(500-im.width)//2;y=50+row*650+(610-im.height)//2;canvas.paste(im,(x,y));d.text((col*500+10,32+row*650),f'{["main", "slim before merge", "combined"][row]} | {views[col]}',fill='black')
   canvas.save(out/f'{quality}-z{zoom}-tier{tier}.jpg',quality=96)
for tier in range(5):
 paths=[root/'crops'/'merged-lod2-high'/f'z{zoom}-t{tier}-{v}.jpg' for zoom in [1.5,.5] for v in views]
 if not all(p.exists() for p in paths):continue
 images=[Image.open(p).convert('RGB') for p in paths];canvas=Image.new('RGB',(1500,1360),'#ddd');d=ImageDraw.Draw(canvas);d.text((12,8),f'Male courier | combined gear LOD2 | tier {tier}',fill='black')
 for i,im in enumerate(images):
  row,col=divmod(i,3);im=ImageOps.contain(im,(490,610));canvas.paste(im,(col*500+(500-im.width)//2,50+row*650+(610-im.height)//2));d.text((col*500+10,32+row*650),f'zoom {[1.5,.5][row]} | {views[col]}',fill='black')
 canvas.save(out/f'lod2-tier{tier}.jpg',quality=96)
print(len(list(out.glob('*.jpg'))),'review sheets')
for quality in ['high','low']:
 for tier in [0,1,3,4]:
  paths=[root/'crops'/f'{phase}-{quality}'/f'z0.5-t{tier}-{v}.jpg' for phase in ['main','slim','merged'] for v in views]
  if not all(p.exists() for p in paths):continue
  images=[]
  for p in paths:
   im=Image.open(p).convert('RGB');images.append(im.crop((round(im.width*.15),round(im.height*.34),round(im.width*.85),round(im.height*.68))))
  scale=min(640/max(im.width for im in images),520/max(im.height for im in images))
  canvas=Image.new('RGB',(1950,1750),'#ddd');d=ImageDraw.Draw(canvas);d.text((12,8),f'Torso detail | {quality} | game zoom 0.5 | gear {tier} | common scale',fill='black')
  for i,im in enumerate(images):
   row,col=divmod(i,3);im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);canvas.paste(im,(col*650+(650-im.width)//2,50+row*565+(520-im.height)//2));d.text((col*650+10,32+row*565),f'{["main", "slim before merge", "combined"][row]} | {views[col]}',fill='black')
  canvas.save(out/f'detail-{quality}-tier{tier}.jpg',quality=97)
for zoom in [1.5,.5]:
 for tier in range(5):
  paths=[root/'crops'/f'{phase}-lod2-high'/f'z{zoom}-t{tier}-{v}.jpg' for phase in ['main','slim','merged'] for v in views]
  if not all(p.exists() for p in paths):continue
  images=[Image.open(p).convert('RGB') for p in paths];scale=min(490/max(im.width for im in images),610/max(im.height for im in images))
  canvas=Image.new('RGB',(1500,2010),'#ddd');d=ImageDraw.Draw(canvas);d.text((12,8),f'LOD2 parents | game zoom {zoom} | gear {tier} | common pixel scale',fill='black')
  for i,im in enumerate(images):
   row,col=divmod(i,3);im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);canvas.paste(im,(col*500+(500-im.width)//2,50+row*650+(610-im.height)//2));d.text((col*500+10,32+row*650),f'{["main", "slim before merge", "combined"][row]} | {views[col]}',fill='black')
  canvas.save(out/f'lod2-parents-z{zoom}-tier{tier}.jpg',quality=96)
