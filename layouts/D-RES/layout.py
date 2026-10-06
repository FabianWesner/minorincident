"""Juniper Crescent: porch-lined residential street and its cul-de-sac."""
import bpy
import math
from sslib.layout import Layout
l = Layout('D-RES', 'Juniper Crescent')
from sslib.l1_dressing import prepare, dress
prepare(l, residential=True)
l.building('bld.house-a', -14, -14, 'safe-house-door', 'Your House')
l.building('bld.house-b', 0, -14, 'porch-door', 'Juniper House')
l.building('bld.house-c', 14, -14, 'backyard-gate', 'Cedar House')
l.building('bld.house-a', 14, 14, 'east-porch', 'Willow House')
l.manifest['prop.mailbox-blue']['world'] = {'solid': True}
# Front paths, low fences and mailboxes frame the porch without blocking its exit.
for x in [-14,0,14]:
    l.box('porch-path','sidewalk',[2,.1,4],[x,.05,-7])
    l.place('prop.mailbox-blue',[x+3,0,-5.25])
    for dx in [-4,-2,2,4]: l.place('prop.picket-fence',[x+dx,0,-8],scale=(.7,.7,.7))
    l.place('prop.hedge',[x-3,0,-6.3],scale=(.8,.8,.8))
# Spawn on the path in front of the survivor's own porch, away from the intersection.
l.data['anchors']['player-start']['position'] = [-14,0,-7]
l.anchor('objective', [5,0,-8])
dress(l, residential=True)
l.export()
