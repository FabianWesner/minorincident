"""Juniper Crescent: static layout. Gameplay tuning is in src/levels/districts/D-RES.ts."""
from sslib.layout import Layout
l = Layout('D-RES', 'Juniper Crescent')
l.building('bld.house-a', -14, -14, 'safe-house-door', 'Safe House')
l.building('bld.house-b', 14, -14, 'porch-door', 'Juniper House')
l.building('bld.house-c', -14, 14, 'backyard-gate', 'Cedar House')
l.building('bld.house-a', 14, 14, 'east-porch', 'Willow House')
for x in [-18,-16,-14,-12,-10]: l.place('prop.picket-fence',[x,0,9])
l.box('backyard-deck','woodWarm',[7,.12,3],[-14,.04,20])
l.anchor('objective', [5,0,-8])
l.export()
