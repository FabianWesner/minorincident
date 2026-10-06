"""Detached workshop garage. Deterministic, metres, +X front, single-sided palette meshes.
Run through experiment/tools/blender_run.py; exports all LODs when --glb is supplied.
"""
import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib import palette, ao

parser = argparse.ArgumentParser()
parser.add_argument('--glb')
parser.add_argument('--audit', action='store_true')
parser.add_argument('--render')
parser.add_argument('--view', default='ref')
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--lod', type=int, default=0)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


FOOTPRINT_CENTER = None

def build(lod=0):
    global FOOTPRINT_CENTER
    if lod and FOOTPRINT_CENTER is None:
        build(0)  # Every LOD uses the same root, sockets, and collider positions.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    rng = random.Random(1947)
    tokens = ['asphalt', 'sidewalk', 'picketWhite', 'woodWarm', 'uiDark', 'denim',
              'survivorRed', 'backpackTeal', 'schoolBusYellow', 'foliage', 'grass', 'windowGlow']
    mats = {t: palette.mat(t, emissive=t == 'windowGlow') for t in tokens}
    for t, m in mats.items():
        m.use_backface_culling = True
        m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .78
        if t == 'windowGlow':
            m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 1.8
    def empty(name, loc=(0, 0, 0), parent=None):
        o = bpy.data.objects.new(name, None)
        scene.collection.objects.link(o)
        o.parent = parent
        o.location = loc
        return o
    root = empty('root')
    root['asset_id'] = 'bld.garage-detached'
    root['forward'] = '+X'
    root['tier'] = 'hero'
    body = empty('body', parent=root)
    roof = empty('roof', parent=root)
    interior = empty('interior', parent=root)
    door = empty('door_main', (1.50, 0, 3.02), root)
    door['motion'] = 'raised lower sectional shutter; local Z reveal control'
    window = empty('window_side', parent=root)
    bat_socket = empty('weapon_bat', (-.72, -.10, 1.275), interior)
    bat_socket['asset'] = 'weapon.bat'
    bat_socket['purpose'] = 'pickup spawn at the bat grip on the workbench'
    bat = empty('bat_display', parent=interior)
    bat['hide_on_pickup'] = True
    empty('entrySocket', (1.8, 0, .24), root)
    empty('front', (1.7, 0, 1.5), root)

    def mesh(name, vs, fs, token, parent=None, bevel=0):
        d = bpy.data.meshes.new(name)
        d.from_pydata(vs, [], fs)
        d.update()
        o = bpy.data.objects.new(name, d)
        scene.collection.objects.link(o)
        o.parent = parent or body
        d.materials.append(mats[token])
        if bevel and (lod < 2 or (parent or body).name in ('body','roof')):
            m = o.modifiers.new('Soft toy edges', 'BEVEL')
            m.width = bevel
            m.segments = 2 if lod==0 else 1
            o.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
        return o
    def box(name, loc, size, token, parent=None, bevel=.018):
        x, y, z = [v / 2 for v in size]
        vs = [(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),
              (-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
        fs = [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
        o = mesh(name, vs, fs, token, parent, min(bevel, min(size) * .24))
        o.location = loc
        return o
    def rod(name, p, q, radius, token, parent=None, sides=None, r2=None):
        n = sides or (12 if lod == 0 else 6 if lod == 1 else 4)
        delta = Vector(q) - Vector(p)
        h = delta.length
        vs = [(r*math.cos(i*math.tau/n), r*math.sin(i*math.tau/n), z)
              for r, z in [(radius,-h/2),(radius if r2 is None else r2,h/2)] for i in range(n)]
        fs = [tuple(reversed(range(n))), tuple(range(n,2*n))]
        fs += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        o = mesh(name, vs, fs, token, parent)
        o.location = (Vector(p) + Vector(q)) / 2
        o.rotation_euler = delta.to_track_quat('Z','Y').to_euler()
        for face in o.data.polygons:
            face.use_smooth = len(face.vertices) == 4
        return o
    def beam(name, p, q, width, token, parent=None):
        delta = Vector(q) - Vector(p)
        o = box(name, (Vector(p)+Vector(q))/2, (width,width,delta.length), token, parent)
        o.rotation_euler = delta.to_track_quat('Z','Y').to_euler()
        return o
    def profile(name, yz, x, depth, token, parent=None):
        if sum(y*z1-y1*z for (y,z),(y1,z1) in zip(yz,yz[1:]+yz[:1])) < 0:
            yz = list(reversed(yz))
        n = len(yz)
        vs = [(xx,y,z) for xx in (x-depth/2,x+depth/2) for y,z in yz]
        fs = [tuple(reversed(range(n))),tuple(range(n,2*n))]
        fs += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        return mesh(name,vs,fs,token,parent,.009)
    def ring(name, center, radius, tube, token, parent=None, n=None):
        # In the YZ plane: useful for front-facing bike wheels and handles.
        n = n or (28 if lod == 0 else 12 if lod == 1 else 8)
        k = 6 if lod == 0 else 4
        x,y,z = center
        vs = [(x+tube*math.sin(j*math.tau/k),
               y+(radius+tube*math.cos(j*math.tau/k))*math.cos(i*math.tau/n),
               z+(radius+tube*math.cos(j*math.tau/k))*math.sin(i*math.tau/n))
              for i in range(n) for j in range(k)]
        fs = [(i*k+j,((i+1)%n)*k+j,((i+1)%n)*k+(j+1)%k,i*k+(j+1)%k)
              for i in range(n) for j in range(k)]
        o=mesh(name,vs,fs,token,parent)
        for f in o.data.polygons: f.use_smooth=True
        return o

    # Paved, softly chamfered vignette footprint. Building walls remain navigable.
    box('foundation', (.30,0,.085), (5.85,7.0,.17), 'sidewalk', bevel=.045)
    if lod == 0:
        for i in range(7):
            for j in range(10):
                x=-2.16+i*.82; y=-3.15+j*.70
                if -1.5 < x < 1.45 and abs(y)<2.24: continue
                box('paving slab',(x,y,.18),(.793,.675,.13),'sidewalk',bevel=.03)
    box('workshop floor',(0,0,.205),(2.96,4.35,.09),'sidewalk',interior)
    # Rear and sides; open garage facade and true side-window aperture.
    box('rear wall',(-1.44,0,1.63),(.16,4.40,2.80),'asphalt')
    box('left wall',(0,2.12,1.63),(2.96,.16,2.80),'asphalt')
    box('right lower wall',(0,-2.12,.85),(2.96,.16,1.24),'asphalt')
    box('right upper wall',(0,-2.12,2.765),(2.96,.16,.53),'asphalt')
    for x,w in [(-1.00,.90),(1.00,.90)]:
        box('window pier',(x,-2.12,1.95),(w,.16,.94),'asphalt')
    for y in (-2.05,2.05):
        box('front jamb wall',(1.45,y,1.63),(.18,.34,2.80),'asphalt')
    box('front lintel',(1.45,0,2.89),(.18,3.80,.28),'asphalt')
    for x in (-1.44,1.45):
        profile('gable wall',[(-2.2,3.01),(2.2,3.01),(0,4.10)],x,.16,'asphalt',roof)
    if lod == 0:
        for side in (-1,1):
            for row in range(15):
                z=.33+row*.183
                if side==-1 and 1.38<z<2.59:
                    for x,w in [(-1.00,.89),(1.00,.89)]:
                        box('horizontal siding',(x,side*2.214,z),(w,.034,.173),'asphalt',bevel=.005)
                else:
                    box('horizontal siding',(0,side*2.214,z),(2.90,.034,.173),'asphalt',bevel=.005)
                box('rear siding',(-1.538,0,z),(.03,4.30,.173),'asphalt',bevel=.005)
            for row in range(5):
                z=3.12+row*.185
                w=4.26*(4.10-z)/1.09
                if w>.10:
                    for x in (-1.54,1.54):
                        box('gable lap siding',(x,0,z),(.025,w,.17),'asphalt',roof,bevel=.003)
    for x in (-1.50,1.53):
        for y in (-2.19,2.19):
            box('corner trim',(x,y,1.66),(.17,.17,2.87),'picketWhite')
    for y in (-1.86,1.86):
        box('opening casing',(1.575,y,1.57),(.18,.14,2.68),'picketWhite')
        box('door track',(1.41,y,1.58),(.09,.06,2.60),'uiDark',interior)
    box('header casing',(1.575,0,2.96),(.19,3.90,.16),'picketWhite')
    # Raised sectional door with bottom edge and slat channels, pivot above aperture.
    box('raised door panel',(.015,0,-.26),(.115,3.55,.52),'denim',door)
    if lod<2:
        for z in (-.46,-.34,-.22,-.10):
            box('sectional slat channel',(.080,0,z),(.017,3.49,.013),'uiDark',door,bevel=0)
    box('door lower rail',(.089,0,-.53),(.045,3.58,.04),'asphalt',door)
    # Roof, broad planes under staggered beveled shingles; all parts hide together.
    angle=math.atan2(1.20,2.43)
    for side in (-1,1):
        o=box('roof deck',(0,side*1.215,3.61),(3.44,2.72,.13),'uiDark',roof)
        o.rotation_euler.x=-side*angle
        if lod<2:
            for row in range(6):
                distance=(row+.5)*2.69/6
                y=side*distance*math.cos(angle)
                z=4.33-distance*math.sin(angle)
                for col in range(11):
                    x=-1.63+(col+.5)*3.26/11
                    o=box('staggered roof shingle',(x,y,z),(.285,.47,.055),'uiDark',roof,bevel=.009 if lod==0 else 0)
                    o.rotation_euler.x=-side*angle
        box('eave fascia',(0,side*2.46,3.005),(3.62,.14,.19),'picketWhite',roof)
    fascia=[(-2.49,3.04),(0,4.27),(2.49,3.04),(2.46,2.89),(0,4.09),(-2.46,2.89)]
    for x in (-1.75,1.75): profile('gable fascia',fascia,x,.14,'picketWhite',roof)
    if lod==0:
        for i in range(12):
            box('ridge cap',(-1.65+(i+.5)*3.3/12,0,4.255),(.27,.22,.055),'asphalt',roof,.01)
    else: box('ridge cap',(0,0,4.255),(3.4,.22,.07),'asphalt',roof)
    box('vent dark inset',(1.545,0,3.68),(.06,.43,.40),'uiDark',roof)
    for y in (-.25,.25): box('vent frame',(1.59,y,3.68),(.065,.07,.48),'picketWhite',roof)
    for z in (3.445,3.915): box('vent frame',(1.59,0,z),(.065,.56,.065),'picketWhite',roof)
    for i in range(6 if lod<2 else 2):
        box('vent louver',(1.585,0,3.51+i*.057 if lod<2 else 3.56+i*.2),(.072,.43,.025),'sidewalk',roof,bevel=.005)
    # Side window with framed amber panes and two crossing mullions.
    box('window glow',(0,-2.21,1.95),(.96,.035,.89),'windowGlow',window)
    for x in (-.53,.53): box('window frame',(x,-2.28,1.95),(.095,.12,1.10),'picketWhite',window)
    for z in (1.43,2.47): box('window frame',(0,-2.28,z),(1.17,.12,.09),'picketWhite',window)
    box('window mullion',(0,-2.28,1.95),(.04,.055,.94),'picketWhite',window)
    box('window crossbar',(0,-2.28,1.95),(1.01,.055,.04),'picketWhite',window)
    box('window sill',(0,-2.34,1.41),(1.23,.24,.065),'picketWhite',window)
    # Entrance gooseneck lamp plus small side lantern.
    lamp=empty('lamp_entrance',parent=root)
    rod('lamp mount',(1.59,0,3.10),(1.84,0,3.10),.035,'uiDark',lamp)
    rod('lamp stem',(1.84,0,3.10),(1.88,0,3.01),.035,'uiDark',lamp)
    rod('lamp shade',(1.88,0,2.94),(1.88,0,3.015),.15,'uiDark',lamp,r2=.065)
    rod('lamp bulb',(1.88,0,2.915),(1.88,0,2.941),.115,'windowGlow',lamp)
    box('side lantern',(1.20,-2.27,2.72),(.14,.12,.20),'windowGlow')
    box('side lantern cap',(1.20,-2.27,2.85),(.20,.18,.045),'uiDark')
    # Interior: a broad wooden workbench and pegboard full of readable hand tools.
    box('bench top',(-.88,.30,1.14),(.72,2.76,.13),'woodWarm',interior,.03)
    box('bench rear shelf',(-.98,.30,.43),(.52,2.64,.08),'woodWarm',interior)
    for x in (-1.10,-.64):
        for y in (-.99,1.56): box('bench legs',(x,y,.67),(.12,.12,.86),'woodWarm',interior)
    box('pegboard backing',(-1.315,.30,1.91),(.055,2.77,1.28),'woodWarm',interior)
    for y in (-1.12,1.72): box('pegboard rail',(-1.27,y,1.91),(.06,.055,1.33),'schoolBusYellow',interior)
    if lod==0:
        for row in range(8):
            for col in range(22):
                rod('peg hole',(-1.282,-1.025+col*.121,1.37+row*.15),(-1.277,-1.025+col*.121,1.37+row*.15),.013,'uiDark',interior,sides=6)
    if lod<2:
        for i in range(11 if lod==0 else 6):
            y=-.95+i*(.23 if lod==0 else .44)
            z=1.76+(i%3)*.06
            rod('tool shaft',(-1.215,y,z),(-1.215,y,z+.44),.022,'asphalt',interior)
            if i%3==0:
                box('hammer head',(-1.21,y,z+.43),(.075,.17,.07),'asphalt',interior)
                rod('hammer grip',(-1.21,y,z-.09),(-1.21,y,z+.08),.039,'woodWarm',interior)
            elif i%3==1:
                ring('wrench jaw',(-1.21,y,z+.40),.064,.018,'asphalt',interior,n=12)
                rod('wrench base',(-1.21,y,z-.06),(-1.21,y,z+.10),.031,'asphalt',interior)
            else:
                rod('screwdriver handle',(-1.21,y,z-.10),(-1.21,y,z+.10),.042,'survivorRed',interior)
        # Tool chest left of bench, five proud fronts with metal handles.
        box('tool chest',(-.64,1.66,.70),(.72,.64,.90),'survivorRed',interior,.035)
        box('chest top',(-.64,1.66,1.18),(.78,.69,.07),'uiDark',interior)
        for i in range(5 if lod==0 else 2):
            z=.35+i*(.16 if lod==0 else .48)
            box('drawer front',(-.258,1.66,z),(.025,.56,.13),'survivorRed',interior,.008)
            box('drawer handle',(-.235,1.66,z+.035),(.028,.40,.025),'sidewalk',interior,.006)
        for y in (1.43,1.90):
            rod('chest wheel',(-.75,y-.035,.27),(-.75,y+.035,.27),.085,'uiDark',interior)
        for y in (-.80,.17,1.08):
            box('shelf crate',(-.90,y,.64),(.43,.49,.35),'woodWarm',interior)
            if lod==0:
                for yy in (y-.17,y+.17): box('crate brace',(-.674,yy,.64),(.019,.035,.29),'schoolBusYellow',interior,.004)
        # Round stool, paint tins, vise, and workshop clutter on the counter.
        rod('stool seat',(.18,.73,.78),(.18,.73,.86),.23,'woodWarm',interior)
        for y in (.58,.88):
            for x in (.05,.31): beam('stool leg',(x,y,.24),(x,y,.79),.045,'asphalt',interior)
        for y,t in [(-.87,'backpackTeal'),(1.29,'schoolBusYellow')]:
            rod('paint tin',(-.91,y,1.22),(-.91,y,1.42),.09,t,interior)
            rod('paint lid',(-.91,y,1.42),(-.91,y,1.45),.095,'sidewalk',interior)
        box('bench vise',(-.69,.95,1.29),(.25,.29,.16),'asphalt',interior)
        rod('vise crank',(-.55,.94,1.27),(-.55,1.22,1.27),.018,'sidewalk',interior)
        box('bench toolbox',(-1.02,.60,1.30),(.26,.38,.19),'survivorRed',interior)
        # Bat lies on workbench; grip matches weapon_bat socket exactly.
        rod('bat handle',(-.72,-.10,1.275),(-.72,-.35,1.275),.025,'woodWarm',bat)
        rod('bat barrel',(-.72,-.35,1.275),(-.72,-.85,1.275),.031,'woodWarm',bat,r2=.063)
        rod('bat knob',(-.72,-.085,1.275),(-.72,-.115,1.275),.039,'woodWarm',bat)
        # Additional leaning long tool beside the bench.
        beam('leaning shovel handle',(.32,-.98,.28),(-.18,-1.14,1.94),.043,'woodWarm',interior)
        box('shovel blade',(.28,-.99,.42),(.09,.21,.31),'asphalt',interior)
        # Bicycle hanging on rear-right wall, frame in a front-readable YZ plane.
        bike=empty('bicycle',parent=interior)
        x=-1.20; y=-1.54; z=1.91
        for cy in (y-.39,y+.39):
            ring('bike tire',(x,cy,z),.33,.040,'uiDark',bike)
            if lod==0:
                ring('bike rim',(x+.012,cy,z),.277,.017,'sidewalk',bike)
                for j in range(10):
                    theta=j*math.tau/10
                    rod('bike spoke',(x+.025,cy,z),(x+.025,cy+.275*math.cos(theta),z+.275*math.sin(theta)),.005,'sidewalk',bike,sides=4)
        a=(x+.04,y-.39,z); b=(x+.04,y+.39,z); c=(x+.04,y-.12,z+.40); d=(x+.04,y+.23,z+.38); e=(x+.04,y,z+.06)
        for p,q in [(a,c),(c,e),(e,a),(c,d),(d,e),(d,b),(e,b)]: rod('bike frame',p,q,.027,'backpackTeal',bike)
        box('bike seat',(x+.04,y-.12,z+.48),(.12,.22,.045),'uiDark',bike)
        rod('bike handlebar',(x+.04,y+.24,z+.50),(x+.04,y+.46,z+.50),.022,'asphalt',bike)
        rod('wall bike hook',(-1.34,y+.02,z+.47),(-1.12,y+.02,z+.47),.018,'uiDark',bike)
        # Red mower right side near the entrance, four wheels and rising push handle.
        box('mower deck',(.70,-1.36,.44),(.69,.61,.22),'survivorRed',interior,.055)
        box('mower motor',(.63,-1.36,.64),(.31,.34,.20),'uiDark',interior,.05)
        for x in (.43,.99):
            for y in (-1.72,-1.0): rod('mower wheel',(x,y-.06,.36),(x,y+.06,.36),.145,'uiDark',interior)
        for y in (-1.64,-1.08): rod('mower handle rail',(.42,y,.54),(-.09,y,1.22),.028,'asphalt',interior)
        rod('mower handlebar',(-.09,-1.64,1.22),(-.09,-1.08,1.22),.032,'uiDark',interior)
    else:
        box('tool chest',(-.64,1.66,.70),(.72,.64,.90),'survivorRed',interior,0)
        box('mower',(.70,-1.36,.46),(.70,.65,.40),'survivorRed',interior,0)
        rod('bat',(-.72,-.10,1.275),(-.72,-.85,1.275),.045,'woodWarm',bat,sides=4)
    # Outdoor bins, orange wooden fence, red gas can, and paving-edge vegetation.
    for y,t in [(2.72,'denim'),(-2.78,'denim'),(-3.31,'woodWarm')]:
        x=.60 if y>0 else -.04
        box('wheelie bin',(x,y,.72),(.52,.52,.93),t,bevel=.035)
        box('bin lid',(x,y,1.22),(.58,.58,.085),'uiDark' if t=='denim' else 'woodWarm',bevel=.025)
        if lod<2:
            for yy in (y-.17,y+.17): rod('bin wheel',(x-.20,yy-.035,.27),(x-.20,yy+.035,.27),.085,'uiDark')
            box('bin lid handle',(x+.10,y,1.279),(.11,.23,.05),t)
            if lod==0:
                for yy in (y-.16,y,y+.16): box('bin rib',(x+.274,yy,.76),(.016,.024,.73),t,bevel=.006)
    if lod<2:
        box('gas can',(1.14,2.36,.46),(.21,.30,.46),'survivorRed',bevel=.045)
        ring('gas can handle',(1.14,2.36,.72),.071,.020,'survivorRed',n=12)
        rod('gas cap',(1.14,2.25,.66),(1.14,2.25,.71),.036,'uiDark')
        box('outdoor wood crate',(1.06,2.83,.46),(.47,.50,.42),'woodWarm')
    for side in (-1,1):
        y=side*3.12
        count=10 if side==1 else 4
        start=-1.72
        for i in range(count if lod==0 else 2):
            x=start+i*.28 if lod==0 else start+i*(2.5 if side==1 else .85)
            h=1.09 if i%3 else 1.22
            box('fence picket',(x,y,.25+h/2),(.24,.075,h),'woodWarm',bevel=.025)
        for z in (.54,1.04): box('fence rail',(-.43 if side==1 else -1.30,y+.05*side,z),(2.86 if side==1 else 1.05,.08,.10),'woodWarm')
    if lod<2:
        clusters=[(-1.83,2.50,2.4),(-1.62,-2.70,2.4),(-1.81,1.7,3.5),(-1.78,-1.4,3.9),
                  (-1.93,0,1.26),(1.69,3.06,.36),(1.65,-2.47,.32),(.9,-3.25,.3),(2.5,-2.8,.23),(2.5,2.8,.23)]
        for cx,cy,h in clusters:
            if h>1:
                for core in range(12 if lod==0 else 2):
                    d=bpy.data.meshes.new('rounded shrub core')
                    bm=bmesh.new(); bmesh.ops.create_icosphere(bm,subdivisions=2 if lod==0 else 1,radius=1)
                    bm.to_mesh(d); bm.free()
                    o=bpy.data.objects.new('rounded shrub core',d); scene.collection.objects.link(o)
                    o.parent=body; d.materials.append(mats['foliage' if core%3 else 'grass'])
                    o.location=(cx-.54+.15*math.cos(core*2.4),cy+.28*math.sin(core*2.4),.65+(h-.75)*core/(11 if lod==0 else 2))
                    o.scale=(.44,.44,.44)
                    for f in d.polygons: f.use_smooth=True
            count=(100 if h>1 else 30) if lod==0 else 3
            for k in range(count):
                a=k*2.39996; r=.20+.28*rng.random()
                c=(cx-(.60 if h>1 else 0)+r*math.cos(a),cy+r*math.sin(a),.20+h*rng.random())
                # Solid, two-sided leaf diamond; never alpha cards.
                scale=(.20+.09*rng.random()) if h>1 else (.15+.11*rng.random())
                c=(c[0],c[1],max(.22+scale,c[2]))
                vs=[(0,0,-scale),(-scale*.48,0,0),(0,-scale*.2,0),(scale*.48,0,0),(0,scale*.2,0),(0,0,scale)]
                fs=[(0,2,1),(0,3,2),(0,4,3),(0,1,4),(5,1,2),(5,2,3),(5,3,4),(5,4,1)]
                o=mesh('shrub leaf',vs,fs,'foliage' if k%3 else 'grass'); o.location=c
                o.rotation_euler=(rng.uniform(-1,1),rng.uniform(-1,1),a)
                if lod==0 and k%5==0:
                    # Five chunky petals around a warm center, matching pink/yellow flowers.
                    for petal in range(5):
                        t=petal*math.tau/5
                        box('flower petal',(c[0]+.042*math.cos(t),c[1]+.042*math.sin(t),c[2]+.13),(.054,.055,.025),'survivorRed' if k%2 else 'picketWhite',bevel=0)
                    rod('flower heart',(c[0],c[1],c[2]+.133),(c[0],c[1],c[2]+.155),.021,'schoolBusYellow',sides=6)
        if lod==0:
            for x,y in [(2.73,-1.9),(2.1,.7),(2.67,2.4),(.91,-3.3),(-1.9,3.0)]:
                for k in range(5):
                    angle=k*math.tau/5
                    beam('paving weed',(x,y,.245),(x+.13*math.cos(angle),y+.13*math.sin(angle),.44),.024,'grass')
    # Wall colliders leave the entrance and interior clear for navigation.
    for name,c,size in [('rear',(-1.44,0,1.63),(.16,4.40,2.80)),
                        ('left',(0,2.12,1.63),(2.96,.16,2.80)),
                        ('right',(0,-2.12,1.63),(2.96,.16,2.80)),
                        ('floor',(0,0,.10),(2.96,4.35,.20))]:
        col=empty('col:'+name,c,root); col['collider']='cuboid'; col['size']=list(size)
    for name,c,kind in [('entrance',(1.88,0,2.925),'point'),('workshop',(-.9,.2,2.36),'point'),('side',(0,-2.31,1.95),'window')]:
        anchor=empty('light:'+name,c,root)
        anchor['ss_light']={'type':kind,'color':'light_window_warm','intensity':2.5,'range':3,
             'pool':True,'beam':'none','flare':name=='entrance','reflect':True,'shadow':'none',
             'heroPriority':1,'flicker':'none','animation':None,'powerGroup':'residential',
             'breakable':True,'emissiveNodes':[],'tiers':'all'}
    # Bring the workshop forward enough to read below the raised shutter.
    for o in scene.objects:
        if o.type=='MESH' and o.parent.name=='bicycle':
            o.location.z-=.28
            o.location.y+=.32  # Both tires remain inside the garage shell.
        if o.type=='MESH' and o.name.startswith(('tool shaft','hammer','wrench','screwdriver')): o.location.z-=.24
        if o.type=='MESH' and o.parent.name in ('interior','bat_display','bicycle'):
            if not o.name.startswith(('workshop floor','mower','stool','shovel','leaning')):
                o.location.x+=.45
    bat_socket.location.x+=.45
    # Evaluate soft bevels then join only within semantic groups and palette materials.
    bpy.context.view_layer.update()
    groups={}
    deps=bpy.context.evaluated_depsgraph_get()
    evaluated=[(o,bpy.data.meshes.new_from_object(o.evaluated_get(deps),
               preserve_all_data_layers=True,depsgraph=deps))
               for o in list(scene.objects) if o.type=='MESH']
    for o,data in evaluated:
        old=o.data; o.modifiers.clear(); o.data=data
        bpy.data.meshes.remove(old)
        groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
    for (parent,mat),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        o=bpy.context.object; o.name=parent.name+'_'+mat.name
        scene.cursor.location=parent.matrix_world.translation
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    # Match the concept: chest left, side window and mower right.
    objects=[o for o in scene.objects if o.type=='MESH']
    vertices={o:[o.matrix_world@v.co for v in o.data.vertices] for o in objects}
    for o in scene.objects:
        if o.type=='EMPTY': o.location.y=-o.location.y
    bpy.context.view_layer.update()
    from mathutils import Matrix
    for o in objects:
        pivot=o.parent.matrix_world.translation.copy()
        o.matrix_world=Matrix.Translation(pivot)
        for v,world in zip(o.data.vertices,vertices[o]):
            world.y=-world.y
            v.co=world-pivot
        bm=bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
        bm.to_mesh(o.data); bm.free()
    # Keep the full apron centered on X/Y, bottom exactly ground-contact Z=0.
    points=[o.matrix_world@v.co for o in scene.objects if o.type=='MESH' for v in o.data.vertices]
    if lod==0:
        FOOTPRINT_CENTER=Vector(((min(v.x for v in points)+max(v.x for v in points))/2,
                                (min(v.y for v in points)+max(v.y for v in points))/2,0))
    for child in root.children: child.location-=FOOTPRINT_CENTER
    bat_socket.rotation_euler.z=math.pi/2  # local +X follows the lying bat barrel
    bpy.context.view_layer.update()
    for anchor in [o for o in scene.objects if o.name.startswith('light:')]:
        parent=lamp if anchor.name=='light:entrance' else window if anchor.name=='light:side' else interior
        anchor['ss_light']['emissiveNodes']=[o.name for o in scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0].name.startswith('emi_')]
    return [o for o in scene.objects if o.type=='MESH']


def stats(objects):
    tris=0
    digest=hashlib.sha256()
    for o in sorted(objects,key=lambda o:o.name):
        o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
        digest.update(o.name.encode())
        for v in o.data.vertices: digest.update(str(tuple(round(c,6) for c in o.matrix_world@v.co)).encode())
        for f in o.data.polygons: digest.update(str(tuple(f.vertices)).encode())
    return {'triangles':tris,'draw_calls':len(objects),'geometry_hash':digest.hexdigest(),
            'materials':sorted({m.name for o in objects for m in o.data.materials}),
            'nodes':sorted(o.name for o in bpy.context.scene.objects)}


def export_chain(path):
    metrics={}
    for lod in (0,1,2):
        objects=build(lod)
        metrics['lod'+str(lod)]=stats(objects)
        print('OK pre-export LOD '+str(lod)+' '+json.dumps(metrics['lod'+str(lod)]),flush=True)
        assert metrics['lod'+str(lod)]['triangles']<=100000
        assert len(objects)<=40
        ao.bake_all(objects,samples=32)
        target=Path(path).with_name('model'+('' if lod==0 else '.lod'+str(lod))+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(target.resolve()),export_format='GLB',export_apply=True,
             export_yup=True,export_extras=True,export_cameras=False,export_lights=False,
             export_all_vertex_colors=True)
    (HERE/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
    print('OK LOD chain '+json.dumps({k:{'triangles':v['triangles'],'draw_calls':v['draw_calls']} for k,v in metrics.items()}))


def render():
    objects=build(args.lod)
    if (HERE/'metrics.json').exists():
        expected=json.loads((HERE/'metrics.json').read_text())['lod'+str(args.lod)]
        assert stats(objects)['geometry_hash']==expected['geometry_hash'], 'Rebuild differs from existing metrics; re-export changed source first'
    s=bpy.context.scene
    # Eevee studio renders; CPU-only AO is used during GLB export.
    world=bpy.data.worlds.new('neutral gray studio'); s.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.05,.043,.066,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
    def light(name,loc,power,color,size=4,kind='AREA',target=(0,0,1.6)):
        d=bpy.data.lights.new(name,kind); d.energy=power; d.color=color
        if kind=='AREA': d.shape='DISK'; d.size=size
        else: d.shadow_soft_size=size
        o=bpy.data.objects.new(name,d); s.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    light('golden key',(5,4,7),650,(1,.77,.51),6)
    light('lavender fill',(4,-5,5),420,(.65,.69,1),6)
    light('rim',(-4,2,6),800,(1,.60,.28),5)
    light('workshop golden spill',(-.4,0,2.40),70,(1,.56,.20),1.2,'AREA',(-1.2,0,1.4))
    light('entrance glow',(1.7,0,2.87),25,(1,.55,.16),.20,'POINT')
    light('side glow',(.90,2.45,2.66),18,(1,.55,.16),.15,'POINT')
    d=bpy.data.cameras.new('Review camera'); cam=bpy.data.objects.new('Review camera',d)
    s.collection.objects.link(cam); s.camera=cam
    target=Vector((0,0,1.85))
    views={'ref':(16,3.8,5.0),'game':(11,11,13),'front':(16,0,6.7),
           'side':(0,15,8),'rear':(-13,6,8),'cutaway':(11,9,13)}
    cam.location=views.get(args.view,views['ref'])
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    d.type='ORTHO'; d.ortho_scale=10.5 if args.view!='game' else 12.6
    if args.view=='cutaway':
        roof=bpy.data.objects['roof']
        for o in roof.children_recursive: o.hide_render=True
    s.render.engine='BLENDER_EEVEE'
    s.eevee.taa_render_samples=args.samples
    s.render.resolution_x=args.width; s.render.resolution_y=args.height
    s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG'
    s.view_settings.view_transform='AgX'; s.view_settings.look='AgX - Medium High Contrast'
    targets=['ref','front','side','rear','game','cutaway'] if args.view=='all' else [args.view]
    for view in targets:
        cam.location=views.get(view,views['ref'])
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        d.ortho_scale=12.6 if view in ('game','cutaway') else 10.5
        for o in bpy.data.objects['roof'].children_recursive: o.hide_render=view=='cutaway'
        hero=view=='ref'
        s.eevee.taa_render_samples=args.samples if hero else min(args.samples,24)
        s.render.resolution_x=args.width if hero else min(args.width,960)
        s.render.resolution_y=args.height if hero else min(args.height,540)
        path=Path(args.render) if hero or args.view!='all' else Path(args.render).with_name(view+'.png')
        s.render.filepath=str(path.resolve())
        bpy.ops.render.render(write_still=True)
        print('OK Eevee single-sided render '+view,flush=True)

try:
    if args.glb: export_chain(args.glb)
    if args.audit:
        expected=json.loads((HERE/'metrics.json').read_text())
        results={}
        for lod in (0,1,2):
            actual=stats(build(lod)); key='lod'+str(lod)
            assert actual['geometry_hash']==expected[key]['geometry_hash'], 'Non-deterministic '+key
            results[key]={'geometry_hash':actual['geometry_hash'],'matches_export':True}
        (HERE/'determinism.json').write_text(json.dumps(results,indent=2)+'\n')
        print('OK deterministic rebuild all LODs')
    if args.render: render()
except Exception:
    # Blender normally logs a Python exception but exits zero; make the wrapper
    # detect a failed contract or incomplete build without changing shared tools.
    import os
    import traceback
    traceback.print_exc()
    sys.stderr.flush(); sys.stdout.flush()
    os._exit(1)
