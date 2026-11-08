"""Evaluate lossless source-bound masks; close only the measured eye counterexample."""
from pathlib import Path
import gzip,hashlib,json,subprocess
import numpy as np
from PIL import Image,ImageFilter
root=Path('docs/reports/l6-visual/readability');root.mkdir(parents=True,exist_ok=True);base=Path('test-results/l6-visual/readability-final');sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
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
    result={'backend':data['backend'],'zoom':data['zoom'],'tier':data['state']['tier'],'spot':data['state']['spot'],'actor':data['state']['enemy']['id'],'model':data['state']['enemy']['appearance']['asset'],'bodyMaskPixels':int(body.sum()),'eyeMaskPixels':int(eyes.sum()),'courierMaskPixels':int(courier.sum()),'bodyP90':c90,'ringMedian':bg,'contrast02':(c90+.02)/(bg+.02),'contrast05':(c90+.05)/(bg+.05),'ringSamples':ring_samples,'sourceHash':data['sourceHash'],'captures':data['captures']}
    if eyes.sum() and body.sum()>100:
        assert not (eyes&~body).any(), 'eye pixels must belong to the actual actor body'
        dilated=np.asarray(Image.fromarray((eyes*255).astype('uint8')).filter(ImageFilter.MaxFilter(5)))>0
        full_body=img('actor-body').min(2)>=240
        non_eye=full_body&~dilated
        result['fullCoverageBodyPixels']=int(full_body.sum())
        result['partialCoveragePixels']=int((body&~full_body).sum())
        result['maskRule']='Non-eye luminance uses white-mask RGB channels >=240 (full coverage); partially covered silhouette pixels mix the warm floor into native RGB. Eye support uses the full positive differential mask, a conservative eye maximum.'
        y,x=np.unravel_index(np.argmax(np.where(non_eye,lum,-1)),lum.shape)
        eye_max=float(lum[eyes].max());body_max=float(lum[y,x]);yy,xx=np.where(eyes)
        result.update(eyeMax=eye_max,bodyNonEyeMax=body_max,eyesBrightest=eye_max>=body_max,brightBodyPixel={'x':int(x),'y':int(y),'rgb':native[y,x].tolist(),'luminance':body_max,'nearestEyeDistancePixels':float(np.min(np.hypot(xx-x,yy-y)))},eyePixels=[{'x':int(ex),'y':int(ey),'rgb':native[ey,ex].tolist(),'luminance':float(lum[ey,ex])}for ey,ex in zip(yy,xx)])
        if (path/'captures/native-repeat.png').exists():
            repeat=img('native-repeat');changed=int(np.any(native[body]!=repeat[body],axis=1).sum());assert changed==0
            result['repeatedNativeBodyChangedPixels']=changed
    else:result['eyeVerdict']='NOT CHECKED: body/head occluded; no missing-eye failure inferred'
    archive=root/f'{folder}-ledger.json.gz';archive.write_bytes(gzip.compress((path/'ledger.json').read_bytes(),mtime=0));result['ledger']=str(archive);result['ledgerSha256']=sha(archive)
    return result

values=[analyze(p.name) for p in sorted(base.iterdir()) if (p/'ledger.json').exists()]
assert len(values)==16, 'Both backends/tiers/zooms/spots are required'
assert len({(v['backend'],v['tier'],v['zoom'],v['spot']) for v in values})==16
assert all(v['contrast05']>=3 and v.get('eyesBrightest') is True and v.get('repeatedNativeBodyChangedPixels')==0 for v in values)
Path('docs/reports/l6-visual/readability-analysis.json').write_text(json.dumps({'method':'Actual source-bound differential masks and same-pose native repeats. Full-coverage white body mask excludes background-contaminated antialias edges; positive eye masks remain depth tested. Courier P90 versus64-sample ground-ring median, reporting both .02 and .05 offsets.', 'rows':values},indent=2)+'\n')
for v in values:print(v['backend'],v['tier'],v['zoom'],v['spot'],v['contrast05'],v.get('eyeMaskPixels'),v.get('eyeMax'),v.get('bodyNonEyeMax'),v.get('eyesBrightest'),v.get('eyeVerdict'))
