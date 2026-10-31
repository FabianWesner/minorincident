"""Check exhaustive player capture coverage and the existing attachment limit."""
import itertools, json
from pathlib import Path
from PIL import Image
root=Path('docs/reports/slim/merge')
rows=json.loads((root/'capture.json').read_text())['rows']
expected={(phase,quality,zoom,tier,view) for phase,quality,zoom,tier,view in itertools.product(['main','slim','merged','merged-lod2','main-lod2','slim-lod2'],['high','low'],[1.5,.5],range(5),['front','side','three-quarter']) if not (phase.endswith('-lod2') and quality=='low')}
actual={(r['phase'],r['quality'],r['zoom'],r['tier'],r['view']) for r in rows}
assert actual==expected and len(rows)==len(expected)==270
summary=[]
for r in rows:
 p=root/'crops'/f"{r['phase']}-{r['quality']}"/f"z{r['zoom']}-t{r['tier']}-{r['view']}.jpg"
 with Image.open(p) as im:
  assert im.width>0 and im.height>0
  width,height=im.size
 assert r['ambientLifeOmitted']
 gap=r['metrics']['courierAttachments']['gapMaxCm']
 if r['phase'].startswith('merged'):assert gap<=2, (p,gap)
 summary.append({'image':str(p.relative_to(root)),'phase':r['phase'],'quality':r['quality'],'zoom':r['zoom'],'tier':r['tier'],'view':r['view'],'width':width,'height':height,'attachmentGapMaxCm':gap})
result={'pass':True,'captures':len(rows),'comparativeSheets':30,'lod2Sheets':5,'detailSheets':8,'productionAttachmentLimitCm':2,'combinedAttachmentMaxCm':max(r['attachmentGapMaxCm'] for r in summary if r['phase'].startswith('merged')),'rows':summary}
(root/'coverage.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS:',len(rows),'captures, all expected tiers/views/zooms/qualities, combined attachments <=2 cm')
