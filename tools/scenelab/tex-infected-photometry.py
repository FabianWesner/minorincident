"""Gate both eye cores and whole-figure presented luminance against pinned main."""
from pathlib import Path
import json
from PIL import Image
import numpy as np
report = Path('test-results/tex-infected')
raw = Path('/private/tmp/tex-infected-readability')
main = json.loads((report/'main-readability.json').read_text())
after = json.loads((report/'after-readability.json').read_text())
rows = []
for candidate in after:
    if candidate['framing'] not in ['z1', 'z1.5', 'close']:
        continue
    before = next(r for r in main if all(r[k] == candidate[k] for k in ['backend', 'tier', 'framing']))
    ratio = candidate['figureLuminance']/before['figureLuminance']
    eyes = []
    for i, core in enumerate(candidate['eyeCores']):
        reference = before['eyeCores'][i]
        brightness = core['peakLuminance']/reference['peakLuminance']
        coverage = core['redPixels']/reference['redPixels']
        eyes.append({'peakLuminanceBefore': reference['peakLuminance'], 'peakLuminanceAfter': core['peakLuminance'],
            'brightnessRatio': brightness, 'redPixelsBefore': reference['redPixels'], 'redPixelsAfter': core['redPixels'],
            'coverageRatio': coverage, 'passed': brightness >= .9 and coverage >= .6 and core['redPixels'] >= 4})
    colors = {}
    for variant in ['main', 'after']:
        prefix = raw/f"{variant}-{candidate['backend']}-{candidate['tier']}-{candidate['framing']}"
        image = np.asarray(Image.open(str(prefix)+'.png').convert('RGB'), dtype=float)/255
        mask = np.asarray(Image.open(str(prefix)+'-mask.png').convert('RGB'))
        pixels = image[(mask[:,:,0]>180)&(mask[:,:,1]<60)&(mask[:,:,2]>180)]
        high = pixels.max(1); low = pixels.min(1)
        saturation = (high-low)/np.maximum(high, 1e-9)
        colors[variant] = {'meanSRGB': (pixels.mean(0)*255).tolist(), 'meanHSVSaturation': float(saturation.mean())}
    rows.append({k:candidate[k] for k in ['backend','tier','framing','heightPx']} | {
        'figureLuminanceBefore':before['figureLuminance'],'figureLuminanceAfter':candidate['figureLuminance'],
        'figureRatio':ratio,'eyes':eyes,'color':colors,
        'passed':len(eyes)==2 and all(e['passed'] for e in eyes) and .9<=ratio<=1.1 and (candidate['framing']!='close' or candidate['heightPx']>=150)})
result = {'method':'Displayed sRGB PNG, inverse IEC sRGB transfer, Rec.709 Y. Production depth/pose-preserving magenta silhouette excludes contact-shadow quad. Eye rectangles projected from head-owned emitter geometry; count bright red pixels (R>=180 and R-max(G,B)>=45), report peak Y. No post-capture colour adjustment.',
          'thresholds':{'figureRatio':[.9,1.1],'eyePeakRatioMin':.9,'eyeCoverageRatioMin':.6,'eyeCorePixelsMin':4,'closeHeightMin':150},
          'allGreen':len(rows)==12 and all(r['passed'] for r in rows),'rows':rows}
(report/'photometry.json').write_text(json.dumps(result,indent=2)+'\n')
for r in rows:
    print(r['backend'],r['tier'],r['framing'],round(r['figureRatio'],3),[(round(e['brightnessRatio'],2),round(e['coverageRatio'],2)) for e in r['eyes']],r['passed'])
if not result['allGreen']:
    raise SystemExit('Readability photometry gate failed')
