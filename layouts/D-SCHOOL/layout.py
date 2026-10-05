"""Sunset Grove Elementary: static layout. Gameplay tuning is in src/levels/districts/D-SCHOOL.ts."""
from sslib.layout import Layout
l = Layout('D-SCHOOL', 'Sunset Grove Elementary')
l.building('bld.school', -14, -14, 'school-entrance', 'Sunset Grove Elementary')
l.building('bld.gym', 14, -14, 'gym-door', 'Sunset Grove Gym')
l.box('playground','sidewalk',[16,.08,13],[-14,.01,15])
for x in [-18,-10]:
    l.box('swing-upright','policeBlue',[.25,3,.25],[x,1.5,15])
l.box('swing-beam','schoolBusYellow',[8.4,.3,.3],[-14,3,15])
l.box('slide','survivorRed',[2,.25,5],[-14,1.1,17])
l.box('basketball-court','backpackTeal',[14,.06,14],[15,.025,15])
l.anchor('objective', [5,0,-8])
l.export()
