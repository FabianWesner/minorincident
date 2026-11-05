"""Small civic buildings in the existing house/street-frontage palette and style.

Closed roof volumes, recessed framed glazing and structural timber/brick trim
are authored at all three distances. Fine siding and roof seams disappear first.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from .rescue_assets import Scene
from . import export, sockets, ao, colliders


def pitched(s, name, cx, cy, width, depth, eave, ridge, token, parent):
    # A closed gable prism, with +X-facing end walls.
    vs = [(x, y, z) for x in (cx-width/2, cx+width/2)
          for y, z in ((cy-depth/2, eave), (cy, ridge), (cy+depth/2, eave))]
    ob = s.mesh(name, vs, [(1, 2, 0), (5, 4, 3), (3, 4, 1, 0),
                          (4, 5, 2, 1), (5, 3, 0, 2)], token)
    ob.parent = parent
    return ob


def window(s, x, y, z, width=1.15, height=1.25, side=1, axis='x'):
    # Full solid frame plus inset contrasting glass; mullions remain at LOD2.
    def panel(name, outward, w, h, thickness, token):
        pos = (x+outward*side, y, z) if axis == 'x' else (x, y+outward*side, z)
        size = (thickness, w, h) if axis == 'x' else (w, thickness, h)
        s.box(name, pos, size, token)
    panel('windowCasing', .035, width+.20, height+.20, .13, 'picketWhite')
    panel('windowRecess', .108, width, height, .035, 'uiDark')
    panel('windowGlass', .131, width-.10, height-.10, .025, 'backpackTeal')
    panel('windowMullion', .153, .055, height-.10, .035, 'picketWhite')
    if s.lod < 2:
        panel('windowTransom', .156, width-.10, .055, .035, 'picketWhite')
    sillpos = (x+.12*side,y,z-height/2-.13) if axis=='x' else (x,y+.12*side,z-height/2-.13)
    s.box('windowSill', sillpos, (.26,width+.32,.10) if axis=='x' else (width+.32,.26,.10), 'picketWhite')


def door(s, x, y, width=1.1, side=1):
    s.box('entryCasing',(x,y,1.30),(.18,width+.26,2.50),'picketWhite')
    s.box('entryLeaf',(x+.11*side,y,1.25),(.08,width,2.30),'woodWarm')
    s.box('entryGlass',(x+.16*side,y,1.72),(.035,width-.25,.95),'backpackTeal')
    s.box('entryRail',(x+.19*side,y,1.2),(.045,width,.10),'picketWhite')
    if s.lod < 2:
        s.box('doorHandle',(x+.22*side,y+width*.32,.99),(.08,.055,.23),'picketWhite')


def lodge(s):
    roof=s.joint('roof')
    s.box('stonePlinth',(0,0,.12),(8,7,.24),'sidewalk')
    s.box('timberHall',(-.40,0,1.47),(6.65,6.25,2.65),'woodWarm')
    pitched(s,'gableRoof',-.2,0,7.6,6.85,2.80,4,'asphalt',roof)
    # The veranda's load-bearing columns, beams and real treads match the house kit.
    s.box('porchDeck',(3.05,0,.27),(1.75,6.4,.18),'woodWarm')
    s.box('porchStep',(3.68,0,.11),(.64,2.05,.22),'sidewalk')
    s.box('porchCanopy',(3.12,0,2.64),(1.65,6.75,.17),'asphalt',roof,angle=0)
    for y in (-2.9,2.9):
        s.box('porchColumn',(3.66,y,1.42),(.22,.22,2.36),'picketWhite')
        s.beam('porchBrace',(3.66,y,2.12),(3.66,y-side_sign(y)*.52,2.56),.12,'woodWarm')
    s.box('verandaBeam',(3.66,0,2.53),(.24,6.18,.22),'picketWhite')
    door(s,2.98,0)
    for y in (-2,2): window(s,2.94,y,1.64,.95,1.18)
    for y in (-1.9,1.9): window(s,-3.73,y,1.58,1.1,1.15,-1)
    for y,side in ((-3.13,-1),(3.13,1)):
        for x in (-2.2,.4): window(s,x,y,1.6,1.15,1.2,side,'y')
        s.box('eaveFascia',(-.2,y*1.085,2.79),(7.58,.12,.18),'picketWhite')
    for x in (-3.7,2.85):
        for y in (-3.1,3.1): s.box('cornerTimber',(x,y,1.5),(.16,.16,2.65),'picketWhite')
    for z in (.45,2.7):
        for y in (-3.15,3.15): s.box('wallCourse',(-.40,y,z),(6.65,.10,.12),'woodWarm')
    s.box('chimney',(-2.1,1.1,3.26),(.65,.62,1.23),'brick')
    s.box('chimneyCap',(-2.1,1.1,3.9),(.78,.75,.14),'sidewalk')
    s.box('lodgeSign',(3.05,0,2.58),(.12,1.7,.28),'woodWarm')
    if s.lod == 0:
        for z in [ .6+i*.22 for i in range(9) ]:
            for y in (-3.145,3.145): s.box('siding',(-.4,y,z),(6.6,.025,.025),'picketWhite')
        for x in [-3.7+i*.42 for i in range(18)]:
            for side in (-1,1): s.beam('roofSeam',(x,side*.06,3.99),(x,side*3.4,2.81),.022,'uiDark')
    return s


def side_sign(y):
    return 1 if y>0 else -1


def reptile(s):
    roof=s.joint('roof')
    s.box('foundation',(0,0,.14),(10,8,.28),'sidewalk')
    s.box('exhibitHall',(0,0,1.65),(9.5,7.5,3.0),'picketWhite')
    for y in (-3.78,3.78):
        s.box('tealBase',(0,y,.6),(9.55,.14,.55),'backpackTeal')
        s.box('cornice',(0,y,3.07),(9.68,.17,.22),'woodWarm')
        for x in (-3.2,0,3.2): window(s,x,y,2.03,1.50,1.40,side_sign(y),'y')
    for x,side in ((-4.76,-1),(4.76,1)):
        for y in (-2.5,2.5): window(s,x,y,2.04,1.34,1.40,side)
        for y in (-3.5,3.5): s.box('pier',(x,y,1.68),(.24,.30,3.08),'woodWarm')
    door(s,4.79,0,1.45)
    pitched(s,'lowRoof',0,0,9.9,7.9,3.18,3.56,'asphalt',roof)
    # Raised greenhouse monitor: substantial end walls, glazing and roof ribs.
    s.box('monitorBase',(-.35,0,3.58),(6.8,2.8,.20),'woodWarm')
    pitched(s,'monitor',-.35,0,6.8,2.8,3.68,4,'backpackTeal',s.body)
    for x in (-3.68,-2,-.35,1.3,2.98):
        for side in (-1,1): s.beam('monitorRib',(x,side*1.4,3.68),(x,0,4),.08,'picketWhite')
    for y in (-1.4,1.4): s.box('monitorRail',(-.35,y,3.7),(6.84,.12,.10),'picketWhite',roof)
    s.box('entryAwning',(4.42,0,2.75),(1.12,2.15,.18),'backpackTeal')
    s.box('reptileSign',(4.89,0,3.0),(.09,1.70,.38),'woodWarm')
    if s.lod<2:
        # A small sculpted reptile emblem on the entrance sign.
        for y in (-.46,0,.46): s.tube('geckoBody',(4.955,y,3.01),.11,.045,'schoolBusYellow',rotation=(0,math.pi/2,0))
        for y in (-.28,.28):
            for z in (2.88,3.14): s.box('geckoFoot',(4.95,y,z),(.05,.16,.06),'schoolBusYellow')
    return s


def zoo(s):
    roof=s.joint('roof')
    s.box('ticketPlinth',(0,0,.12),(10,6,.24),'sidewalk')
    # Two ticket pavilions flank the central gate; both have glazing on all exposed sides.
    for y in (-2.02,2.02):
        s.box('ticketOffice',(0,y,1.47),(7.95,1.83,2.7),'schoolBusYellow')
        pitched(s,'pavilionRoof',0,y,8.7,1.95,2.91,3.56,'asphalt',roof)
        for x,side in ((4,1),(-4,-1)): window(s,x,y,1.7,1.25,1.45,side)
        window(s,-1.8,y+side_sign(y)*.93,1.65,1.55,1.30,side_sign(y),'y')
        for x in (-3.85,3.85):
            for yy in (y-.79,y+.79): s.box('brickPier',(x,yy,1.45),(.28,.24,2.6),'brick')
        for z in (.4,2.74): s.box('pavilionCourse',(0,y+side_sign(y)*.94,z),(7.96,.10,.17),'picketWhite')
    # Deep lintel and columns; closed prism canopy, never a floating sign panel.
    for y in (-1.06,1.06): s.box('gateColumn',(4.39,y,1.61),(.42,.28,3.05),'brick')
    s.box('gateLintel',(4.39,0,3.15),(.45,2.42,.40),'woodWarm')
    pitched(s,'gateCanopy',4.2,0,1.20,2.9,3.43,4,'asphalt',roof)
    s.box('gateSign',(4.64,0,3.21),(.08,1.94,.38),'backpackTeal')
    for y in (-.94,.94): s.box('gateRail',(4.15,y,1.15),(.13,.13,2.10),'uiDark')
    for z in (.37,1.83): s.box('gateCrossbar',(4.15,0,z),(.13,1.94,.12),'uiDark')
    for y in (-.64,-.32,0,.32,.64): s.box('gatePicket',(4.15,y,1.13),(.07,.07,1.56),'uiDark')
    if s.lod<2:
        s.tube('gateBadge',(4.71,0,3.21),.13,.06,'schoolBusYellow',rotation=(0,math.pi/2,0))
        for y in (-.72,.72): s.box('ticketCounter',(4.17,y+side_sign(y)*1.27,.91),(.36,1.26,.11),'woodWarm')
    return s


def run(asset, source):
    parser=argparse.ArgumentParser();parser.add_argument('--glb',required=True);parser.add_argument('--quality',default='high')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    directory=Path(source).resolve().parent
    stats={}
    for lod in (0,1,2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s={'bld.park-lodge':lodge,'bld.reptile-house':reptile,'bld.zoo-gate':zoo}[asset](Scene(asset,lod))
        # Keep the placeholder's solid lot footprint: these exteriors change art,
        # while existing mission/navigation routes retain their authored bounds.
        width,depth={'bld.park-lodge':(8,7),'bld.reptile-house':(10,8),'bld.zoo-gate':(10,6)}[asset]
        colliders.cuboid('buildingBounds',(width,depth,4),(0,0,2),s.root)
        sockets.empty('front',(5 if asset!='bld.park-lodge' else 4,0,0),s.root)
        export.merge_by_material(s.root,s.protected)
        meshes=[o for o in s.root.children_recursive if o.type=='MESH']
        ao.bake_all(meshes,16)
        # Match street_frontages.finish: AO adds contact depth while the bright
        # game palette remains legible on closed wall/roof assemblies.
        for ob in meshes:
            for color in ob.data.color_attributes['ao'].data:
                color.color=tuple(.55+.45*c for c in color.color[:3])+(1,)
        for ob in meshes: ob.data.calc_loop_triangles()
        triangles=sum(len(ob.data.loop_triangles) for ob in meshes)
        assert triangles <= (10000 if lod==0 else 3000), (asset,lod,triangles)
        assert len({m.name for ob in meshes for m in ob.data.materials})<=8
        path=directory/('model'+('' if lod==0 else '.lod'+str(lod))+'.glb')
        export.glb(s.root,path)
        stats['lod'+str(lod)]={'triangles':triangles,'bytes':path.stat().st_size}
        if lod==0 and Path(args.glb).resolve()!=path:
            import shutil
            shutil.copyfile(path,args.glb)
    (directory/'lod-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
