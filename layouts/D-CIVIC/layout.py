"""Sunset Grove Civic Center: static layout. Gameplay tuning is in src/levels/districts/D-CIVIC.ts."""
from sslib.layout import Layout
l = Layout('D-CIVIC', 'Sunset Grove Civic Center')
l.building('bld.police', -14, -14, 'checkpoint-door', 'Grove Police')
l.building('bld.fire-station', 14, -14, 'station-door', 'Grove Fire Station')
l.building('bld.hospital', -14, 14, 'hospital-door', 'Grove Hospital')
for x in [12,18]: l.place('prop.tent',[x,0,16])
for x in [-3,3]: l.place('prop.traffic-cone',[x,0,12],tier=2,allowed=True)
l.box('checkpoint-barrier','picketWhite',[5,.7,.4],[0,.35,17],2)
l.anchor('objective', [5,0,-8])
l.export()
