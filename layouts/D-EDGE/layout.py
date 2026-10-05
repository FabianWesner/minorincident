"""Rail and River Edge: static layout. Gameplay tuning is in src/levels/districts/D-EDGE.ts."""
from sslib.layout import Layout
l = Layout('D-EDGE', 'Rail and River Edge')
l.building('bld.substation', -14, -14, 'substation-door', 'Grove Power')
l.box('river','backpackTeal',[20,.04,8],[15,.01,-16])
l.box('river-bridge','sidewalk',[8,.3,10],[15,.15,-16])
for z in [16,18]: l.box('rail','uiDark',[56,.12,.14],[0,.1,z])
for x in range(-26,27,2): l.box('tie','woodWarm',[.3,.1,3],[x,.03,17])
l.box('helipad','asphalt',[14,.06,14],[-14,.02,15])
for x in [-16,-12]: l.box('pad-H','picketWhite',[.4,.02,5],[x,.08,15])
l.box('pad-H-cross','picketWhite',[4,.02,.4],[-14,.08,15])
l.anchor('objective', [5,0,-8])
l.export()
