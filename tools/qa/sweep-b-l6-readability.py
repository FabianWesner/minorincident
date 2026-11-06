"""Evaluate lossless source-bound masks; close only the measured eye counterexample."""
from pathlib import Path
import gzip,hashlib,json,subprocess
import numpy as np
from PIL import Image,ImageFilter
root=Path('docs/reports/sweep-b');base=Path('test-results/sweep-b');sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
read=lambda p:np.asarray(Image.open(p).convert('RGB'))
def linear_luminance(rgb):
    a=rgb.astype(float)/255
    a=np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
    return (a*np.array([.2126,.7152,.0722])).sum(2)
def analyze(folder):
    path=base/folder;data=json.loads((path/'ledger.json').read_text())
    assert not data['errors'] and not data['state']['god'];assert data['state']['tier']==data['state']['renderTier']
    assert data['state']['flashlight'] and data['state']['emergency'] and not data['state']['mainPower']
    for c in data['captures']:assert sha(c['file'])==c['sha256']
    img=lambda name:read(path/f'captures/{name}.png')
    native=img('native');black=img('actor-black').astype(int)
    body=(img('actor-body').astype(int).sum(2)-black.sum(2))>10
    eyes=(img('actor-eyes').astype(int).sum(2)-black.sum(2))>10
    courier=img('courier-id');courier=(courier[:,:,0]>150)&(courier[:,:,1]<70)&(courier[:,:,2]>150)
    lum=linear_luminance(native);ring=[];ring_samples=[]
    for q in data['state']['ring']:
        x=round(q['screen']['x']);y=round(q['screen']['y']);patch=lum[y-3:y+4,x-3:x+4];keep=~(courier|body)[y-3:y+4,x-3:x+4]
        if patch.shape!=(7,7)or keep.sum()<25:continue
        ring.extend(patch[keep].tolist());ring_samples.append({'world':q['world'],'screen':q['screen'],'pixels':int(keep.sum()),'median':float(np.median(patch[keep]))})
    assert courier.sum()>100 and len(ring_samples)>32
    c90=float(np.percentile(lum[courier],90));bg=float(np.median(ring))
    result={'tier':data['state']['tier'],'spot':data['state']['spot'],'actor':data['state']['enemy']['id'],'model':data['state']['enemy']['appearance']['asset'],'bodyMaskPixels':int(body.sum()),'eyeMaskPixels':int(eyes.sum()),'courierMaskPixels':int(courier.sum()),'bodyP90':c90,'ringMedian':bg,'contrast02':(c90+.02)/(bg+.02),'contrast05':(c90+.05)/(bg+.05),'ringSamples':ring_samples,'sourceHash':data['sourceHash'],'captures':data['captures']}
    if eyes.sum() and body.sum()>100:
        assert not (eyes&~body).any(), 'eye pixels must belong to the actual actor body'
        dilated=np.asarray(Image.fromarray((eyes*255).astype('uint8')).filter(ImageFilter.MaxFilter(5)))>0
        non_eye=body&~dilated
        y,x=np.unravel_index(np.argmax(np.where(non_eye,lum,-1)),lum.shape)
        eye_max=float(lum[eyes].max());body_max=float(lum[y,x]);yy,xx=np.where(eyes)
        result.update(eyeMax=eye_max,bodyNonEyeMax=body_max,eyesBrightest=eye_max>=body_max,brightBodyPixel={'x':int(x),'y':int(y),'rgb':native[y,x].tolist(),'luminance':body_max,'nearestEyeDistancePixels':float(np.min(np.hypot(xx-x,yy-y)))},eyePixels=[{'x':int(ex),'y':int(ey),'rgb':native[ey,ex].tolist(),'luminance':float(lum[ey,ex])}for ey,ex in zip(yy,xx)])
        if (path/'captures/native-repeat.png').exists():
            repeat=img('native-repeat');changed=int(np.any(native[body]!=repeat[body],axis=1).sum());assert changed==0
            result['repeatedNativeBodyChangedPixels']=changed
    else:result['eyeVerdict']='NOT CHECKED: body/head occluded; no missing-eye failure inferred'
    archive=root/f'{folder}-ledger.json.gz';archive.write_bytes(gzip.compress((path/'ledger.json').read_bytes(),mtime=0));result['ledger']=str(archive);result['ledgerSha256']=sha(archive)
    return result
