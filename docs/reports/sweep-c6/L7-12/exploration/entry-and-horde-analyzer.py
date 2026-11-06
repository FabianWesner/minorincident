"""Source-bound courier ID-mask luminance versus its actual projected 2 m ring."""
import gzip,hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image
root=Path('docs/reports/sweep-c6/L7-12')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def rgb(p):return np.asarray(Image.open(p).convert('RGB'))
def luminance(a):
 a=a.astype(float)/255;a=np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
 return (a*np.array([.2126,.7152,.0722])).sum(2)
rows=[]
for tier in ['low','high']:
 p=root/f'{tier}-physical.json.gz'
 if not p.exists():continue
 a=json.loads(gzip.decompress(p.read_bytes()));assert not a['errors'];assert a['setup']['driverDetached'];assert a['result']['inputs']
 assert all(f['tick']==i and not f['nativeDriver'] for i,f in enumerate(a['result']['inputs']))
 assert a['result']['tick']==len(a['result']['inputs'])
 for cell in a['cells']:
  assert cell['state']['quality']==tier and cell['state']['backend']=='webgl';assert cell['afterTick']==cell['state']['tick'];assert abs(cell['state']['camera']['zoom']-cell['zoom'])<1e-8
  for kind in ['normal','hidden','mask']:assert sha(cell[kind]['file'])==cell[kind]['sha256']
  normal=rgb(cell['normal']['file']);hidden=rgb(cell['hidden']['file']);mask=rgb(cell['mask']['file']);assert normal.shape==hidden.shape==mask.shape
  body=(mask[:,:,0]>200)&(mask[:,:,1]<60)&(mask[:,:,2]>200)
  y,x=np.where(body);assert len(x)>100
  l=luminance(normal);ring=[];samples=[]
  for q in cell['state']['ring']:
   px=round(q['screen']['x']);py=round(q['screen']['y']);patch=l[py-3:py+4,px-3:px+4];keep=~body[py-3:py+4,px-3:px+4]
   if patch.shape!=(7,7)or keep.sum()<25:continue
   ring.extend(patch[keep].tolist());samples.append({'world':q['world'],'screen':q['screen'],'pixels':int(keep.sum()),'median':float(np.median(patch[keep]))})
  assert len(samples)>=32
  foreground=float(np.percentile(l[body],90));background=float(np.median(ring));r02=(max(foreground,background)+.02)/(min(foreground,background)+.02);r05=(max(foreground,background)+.05)/(min(foreground,background)+.05)
  rows.append({'tier':tier,'label':cell['label'],'zoom':cell['zoom'],'tick':cell['state']['tick'],'sourceHash':a['sourceHash'],'courierMaskPixels':int(body.sum()),'courierMaskBounds':[int(x.min()),int(y.min()),int(x.max()),int(y.max())],'courierP90':foreground,'ringMedian':background,'contrast02':r02,'contrast05':r05,'bothBelow3':r02<3 and r05<3,'ringSamples':samples,'nearbyInfected':cell['state']['nearbyInfected'],'alphas':cell['state']['alphas'],'captures':{k:cell[k]for k in ['normal','hidden','mask']}})
result={'method':'Actual physical progressed-save L7 samples. Same-tick lossless presented canvas and production-depth magenta courier ID mask select actual body/gear pixels, excluding shadows and non-body world geometry. Linear sRGB relative luminance(.2126R+.7152G+.0722B):courierP90 versus median eligible7x7 native-image patches on64 projected world XZ points exactly2m from feet, excluding courier-ID pixels. Require≥100bodypixels and≥32ring patches. Both viewing-flare .02 and WCAG .05 offsets retained; a counterexample is declared only when both<3. Hidden-courier redraw is an inspection/control frame and does not replace native ring lighting. No downsampled-sheet pixels, auto brightness, or lit-floor exemption.','producerSha256':sha(__file__),'rows':rows}
(root/'contrast-proof.json').write_text(json.dumps(result,indent=2)+'\n')
print([(r['tier'],r['label'],r['zoom'],round(r['contrast02'],3),round(r['contrast05'],3),r['nearbyInfected'])for r in rows])
