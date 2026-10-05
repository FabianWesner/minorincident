"""Sunset Grove Zoo: static layout. Gameplay tuning is in src/levels/districts/D-ZOO.ts."""
from sslib.layout import Layout
l = Layout('D-ZOO', 'Sunset Grove Zoo')
l.building('bld.zoo-gate', -14, -14, 'zoo-entrance', 'Sunset Grove Zoo')
l.building('bld.reptile-house', 14, -14, 'reptile-door', 'Reptile House')
for cx in [-14,14]:
    for x in range(-5,6,2): l.place('prop.picket-fence',[cx+x,0,9])
    l.box('enclosure-rock','woodWarm',[3,1.5,2],[cx, .75,15])
l.box('flamingo-pond','backpackTeal',[8,.08,5],[-14,.03,19])
l.anchor('objective', [5,0,-8])
l.data['walkable']['excluded'] = [[[-18, 16.5], [-10, 16.5], [-10, 21.5], [-18, 21.5], [-18, 16.5]]]
l.export()
