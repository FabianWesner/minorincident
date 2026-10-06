"""Maple Main Street: static layout. Gameplay tuning is in src/levels/districts/D-MAIN.ts."""
from sslib.layout import Layout
l = Layout('D-MAIN', 'Maple Main Street')
l.building('bld.joes-diner', -14, -14, 'diner-door', 'Joe’s Diner')
l.building('bld.maple-hardware', 14, -14, 'hardware-display', 'Maple Hardware')
l.building('bld.gas-station', -14, 14, 'fuel-shop-door', 'Sunset Fuel')
l.place('prop.bus-stop',[15,0,7])
for x in [-18,-14,-10]: l.place('prop.gas-pump',[x,0,8])
l.box('fuel-forecourt','sidewalk',[13,.07,11],[-14,.02,14])
l.anchor('objective', [5,0,-8])
l.export()
