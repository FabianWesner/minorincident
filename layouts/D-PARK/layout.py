"""Creekside Park: static layout. Gameplay tuning is in src/levels/districts/D-PARK.ts."""
from sslib.layout import Layout
l = Layout('D-PARK', 'Creekside Park')
l.building('bld.park-lodge', -14, -14, 'lodge-door', 'Creekside Lodge')
l.box('ball-diamond','sidewalk',[12,.08,12],[14,.02,-14])
for x,z in [(10,-10),(18,-10),(14,-18)]: l.box('base','picketWhite',[.65,.08,.65],[x,.09,z])
l.box('creek','backpackTeal',[20,.05,3],[14,.01,19])
l.box('footbridge','woodWarm',[3,.25,5],[14,.2,19])
for x in [-18,-12]: l.place('prop.picnic-table',[x,0,15])
l.place('prop.tent',[-20,0,20])
l.anchor('objective', [5,0,-8])
l.export()