folders=['L6-readability-low-tunnel','L6-readability-low-shelter','L6-readability-low-tunnel-62','L6-readability-low-tunnel-62-repeat','L6-readability-high-tunnel-62-repeat']
values=[analyze(f)for f in folders]
controls={'actualFirstRunnerPasses':values[0]['eyesBrightest'],'occludedShelterActorNotFailed':values[1]['eyeVerdict'].startswith('NOT CHECKED'),'elderlyDiscoveryFails':not values[2]['eyesBrightest'],'bothRepeatedTiersFail':all(not r['eyesBrightest'] and r['repeatedNativeBodyChangedPixels']==0 for r in values[-2:])};assert all(controls.values())
final=values[-2:];assert all(r['brightBodyPixel']['nearestEyeDistancePixels']>3 for r in final)
note='Both actual low/high render tiers: authored l6-tunnel-retreat at110/15, production second-breach emergency state and actually collected headlamp. Original first-breach actor62 (npc.civilian-elderly) has ten resolved eye pixels; maximum eye relative luminance is0.24487004 low /0.23464440 high, below forehead pixel(772,384), RGB175/125/98, luminance0.24663033 at both tiers. The forehead is0.719% brighter at low and5.108% brighter at high. This strict numeric counterexample is not a large subjective visibility failure. Forehead is9.055px from the closest eye, beyond a2px excluded eye-edge margin. Every masked body pixel is bitwise identical in an independent repeated native PNG after restoring all probe materials at both tiers. Courier-maskP90 against actual2m ground ring exceeds3:1 (both .02 and .05 offsets reported). A different actual runner57 passes the eye comparison; the occluded shelter actor is explicitly inconclusive. Production instance-slot masks preserve source pose/mask nodes and keep other geometry depth-tested. Earlier infectedIdPass omitted NPC-skinned actors and was rejected, not repaired in game source. The measured forehead counterexample closes FAIL; all other looks/poses, the full shelter eye clause and a full route are not promoted to PASS.'
proof=root/'L6-14-proof.json';proof.write_text(json.dumps({'row':'L6-14','status':'FAIL','sourceHash':final[0]['sourceHash'],'producerSha256':sha(__file__),'observation':note,'method':'Linear sRGB luminance .2126R+.7152G+.0722B; body/eyes are actual per-instance GPU mask differences over black. Exclude a2px eye-mask dilation from non-eye maximum. CourierP90 uses production magenta ID; background pools eligible7x7 patches at64 projected worldXZ points exactly2m from courier feet. Captures are original1280x720 PNGs; no downsampled-sheet pixels used.','controls':controls,'rows':final,'diagnostics':values[:-2]},indent=2)+'\n')
sheets=[base/'L6-readability-discovery-sheet.jpg',base/'L6-readability-final-sheet.jpg',base/'L6-readability-eye-closeups.png']
review=root/'L6-readability-capture-review.json';review.write_text(json.dumps({'reviewer':'Codex/sweep-b','date':'2026-11-06','images':32,'sheets':[{'file':str(p),'sha256':sha(p)}for p in sheets],'observation':'All18 discovery and14 repeat captures inspected. Tunnel native views show a bright courier and visible infected; courier-ID/hidden passes match the silhouette. Actual runner57 body and eyes resolve. Shelter selected actor is largely hidden with only a hand patch and zero eye mask: no false eye failure. Elderly62 native closeups show red eyes below a brighter tan forehead; both eye islands and full body are separately identified by masks. Low/high native-repeat views are visually stable and every body pixel matches numerically. All masks retain world/HUD background, which is excluded by differential masks; scene lamps and the courier are never compared as part of the infected body.','values':values,'cleanup':'All32 raw PNGs deleted after digest verification, quantitative analysis and visual inspection. Diagnostic22 earlier PNGs are covered by their separate reviews; sheets remain ignored.'},indent=2)+'\n')
report=json.loads(Path('docs/reports/fix51-verify/L6.json').read_text());criterion=next(r['expected']for r in report['rows']if r['id']=='L6-14')
evidence=[proof,review,*[Path(v['ledger'])for v in final]]
Path('docs/qa/reviews/L6-14.json').write_text(json.dumps({'row':'L6-14','status':'FAIL','reviewer':'Codex/sweep-b','date':'2026-11-06','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':criterion,'verdict':'FAIL','note':note}],'evidence':[{'file':str(p),'sha256':sha(p),'what':note}for p in evidence]},indent=2)+'\n')
for v in values:
 for c in v['captures']:Path(c['file']).unlink()
print([(r['tier'],r['contrast02'],r['eyeMax'],r['bodyNonEyeMax'])for r in final])
