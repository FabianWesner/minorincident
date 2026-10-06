"""Sunset Grove mini-mall cutaway. Metres; +X front; Z up; no textures.
All lettering/trim has >= 3 mm clearance. Static meshes merge by palette.
Run with experiment/tools/blender_run.py; exports the complete Hero LOD chain.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools' / 'blender'))
from sslib import palette, ao

parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--glb')
parser.add_argument('--view', default='ref', choices=['ref', 'game', 'front', 'side', 'rear'])
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
M = {}
for token in ['sidewalk','canvasTan','picketWhite','woodWarm','leatherShadow','khakiSeam',
              'apronSage','policeBlue','denimBlue','blueTrim','survivorRed','brick','uiDark','silver',
              'schoolBusYellow','teeLavender','backpackTeal','foliage','grass','cardiganRose','lavenderShadow']:
    M[token] = palette.mat(token)
    bs = M[token].node_tree.nodes['Principled BSDF']
    bs.inputs['Roughness'].default_value = .48
glass = M['teeLavender'].node_tree.nodes['Principled BSDF']
glass.inputs['Alpha'].default_value=.13
glass.inputs['Roughness'].default_value=.14
M['teeLavender'].surface_render_method='DITHERED'
M['silver'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = .55
M['policeBlue'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .32
M['glow'] = palette.mat('windowGlow', emissive=True)
M['glow'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 2.5
M['fireglow'] = palette.mat('schoolBusYellow', emissive=True)
M['fireglow'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 2.0


def empty(name, loc=(0,0,0), parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = loc
    o.parent = parent
    return o

root = empty('root')
root['asset_id'] = 'int.mini-mall'
root['category'] = 'building'
root['front'] = '+X'
interior = empty('interior', parent=root)
roof = empty('roof', parent=root)
roof['cutaway'] = True
roof['description'] = 'Intentionally roofless interior kit; roof visibility hook.'
protected = [interior]
LOD_PARTS = {}
LOD_GROUPS = {}


def finish(o, name, token, bevel=0, parent=interior, shape=None):
    o.name = name
    o.data.materials.append(M[token])
    LOD_PARTS[o] = {'mesh':o.data.copy(),'shape':shape,'name':name}
    bpy.context.view_layer.objects.active = o
    if bevel:
        mod = o.modifiers.new('soft edges', 'BEVEL')
        mod.width = min(bevel, min(o.dimensions) * .24)
        mod.segments = 2 if bevel >= .03 else 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = o.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:
        f.use_smooth = True
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def box(name, loc, size, token, bevel=.018, parent=interior):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, token, min(bevel, min(size)*.35), parent)


def cyl(name, loc, radius, depth, token, axis='Z', parent=interior, vertices=16):
    rot = (0,math.pi/2,0) if axis=='X' else ((math.pi/2,0,0) if axis=='Y' else (0,0,0))
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.object, name, token, .006, parent, ('cylinder',radius,depth))


def ring(name, loc, radius, tube, token, parent=interior, axis='X'):
    rot = (0,math.pi/2,0) if axis=='X' else (0,0,0)
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=6, major_radius=radius,
                                   minor_radius=tube, location=loc, rotation=rot)
    return finish(bpy.context.object, name, token, parent=parent, shape=('torus',radius,tube))


def rod(name, a, b, radius, token, parent=interior):
    a,b = Vector(a),Vector(b)
    o = cyl(name, (a+b)/2, radius, (b-a).length, token, parent=parent, vertices=12)
    o.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    return o

font = bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf')
# Text faces +X: local X = +Y and local Y = +Z.
text_rotation = Matrix(((0,0,1),(1,0,0),(0,1,0))).to_4x4().to_euler()

def text(body, x, y, z, size, token, width=None, parent=interior):
    cu = bpy.data.curves.new(body, 'FONT')
    cu.body = body
    cu.font = font
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.size = size
    cu.extrude = .004
    cu.resolution_u = 2
    o = bpy.data.objects.new(body, cu)
    scene.collection.objects.link(o)
    o.location = (x,-y,z)
    o.rotation_euler = text_rotation
    bpy.context.view_layer.update()
    if width and o.dimensions.y > width:
        o.scale.x *= width / o.dimensions.y
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    return finish(o, 'lettering '+body, token, parent=parent)

def prism(name, points, bottom, top, token, bevel):
    count=len(points)
    vertices=[(x,y,z) for z in [bottom,top] for x,y in points]
    faces=[tuple(reversed(range(count))),tuple(range(count,2*count))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces)
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
    return finish(obj,name,token,bevel)

# Floor: individual pavers sit on a single slab, with intentional grout gaps.
prism('foundation',[(-2.55,-6.7),(2.10,-6.7),(2.55,-6.25),(2.55,6.25),(2.10,6.7),(-2.55,6.7)],0,.20,'lavenderShadow',.06)
for ix in range(7):
    for iy in range(19):
        x = -2.18 + ix*.725
        y = -6.35 + iy*.705
        token = 'canvasTan' if (ix+iy)%8 else 'sidewalk'
        if ix==6 and iy in [0,18]:
            # Clip only the two corner pavers against the chamfered slab edge.
            corners=[(x-.353,y-.3455),(x+.353,y-.3455),(x+.353,y+.3455),(x-.353,y+.3455)]
            sign=-1 if iy==0 else 1
            clipped=[]
            for start,end in zip(corners,corners[1:]+corners[:1]):
                a=start[0]+sign*start[1]-8.8;b=end[0]+sign*end[1]-8.8
                if a<=0:clipped.append(start)
                if (a<=0)!=(b<=0):
                    t=a/(a-b);clipped.append((start[0]+t*(end[0]-start[0]),start[1]+t*(end[1]-start[1])))
            prism('corner paver',clipped,.20,.248,token,.009)
        else:box('floor paver',(x,y,.224),(.706,.691,.048),token,.009)
# Back wall and cornice, one shop inset color per bay.
box('back masonry',(-2.43,0,2.02),(.22,13.1,3.60),'leatherShadow',.035)
for y,token in [(4.25,'apronSage'),(0,'canvasTan'),(-4.25,'canvasTan')]:
    box('shop wall',(-2.295,y,1.86),(.036,3.83,3.16),token,.006)
    box('back skirting',(-2.23,y,.37),(.11,3.82,.22),'khakiSeam')
    box('shop header',(-.92,y,3.49),(.29,3.79,.94),'leatherShadow',.04)
    box('sign rim',(-.743,y,3.47),(.082,3.65,.88),'woodWarm',.015)
    sign = 'survivorRed' if y==0 else 'denimBlue'
    box('shop sign',(-.693,y,3.47),(.045,3.54,.77),sign,.012)
    text('SUNSET GROVE',-.66,y-.38,3.65,.29,'picketWhite',2.58)
    text('PIZZA' if y==0 else ('LAUNDRY' if y>0 else 'PHONE REPAIR'),-.66,y-.38,3.30,.48,'picketWhite',2.58)
box('rear crown',(-2.40,0,3.87),(.31,13.25,.18),'woodWarm',.035)
box('rear crown inlay',(-2.224,0,3.88),(.025,13.12,.043),'canvasTan',.004)
for y in [-6.39,-2.12,2.12,6.39]:
    box('pilaster',(-.94,y,2.04),(.52,.43,3.59),'leatherShadow',.04)
    box('column front',(-.647,y,2.01),(.064,.30,3.48),'woodWarm',.018)
    for dy in [-.112,.112]:
        box('column flute',(-.603,y+dy,2.04),(.018,.018,3.26),'khakiSeam',.004)
    box('column plinth',(-.90,y,.38),(.64,.58,.29),'khakiSeam',.04)
    box('column cap',(-.95,y,3.89),(.77,.71,.20),'woodWarm',.036)
    box('cap gold lip',(-.54,y,3.87),(.012,.67,.034),'schoolBusYellow',.003)
    box('sconce mounting',(-.581,y,2.72),(.085,.245,.61),'uiDark',.022)
    box('sconce brass frame',(-.514,y,2.72),(.10,.212,.56),'schoolBusYellow',.022)
    box('sconce luminous pane',(-.452,y,2.72),(.027,.149,.48),'glow',.015)
    for dy in [-.079,.079]:
        rod('sconce rail',(-.42,y+dy,2.45),(-.42,y+dy,2.99),.012,'woodWarm')
# Cutaway side and shop dividing return walls; keep the camera side open.
for y in [-6.55,6.55]:
    box('outer return',(-1.68,y,1.98),(1.4,.15,3.49),'sidewalk',.022)
for y in [-2.12,2.12]:
    box('bay divider',(-1.75,y,1.71),(1.20,.11,2.87),'khakiSeam',.015)
# Raised sign pictograms.
box('washer icon',(-.652,5.60,3.48),(.034,.44,.49),'picketWhite',.034)
ring('washer icon blue ring',(-.625,5.60,3.44),.135,.021,'blueTrim')
for dy in [-.14,0,.14]:cyl('icon buttons',(-.619,5.60+dy,3.67),.016,.01,'blueTrim','X',vertices=12)
box('phone icon',(-.65,-2.95,3.48),(.034,.36,.52),'picketWhite',.026)
box('phone icon screen',(-.626,-2.95,3.50),(.014,.28,.37),'blueTrim',.008)
cyl('phone icon home',(-.610,-2.95,3.255),.023,.01,'blueTrim','X')
# Pizza glyph: a thick triangle with crust and raised pepperoni.
me=bpy.data.meshes.new('slice icon')
me.from_pydata([(-.65,.93,3.20),(-.65,1.44,3.67),(-.65,.88,3.74),(-.628,.93,3.20),(-.628,1.44,3.67),(-.628,.88,3.74)],[],[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)])
o=bpy.data.objects.new('pizza slice icon',me);scene.collection.objects.link(o);finish(o,o.name,'schoolBusYellow')
rod('pizza glyph crust',(-.604,.88,3.74),(-.604,1.44,3.67),.045,'picketWhite')
for y,z in [(1.0,3.59),(1.22,3.57),(1.02,3.37)]:cyl('icon topping',(-.601,y,z),.057,.014,'survivorRed','X')

# LAUNDRY: four washers, tall dryer, folding station, basket and waiting seats.
for i in range(4):
    y=3.01+i*.72
    box('washer body',(-1.72,y,.84),(.89,.68,1.15),'picketWhite',.04)
    box('washer toe',(-1.246,y,.33),(.035,.60,.10),'silver',.008)
    box('washer control band',(-1.254,y,1.31),(.033,.63,.13),'canvasTan',.006)
    box('washer display',(-1.229,y+.16,1.32),(.018,.155,.066),'uiDark',.003)
    text(str(i+1),-1.213,y+.16,1.32,.048,'picketWhite')
    cyl('wash selector',(-1.222,y-.16,1.32),.034,.022,'silver','X')
    for z in [.47,1.15]:cyl('cabinet screw',(-1.224,y+.27,z),.010,.007,'silver','X',vertices=12)
    door=empty('door_washer_'+str(i),(-1.23,y+.24,.83),interior);protected.append(door)
    cyl('washer dark drum',(-1.21,y,.83),.242,.048,'uiDark','X',door)
    ring('washer silver rim',(-1.17,y,.83),.242,.027,'silver',door)
    box('washer pull',(-1.132,y-.21,.83),(.032,.055,.15),'silver',.012,door)
    ring('drum inner shine',(-1.174,y,.83),.191,.008,'silver',door)
# Upper washer row: door rims hinge separately, drums remain inside the cabinet.
for i in range(4):
    y=3.01+i*.72
    box('upper washer body',(-1.72,y,1.94),(.89,.68,1.02),'picketWhite',.035)
    box('upper washer controls',(-1.254,y,2.36),(.033,.63,.13),'canvasTan',.006)
    box('upper washer display',(-1.229,y+.16,2.37),(.018,.155,.066),'uiDark',.003)
    cyl('upper wash selector',(-1.222,y-.16,2.37),.034,.022,'silver','X')
    cyl('upper washer drum',(-1.21,y,1.91),.242,.048,'uiDark','X')
    door=empty('door_washer_upper_'+str(i),(-1.23,y+.24,1.91),interior);protected.append(door)
    ring('upper washer silver rim',(-1.17,y,1.91),.242,.027,'silver',door)
    box('upper washer pull',(-1.132,y-.21,1.91),(.032,.055,.15),'silver',.012,door)
    ring('upper drum rim',(-1.174,y,1.91),.191,.008,'silver',door)
# Double stacked unit tucked at the right of the laundry.
box('stacked dryer',(-1.73,2.57,1.20),(.93,.48,1.88),'silver',.025)
for z in [.70,1.55]:
    cyl('dryer window',(-1.24,2.57,z),.185,.034,'uiDark','X')
    ring('dryer rim',(-1.207,2.57,z),.186,.027,'picketWhite')
    box('dryer controls',(-1.23,2.57,z+.31),(.025,.38,.086),'picketWhite',.006)
# Laundry poster and clock.
box('laundry poster surround',(-2.254,5.78,2.21),(.054,.75,1.25),'woodWarm',.008)
box('laundry poster paper',(-2.216,5.78,2.21),(.018,.69,1.19),'canvasTan',.005)
for j,t in enumerate(['CLEAN','CLOTHES','BRIGHTER','DAYS']):text(t,-2.201,5.78,2.62-j*.27,.19,'blueTrim',.62)

def clock(y,z):
    cyl('clock frame',(-2.20,y,z),.18,.067,'uiDark','X')
    cyl('clock face',(-2.158,y,z),.151,.018,'canvasTan','X')
    for i in range(12):
        a=i*math.tau/12
        ob=box('clock tick',(-2.140,y+math.sin(a)*.125,z+math.cos(a)*.125),(.008,.009,.024),'uiDark',.002)
        ob.rotation_euler.x=-a
    rod('clock hour',(-2.129,y,z),(-2.129,y-.044,z+.066),.008,'uiDark')
    rod('clock minute',(-2.124,y,z),(-2.124,y+.012,z+.111),.005,'uiDark')
clock(3.6,2.58);clock(-4.43,2.64)
# two blue waiting chairs.
for y in [5.43,4.86]:
    box('chair seat',(-.26,y,.69),(.46,.46,.095),'policeBlue',.045)
    back=box('chair back',(-.53,y,1.04),(.09,.45,.54),'policeBlue',.04)
    back.rotation_euler.y=-.10
    for x in [-.45,-.05]:
        for dy in [-.17,.17]:rod('chair leg',(x,y+dy,.26),(x-.035,y+dy,.65),.024,'uiDark')
    for dy in [-.17,.17]:rod('back upright',(-.47,y+dy,.57),(-.50,y+dy,1.04),.016,'silver')
# Folded towel table.
box('folding top',(-.18,3.62,1.05),(.76,1.28,.09),'picketWhite',.027)
for x in [-.46,.11]:
    for y in [3.08,4.16]:box('table leg',(x,y,.66),(.07,.07,.75),'silver',.014)
box('fold table cupboard',(-.33,3.61,.66),(.49,.87,.70),'sidewalk',.025)
for y,col in [(3.30,'schoolBusYellow'),(3.65,'cardiganRose'),(4.0,'backpackTeal')]:
    for k in range(3):
        box('folded towel',(-.14,y,1.13+k*.062),(.45,.30,.055),col,.018)
        box('towel fold seam',(.091,y,1.131+k*.062),(.006,.25,.010),'picketWhite',.002)
# Basket wire cage on four caster wheels.
for y in [3.96,4.61]:
    for x in [.28,.83]:
        cyl('basket caster',(x,y,.315),.058,.040,'uiDark','Y',vertices=16)
        rod('caster stem',(x,y,.34),(x,y,.43),.014,'silver')
for z in [.43,.78,.91]:
    for y in [3.96,4.61]:rod('basket end',( .28,y,z),(.83,y,z),.013,'silver')
    for x in [.28,.83]:rod('basket side',(x,3.96,z),(x,4.61,z),.013,'silver')
for j in range(7):
    y=3.96+j*.108
    for x in [.28,.83]:rod('basket vertical wire',(x,y,.43),(x,y,.91),.009,'silver')
for j in range(6):
    x=.28+j*.11
    for y in [3.96,4.61]:rod('basket end wire',(x,y,.43),(x,y,.91),.009,'silver')
    rod('basket bottom',(x,3.96,.43),(x,4.61,.43),.009,'silver')
for z in [.55,.67]:
    for x in [.28,.83]:rod('basket horizontal wire',(x,3.96,z),(x,4.61,z),.008,'silver')
# Change machine standing in the shared corridor.
box('change machine',(.15,2.20,.92),(.60,.58,1.38),'lavenderShadow',.037)
box('change base',(.15,2.20,.30),(.66,.63,.12),'uiDark',.02)
box('change title plate',(.462,2.20,1.40),(.032,.46,.18),'picketWhite',.012)
text('CHANGE',.486,2.20,1.40,.124,'blueTrim',.42)
box('coin accept panel',(.465,2.20,1.02),(.035,.36,.36),'blueTrim',.012)
box('bill slot',(.490,2.20,1.10),(.017,.23,.042),'uiDark',.004)
box('coin return',(.490,2.20,.93),(.017,.14,.07),'silver',.006)
box('coin dish',(.47,2.20,.61),(.06,.20,.09),'silver',.01)

# PIZZA: warm tiled backsplash and brick arch oven.
for row in range(9):
    for col in range(12):
        y=-1.86+col*.31
        token='brick' if 4<=col<=7 else 'canvasTan'
        box('oven wall tile',(-2.258,y,.78+row*.205),(.023,.30,.195),token,.004)
for col in range(17):
    for row in range(2):
        box('checker backsplash',(-2.229,-1.8+col*.22,.51+row*.16),(.018,.213,.153),'survivorRed' if (col+row)%2 else 'picketWhite',.003)
box('oven hearth',(-1.82,-.65,1.19),(.79,1.54,.19),'khakiSeam',.025)
box('oven black firebox',(-2.05,-.65,1.56),(.32,1.04,.68),'uiDark',.11)
for side in [-1,1]:
    for k in range(3):box('oven jamb brick',(-1.83,-.65+side*.62,1.29+k*.18),(.47,.25,.165),'brick',.014)
for j in range(9):
    a=math.pi*j/8
    o=box('arched voussoir',(-1.83,-.65+.62*math.cos(a),1.72+.62*math.sin(a)),(.47,.235,.24),'brick',.016)
    o.rotation_euler.x=a-math.pi/2
box('oven chimney',(-2.0,-.65,2.74),(.57,.71,.78),'brick',.024)
for k in range(5):box('chimney grout',(-1.699,-.65,2.43+k*.145),(.012,.70,.012),'canvasTan',.002)
for y in [-.91,-.60,-.35]:
    log=cyl('baking ember',(-1.79,y,1.321),.065,.30,'woodWarm','Y',vertices=12)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(-1.75,y,1.46))
    o=bpy.context.object;o.scale=(.085,.10,.20);finish(o,'fire tongue','fireglow')
box('oven apron',(-1.56,-.65,1.23),(.29,1.24,.065),'picketWhite',.017)
# Ingredient prep counter, boxes, point of sale.
box('prep cabinetry',(-1.61,1.05,.71),(.74,1.43,.89),'woodWarm',.025)
box('prep worktop',(-1.60,1.02,1.20),(.87,1.50,.09),'picketWhite',.022)
for y in [.68,1.40]:
    box('prep raised door',(-1.222,y,.72),(.023,.64,.73),'leatherShadow',.008)
    box('prep door inset',(-1.204,y,.72),(.015,.56,.64),'woodWarm',.004)
    cyl('cabinet knob',(-1.18,y-.23,.90),.023,.025,'silver','X')
for k in range(4):box('pizza box stack',(-1.67,1.47,1.29+k*.08),(.48,.52,.075),'woodWarm',.012)
for y in [.28,.42]:
    cyl('condiment bottle',(-1.44,y,1.36),.045,.23,'schoolBusYellow' if y==.28 else 'survivorRed')
    cyl('bottle cap',(-1.44,y,1.50),.019,.05,'picketWhite')
box('cash register',(-1.32,1.0,1.31),(.25,.35,.17),'uiDark',.024)
box('register screen',(-1.40,1.0,1.45),(.07,.23,.16),'uiDark',.016)
box('register lit screen',(-1.357,1.0,1.46),(.012,.18,.10),'backpackTeal',.004)
# Display counter in front with recessed red slats, inset glass-like open frame.
box('pizza counter',(.04,-.67,.69),(.75,1.94,.83),'survivorRed',.022)
box('counter plinth',(.04,-.67,.32),(.83,2.02,.13),'sidewalk',.025)
for y in [-1.54+i*.17 for i in range(11)]:box('counter vertical seam',(.425,y,.72),(.011,.012,.67),'brick',.002)
box('pizza countertop',(.03,-.67,1.145),(.90,2.07,.09),'picketWhite',.026)
for z in [1.21,1.61]:box('display tray shelf',(-.12,-.67,z),(.49,1.84,.035),'silver',.012)
for y in [-1.64,.30]:
    for x in [-.40,.21]:rod('display upright',(x,y,1.18),(x,y,1.94),.021,'silver')
for x in [-.40,.21]:rod('display top rail',(x,-1.64,1.93),(x,.30,1.93),.02,'silver')
box('display glass lid',(-.095,-.67,1.945),(.61,1.93,.012),'teeLavender',.003)
box('display front glazing',(.238,-.67,1.57),(.009,1.86,.68),'teeLavender',.002)
for y in [-1.64,.30]:rod('display end rail',(-.40,y,1.93),(.21,y,1.93),.02,'silver')
# Solid pizzas with crust, sauce, cheese and individual pepperoni.
for z in [1.25,1.65]:
    for y in [-1.31,-.69,-.07]:
        cyl('pizza pan',(-.09,y,z),.226,.022,'silver')
        cyl('pizza crust',(-.09,y,z+.021),.206,.036,'canvasTan')
        cyl('pizza tomato',(-.09,y,z+.044),.177,.012,'survivorRed')
        cyl('pizza cheese',(-.09,y,z+.054),.159,.009,'schoolBusYellow')
        for k in range(6):
            a=k*math.tau/6
            cyl('pepperoni',(-.09+.106*math.cos(a),y+.106*math.sin(a),z+.064),.024,.008,'brick',vertices=12)
# Rear menu.
box('pizza menu frame',(-2.18,1.55,2.18),(.075,.91,1.27),'woodWarm',.012)
box('pizza chalk menu',(-2.128,1.55,2.18),(.025,.82,1.19),'uiDark',.004)
for k,t in enumerate(['PIZZA','SLICES','SALADS','DRINKS','GOOD DAYS']):text(t,-2.108,1.55,2.63-k*.215,.166,'schoolBusYellow',.73)
# Freestanding A-board at the corridor edge.
box('A board outer',(.76,1.10,.92),(.13,.74,1.12),'woodWarm',.018)
box('A board chalk',(.836,1.10,.94),(.016,.61,.99),'uiDark',.004)
for k,t in enumerate(['PIZZA','BRINGS','PEOPLE','TOGETHER']):text(t,.852,1.10,1.27-k*.21,.155,'picketWhite',.55)
for y in [.74,1.46]:
    rod('A board front leg',(.82,y,.27),(.76,y,1.51),.027,'woodWarm')
    rod('A board back leg',(.31,y,.27),(.76,y,1.51),.027,'woodWarm')
# Two pendant lamps: origins at the ceiling joint.
for y in [-1.20,.35]:
    lamp=empty('lamp_pizza_'+str(y),(-1.65,y,3.02),interior);protected.append(lamp)
    rod('pendant cord',(-1.65,y,2.37),(-1.65,y,3.04),.018,'uiDark',lamp)
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.18,radius2=.063,depth=.15,location=(-1.65,y,2.31))
    finish(bpy.context.object,'pendant shade','uiDark',.008,lamp)
    cyl('pendant luminous rim',(-1.65,y,2.229),.146,.022,'glow',parent=lamp)

# PHONE REPAIR: wood wall fixtures, blister cards and colorful handset silhouettes.
box('accessories wood back',(-2.20,-3.34,1.79),(.16,1.86,2.14),'woodWarm',.025)
for z in [.93,1.52,2.12,2.67]:box('accessory shelf',(-1.97,-3.34,z),(.52,1.89,.072),'woodWarm',.018)
phone_colors=['survivorRed','policeBlue','backpackTeal','picketWhite','cardiganRose']

def phone(x,y,z,col,height=.24,parent=interior):
    o=box('handset shell',(x,y,z),(.043,height*.50,height),col,.020,parent)
    box('handset screen',(x+.028,y,z+.008),(.009,height*.40,height*.73),'uiDark',.009,parent)
    cyl('handset home',(x+.036,y,z-height*.405),height*.035,.007,'silver','X',parent,12)
    box('handset earpiece',(x+.036,y,z+height*.411),(.007,height*.14,.009),'silver',.002,parent)
    return o
for row in range(3):
    for col in range(6):
        y=-2.61-col*.29;z=1.12+row*.59
        box('blister backing',(-2.078,y,z),(.026,.20,.37),'canvasTan',.012)
        rod('peg hook',(-2.06,y,z+.16),(-1.96,y,z+.16),.009,'silver')
        phone(-2.047,y,z-.015,phone_colors[(row+col)%5],.275)
for col in range(4):phone(-1.99,-2.72-col*.30,2.91,phone_colors[col],.31)
# Repair shelf on right, slogan poster and clock.
for z in [1.48,1.80,2.10]:
    box('repair shelf',(-2.12,-4.41,z),(.29,.51,.055),'woodWarm',.008)
    for k in range(3):phone(-2.10,-4.25-k*.14,z+.102,phone_colors[k],.17)
box('repair poster frame',(-2.23,-5.36,2.07),(.08,1.18,1.35),'woodWarm',.016)
box('repair black poster',(-2.177,-5.36,2.07),(.028,1.10,1.27),'uiDark',.006)
for k,t in enumerate(['FIX','RECONNECT','MOVE','FORWARD']):text(t,-2.151,-5.36,2.52-k*.23,.193,'picketWhite',1.0)
for s in [-1,1]:rod('crossed repair tools',(-2.145,-5.36-s*.07,1.59),(-2.145,-5.36+s*.07,1.73),.014,'schoolBusYellow')
# Counter with recessed showroom niche and separated trim.
box('phone sales counter',(.0,-4.69,.79),(.83,1.94,.91),'picketWhite',.034)
box('counter pink inset',(.436,-4.69,.78),(.025,1.77,.73),'sidewalk',.008)
box('showroom niche',(.456,-4.69,.73),(.018,1.56,.40),'uiDark',.008)
box('niche shelf',(.513,-4.69,.535),(.15,1.57,.038),'picketWhite',.008)
box('counter worktop',(.0,-4.69,1.28),(.98,2.06,.10),'picketWhite',.022)
for y in [-5.51,-3.87]:
    for x in [-.29,.30]:box('counter foot',(x,y,.32),(.075,.075,.16),'uiDark',.013)
for j in range(6):phone(.50,-4.04-j*.25,.74,phone_colors[j%5],.26)
for j in range(4):
    y=-3.98-j*.47
    box('handset display plinth',(.03,y,1.36),(.25,.30,.055),'uiDark',.012)
    phone(.025,y,1.55,phone_colors[j],.33)
    rod('phone support',(-.035,y,1.36),(-.035,y,1.52),.023,'silver')
box('repair terminal',(-.27,-3.94,1.59),(.075,.37,.40),'uiDark',.02)
box('terminal screen',(-.222,-3.94,1.61),(.015,.28,.25),'blueTrim',.009)
for i in range(3):
    for j in range(7):box('terminal key',(-.02+i*.034,-3.83-j*.032,1.372),(.025,.023,.009),'silver',.002)
# stool by right end.
cyl('stool seat',(-.11,-5.93,.79),.23,.10,'blueTrim')
for k in range(4):
    a=k*math.tau/4
    rod('stool leg',(-.11+.19*math.cos(a),-5.93+.19*math.sin(a),.25),(-.11+.14*math.cos(a),-5.93+.14*math.sin(a),.75),.025,'woodWarm')
ring('stool footring',(-.11,-5.93,.44),.175,.018,'silver',axis='Z')

# Three sculpted potted plants: folded leaves use a central ridge and pointed tip.
def plant(x,y,scale=1):
    z=.25
    bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.22*scale,radius2=.30*scale,depth=.47*scale,location=(x,y,z+.235*scale),rotation=(0,0,math.pi/4))
    finish(bpy.context.object,'terracotta pot','woodWarm',.018)
    box('pot rim',(x,y,z+.47*scale),(.47*scale,.47*scale,.08*scale),'woodWarm',.018)
    box('pot soil',(x,y,z+.516*scale),(.39*scale,.39*scale,.017*scale),'leatherShadow',.004)
    for k in range(12):
        a=k*2.399963
        length=(.48+.15*(k%3))*scale
        reach=(.25+.07*(k%4))*scale
        base=Vector((x,y,z+.52*scale))
        end=base+Vector((math.cos(a)*reach,math.sin(a)*reach,length))
        middle=base+Vector((math.cos(a)*reach*.50,math.sin(a)*reach*.50,length*.77))
        side=Vector((-math.sin(a),math.cos(a),0))*.09*scale
        ridge=middle+Vector((0,0,.045*scale))
        verts=[base,middle-side,ridge,middle+side,end]
        mesh=bpy.data.meshes.new('folded leaf');mesh.from_pydata(verts,[],[(0,1,2),(0,2,3),(1,4,2),(2,4,3)])
        obj=bpy.data.objects.new('plant leaf',mesh);scene.collection.objects.link(obj)
        finish(obj,'plant leaf','foliage' if k%2 else 'grass')
        mod=obj.modifiers.new('leaf thickness','SOLIDIFY');mod.thickness=.007*scale
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
        rod('plant stem',base,middle,.010*scale,'grass')
plant(.04,6.27,1.0);plant(.37,-2.04,.84);plant(.56,-6.03,1.05)

# Metadata: static wall and slab collision only, leaving corridor traversable.
for name,loc,size in [('back',(-2.43,0,2.02),(.22,13.1,3.6)),('floor',(0,0,.10),(5.1,13.4,.20))]:
    col=empty('col:'+name,loc,root);col['collider']='cuboid';col['size']=size
# The reference layout uses positive authored Y for the left shop. Bake its
# reflection into geometry so the production asset has positive, applied scales.
# Text is constructed in final coordinates above, preserving legibility.
bpy.context.view_layer.update()
world_matrices={o:o.matrix_world.copy() for o in scene.objects if o.type=='MESH'}
reflection=Matrix.Diagonal((1,-1,1,1))
for o in scene.objects:
    if o.type=='EMPTY':o.location.y *= -1
bpy.context.view_layer.update()
for o,world in world_matrices.items():
    lettering=o.name.startswith('lettering ')
    part=LOD_PARTS.pop(o)
    part['transform']=world if lettering else reflection @ world
    part['lettering']=lettering
    raw=part['mesh']
    world_points=[part['transform'] @ v.co for v in raw.vertices]
    part['diagonal']=math.sqrt(sum((max(v[i] for v in world_points)-min(v[i] for v in world_points))**2 for i in range(3)))
    part['thin']=sorted((max(v.co[i] for v in raw.vertices)-min(v.co[i] for v in raw.vertices))*abs(o.scale[i]) for i in range(3))[1]
    LOD_GROUPS.setdefault((o.parent.name,o.data.materials[0].name),[]).append(part)
    o.data.transform(world if lettering else reflection @ world)
    if not lettering:o.data.flip_normals()
    o.matrix_world=Matrix.Identity(4)

# Join all meshes by material per rigid assembly; animated parts retain joint empties.
for group in protected:
    for mat in M.values():
        objects=[o for o in scene.objects if o.type=='MESH' and o.parent==group and o.data.materials[0]==mat]
        if not objects:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        objects[0].name=group.name+'_'+mat.name
        # Put each assembly origin at its parent's joint for correct animation.
        bpy.context.scene.cursor.location=group.matrix_world.translation
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

for group in protected:
    if any(o.type=='MESH' and any(m.name.startswith('emi_') for m in o.data.materials) for o in group.children):
        anchor=empty('light:'+group.name,parent=group)
        anchor['ss_light']=json.dumps({'type':'area' if group==interior else 'point','color':'light_window_warm',
            'intensity':2.5,'range':4,'pool':True,'beam':'none','flare':False,'reflect':True,
            'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'mini-mall',
            'breakable':group!=interior,'emissiveNodes':[o.name for o in group.children if o.type=='MESH' and any(m.name.startswith('emi_') for m in o.data.materials)],'tiers':'all'})
        if group==interior:anchor.location=(-.45,0,2.72)

meshes=[o for o in scene.objects if o.type=='MESH']
def stats():
    return {'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),
            'draw_calls':sum(len({p.material_index for p in o.data.polygons}) for o in meshes)}
info=stats()
info.update({'id':'int.mini-mall','tier':'Hero','materials':sorted(m.name for m in M.values()),
             'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','interior','roof']),
             'within_budget':info['triangles']<=100000 and info['draw_calls']<=40,
             'mesh_triangles':{o.name:sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes}})
(HERE/'build-stats.json').write_text(json.dumps(info,indent=2))

def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root,*root.children_recursive]:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False,
        export_vertex_color='ACTIVE')

def simple_curve(shape, lod):
    """Closed low-density curves preserve rims and volume without collapse."""
    kind,radius,depth=shape
    if kind=='cylinder':
        count=8 if lod==1 else 6
        vertices=[Vector((radius*math.cos(i*math.tau/count),radius*math.sin(i*math.tau/count),z))
                  for z in [-depth/2,depth/2] for i in range(count)]
        faces=[list(reversed(range(count))),list(range(count,2*count))]
        faces += [[i,(i+1)%count,(i+1)%count+count,i+count] for i in range(count)]
        return vertices,faces
    major=12 if lod==1 else 8;minor=4
    vertices=[];faces=[]
    for i in range(major):
        a=i*math.tau/major
        for j in range(minor):
            b=j*math.tau/minor
            vertices.append(Vector(((radius+depth*math.cos(b))*math.cos(a),
                                    (radius+depth*math.cos(b))*math.sin(a),depth*math.sin(b))))
    for i in range(major):
        for j in range(minor):
            faces.append([i*minor+j,((i+1)%major)*minor+j,
                          ((i+1)%major)*minor+(j+1)%minor,i*minor+(j+1)%minor])
    return vertices,faces


def make_lod(obj,lod):
    """Use unbeveled source parts, closed curves and single-sided sign fronts."""
    vertices=[];faces=[]
    inverse=obj.matrix_world.inverted()
    for part in LOD_GROUPS[(obj.parent.name,obj.data.materials[0].name)]:
        name=part['name'];raw=part['mesh'];transform=part['transform']
        if part['lettering']:
            words={'SUNSET GROVE','LAUNDRY','PIZZA','PHONE REPAIR','CHANGE'}
            if lod==2 or name.removeprefix('lettering ') not in words:continue
        elif obj.parent==interior:
            if part['diagonal'] < (.12 if lod==1 else .45):continue
            if part['thin'] < (.018 if lod==1 else .045):continue
        if lod==2 and (name.startswith(('floor paver','corner paver')) or name in {'drum inner shine','upper drum rim'}):continue
        if part['shape']:
            points,polygons=simple_curve(part['shape'],lod)
        else:
            points=[v.co.copy() for v in raw.vertices]
            polygons=[list(p.vertices) for p in raw.polygons if not part['lettering'] or p.normal.z>.9]
        offset=len(vertices)
        vertices.extend(inverse @ transform @ point for point in points)
        for polygon in polygons:
            if transform.determinant()<0:polygon=list(reversed(polygon))
            faces.append([offset+i for i in polygon])
    if lod==2 and obj.name=='interior_pal_canvasTan':
        start=len(vertices)
        vertices.extend([Vector((x,y,.248)) for x,y in [(-2.535,-6.685),(2.09,-6.685),(2.535,-6.24),
                         (2.535,6.24),(2.09,6.685),(-2.535,6.685)]])
        faces.append(list(range(start,start+6)))
    mesh=bpy.data.meshes.new(obj.name+'_lod'+str(lod))
    mesh.from_pydata(vertices,[],faces);mesh.materials.append(obj.data.materials[0])
    obj.data=mesh

if args.glb:
    # Shared deterministic Cycles vertex AO contract. Bake once, retain it through LODs.
    ao.bake_all(meshes,samples=32)
    export(args.glb)
    # Coarse source primitives keep boxes, floors, signs and rims structurally sound.
    originals={o:o.data for o in meshes}
    lod_stats={}
    for lod in [1,2]:
        for o in meshes:make_lod(o,lod)
        ao.bake_all([o for o in meshes if o.data.polygons],samples=32)
        export(Path(args.glb).with_name('model.lod'+str(lod)+'.glb'))
        lod_stats['lod'+str(lod)]=stats()
        for o in meshes:
            reduced=o.data;o.data=originals[o];bpy.data.meshes.remove(reduced)
    (HERE/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2))

if args.render:
    # Reference studio only; never exported.
    scene.world=bpy.data.worlds.new('warm grey studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.09,.14,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.30
    stage=bpy.data.materials.new('stage');stage.diffuse_color=(.028,.024,.034,1)
    stage.use_nodes=True;stage.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.028,.024,.034,1)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.014));bpy.context.object.data.materials.append(stage)
    def area(name,loc,power,color,size,target=(0,0,1.3)):
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name
        o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size
        o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    area('warm key',(5,2,9),1300,(1,.77,.51),8)
    area('cool fill',(1,-6,7),850,(.60,.69,1),7)
    area('amber rim',(-4,2,7),1350,(1,.57,.30),6)
    # Practical light spill, corresponding to exported warm anchors.
    for y in [-6.39,-2.12,2.12,6.39]:
        area('sconce pool',(-.30,y,2.72),25,(1,.62,.20),.32,(-1.5,y,1.2))
    for y in [-1.20,.35]:area('pendant pool',(-1.65,y,2.20),32,(1,.72,.35),.35,(-1.65,y,.6))
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    target=Vector((0,0,1.70))
    direction=Vector((.96,.23,.34)).normalized()
    if args.view=='game':direction=Vector((.572,-.572,.588)).normalized()
    if args.view=='front':direction=Vector((1,0,.15)).normalized()
    if args.view=='side':direction=Vector((.18,1,.32)).normalized()
    if args.view=='rear':direction=Vector((-1,.32,.32)).normalized()
    cam.location=target+direction*26
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=16.5 if args.view!='game' else 21.0
    scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    scene.cycles.seed=17;scene.cycles.device='CPU'
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.file_format='PNG';scene.render.filepath=args.render
    Path(args.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    if args.view == 'ref':
        cam.location=target+Vector((.572,-.572,.588)).normalized()*26
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=21.0
        scene.cycles.samples=min(args.samples,24)
        scene.render.resolution_x=960;scene.render.resolution_y=540
        output=Path(args.render)
        name='game.png' if output.stem=='hero' else output.stem.replace('-ref','')+'-game.png'
        scene.render.filepath=str(output.with_name(name))
        bpy.ops.render.render(write_still=True)
print('OK '+json.dumps({k:v for k,v in info.items() if k!='mesh_triangles'}))
