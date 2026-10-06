"""Juniper Crescent: porch-lined residential street and its cul-de-sac."""
import bpy
import math
from sslib.layout import Layout
l = Layout('D-RES', 'Juniper Crescent')
# Replace the shared intersection template only in this residential district.
for o in list(l.layers[0]):
    if o.name.startswith(('road-', 'curb', 'lane-mark', 'crosswalk', 'collapse-canopy')):
        l.layers[0].remove(o)
        bpy.data.objects.remove(o, do_unlink=True)
l.data['surfaces'] = [s for s in l.data['surfaces'] if s['surface'] != 'asphalt']
l.box('crescent-street', 'asphalt', [49,.08,7], [3.5,.01,0])
for z in [-4.25,4.25]: l.box('crescent-sidewalk','sidewalk',[49,.18,1.5],[3.5,.04,z])
l.box('turnaround', 'asphalt', [10,.08,11], [-20,.01,0])
l.data['roads'] = dict(nodes=[dict(id='west',point=[-20,0]),dict(id='east',point=[28,0])],edges=[dict(id='crescent',start='west',end='east',points=[[-20,0],[28,0]],laneWidth=7)])
l.data['surfaces'].append(dict(surface='asphalt',polygon=[[-25,-5.5],[28,-5.5],[28,5.5],[-25,5.5],[-25,-5.5]]))
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
l.export()
