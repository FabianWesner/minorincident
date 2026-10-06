"""Sunset Grove food court. Metres, Blender +X front, procedural palette only.
Run through experiment/tools/blender_run.py; exports all three LODs.
"""
import argparse
import json
import math
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
parser.add_argument('--render')
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

# Local u goes right, v faces the open front. World +X is the front.
def xyz(p):
    return Vector((p[1], p[0], p[2]))

def empty(name, loc=(0,0,0), parent=None):
    ob = bpy.data.objects.new(name, None)
    scene.collection.objects.link(ob)
    ob.location = xyz(loc)
    ob.parent = parent
    return ob

root = empty('root')
root['asset_id'] = 'int.food-court'
root['category'] = 'building'
root['forward'] = '+X'
root['town'] = 'Sunset Grove'
interior = empty('interior', parent=root)
roof = empty('roof', parent=root)
roof['cutaway'] = True
roof['description'] = 'Open roof boundary; hideable architecture anchor'
static = []
coarse = {}
# Preserve closed silhouettes and broad planes in the distance models.
STRUCTURE = {
    'Rear wall','Right wall','Rear wainscot','Right wainscot','Rear moulding','Side moulding',
    'Roof rear coping','Roof side coping','Pilaster','Pilaster base','Pilaster capital',
    'Side pilaster','Side pilaster base','Side pilaster capital','Counter toe kick',
    'Counter worktop','Prep cabinetry','Prep worktop','Cafe tabletop','Table edge underside',
    'Chair cushion','Chair seat frame','Chair back cushion','Planter box','Planter soil',
    'Planter long rim','Planter short rim','Waste bin shell','Tray island plinth',
    'Tray island cabinet','Tray island top','Inset serving front','Menu board face','Menu board frame'
}

M = {}
def mat(token):
    if token not in M:
        M[token] = palette.mat(token.replace('emi_', ''), emissive=token.startswith('emi_'))
        bs = M[token].node_tree.nodes['Principled BSDF']
        bs.inputs['Roughness'].default_value = .63
        if token == 'silver':
            bs.inputs['Metallic'].default_value = .55
            bs.inputs['Roughness'].default_value = .32
        if token.startswith('emi_'):
            bs.inputs['Emission Strength'].default_value = 2.2
    return M[token]

OWNER = interior

def finish(ob, name, token, bevel=0):
    ob.name = name
    ob.data.materials.append(mat(token))
    ob.parent = OWNER
    if bevel:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2 if bevel >= .035 else 1, affect='EDGES')
        bm.normal_update()
        bm.to_mesh(ob.data)
        bm.free()
    static.append(ob)
    return ob

def box(name, p, size, token, bevel=.025, angle=0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for vert in bm.verts:
        vert.co.x *= size[1]
        vert.co.y *= size[0]
        vert.co.z *= size[2]
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    ob.location = xyz(p)
    ob.rotation_euler.z = angle
    if name in STRUCTURE or name.startswith('sconce_') or any(name.endswith(suffix) for suffix in (' fascia',' sign',' service base',' alcove')):
        coarse[ob] = mesh.copy()
    return finish(ob, name, token, min(bevel, min(size)*.24))

def cyl(name, p, radius, depth, token, vertices=16, direction=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=vertices, radius1=radius, radius2=radius, depth=depth)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    ob.location = xyz(p)
    if name=='Lantern gold cap': coarse[ob]=mesh.copy()
    if name in ('Splayed chair leg','Table pedestal','Pedestal foot'):
        support=bpy.data.meshes.new('Distance furniture support')
        r=radius; h=depth/2
        support.from_pydata([(r,0,h),(-r,0,h),(-r,0,-h),(r,0,-h),
                             (0,r,h),(0,-r,h),(0,-r,-h),(0,r,-h)],[],
                            [(0,1,2,3),(4,5,6,7)])
        coarse[ob]=support
    if direction:
        ob.rotation_euler = xyz(direction).to_track_quat('Z','Y').to_euler()
    return finish(ob, name, token, .008 if radius > .065 else 0)

def rod(name, a, b, radius, token, vertices=10):
    mid = tuple((a[i]+b[i])/2 for i in range(3))
    delta = tuple(b[i]-a[i] for i in range(3))
    return cyl(name, mid, radius, Vector(delta).length, token, vertices, delta)

def sphere(name, p, scale, token, seg=16, rings=8):
    bm=bmesh.new()
    bmesh.ops.create_uvsphere(bm,u_segments=seg,v_segments=rings,radius=1)
    for vert in bm.verts:
        vert.co.x*=scale[1]; vert.co.y*=scale[0]; vert.co.z*=scale[2]
    mesh=bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
    ob=bpy.data.objects.new(name,mesh); scene.collection.objects.link(ob)
    ob.location=xyz(p)
    if name=='Red lantern':
        low=bmesh.new(); bmesh.ops.create_uvsphere(low,u_segments=6,v_segments=3,radius=1)
        for vert in low.verts:
            vert.co.x*=scale[1]; vert.co.y*=scale[0]; vert.co.z*=scale[2]
        data=bpy.data.meshes.new('Distance lantern'); low.to_mesh(data); low.free()
        coarse[ob]=data
    for f in ob.data.polygons: f.use_smooth=True
    return finish(ob,name,token)

def text(name, body, p, size, token, maxwidth=None):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=body
    curve.align_x='CENTER'
    curve.align_y='CENTER'
    curve.size=size
    curve.extrude=.005
    curve.bevel_depth=.0015
    curve.bevel_resolution=1
    curve.resolution_u=3
    ob=bpy.data.objects.new(name,curve)
    scene.collection.objects.link(ob)
    ob.location=xyz(p)
    # Text's local +Y is Z up and its front normal is world +X.
    ob.rotation_euler=(math.pi/2,0,math.pi/2)
    bpy.context.view_layer.update()
    if maxwidth and ob.dimensions.y>maxwidth:
        ob.scale.x*=maxwidth/ob.dimensions.y
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active=ob
    bpy.ops.object.convert(target='MESH')
    return finish(ob,name,token)

def panel(name, u, v, z, w, h, token):
    box(name+' frame',(u,v,z),(w,.12,h),'woodWarm',.025)
    box(name+' face',(u,v+.069,z),(w-.10,.022,h-.10),token,.008)

# Tiled plinth, two enclosing walls and pilasters.
# Front corner chamfers follow the reference's open diorama footprint.
outline=[(-6.35,-5.05),(6.35,-5.05),(6.35,3.95),(5.25,5.05),(-5.25,5.05),(-6.35,3.95)]
verts=[xyz((u,v,z)) for z in (0,.28) for u,v in outline]
faces=[tuple(range(6)),tuple(reversed(range(6,12)))]
faces += [(i+6,(i+1)%6+6,(i+1)%6,i) for i in range(6)]
mesh=bpy.data.meshes.new('Chamfered foundation'); mesh.from_pydata(verts,[],faces)
ob=bpy.data.objects.new('Foundation',mesh); scene.collection.objects.link(ob)
coarse[ob]=mesh.copy()
finish(ob,'Foundation','trouserViolet',.04)
for i in range(16):
    for j in range(13):
        token='canvasTan' if (i*7+j*3)%13 else 'sidewalk'
        tile=box('Ceramic floor tile',(-5.94+i*.79,-4.68+j*.77,.30),(.775,.755,.065),token,0)
        u=-5.94+i*.79; v=-4.68+j*.77
        if abs(u)+v+.78>10.30:
            bm=bmesh.new(); bm.from_mesh(tile.data)
            for side in (-1,1):
                cut=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,
                    plane_co=xyz((side*5.8-u,4.5-v,0)),plane_no=xyz((side,1,0)),clear_outer=True)
                edges=[edge for edge in cut['geom_cut'] if isinstance(edge,bmesh.types.BMEdge)]
                if edges: bmesh.ops.holes_fill(bm,edges=edges,sides=0)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            bm.normal_update(); bm.to_mesh(tile.data); bm.free()
            if not tile.data.polygons:
                static.remove(tile); bpy.data.objects.remove(tile,do_unlink=True)
        if tile in static:
            # Floor planes are supported by the intact foundation below.
            top=bpy.data.meshes.new('Distance ceramic tile')
            top.from_pydata([vert.co[:] for vert in tile.data.vertices],[],
                [tuple(face.vertices) for face in tile.data.polygons if face.normal.z>.9])
            coarse[tile]=top
box('Rear wall',(0,-4.78,2.55),(12.6,.28,4.5),'canvasTan',.035)
box('Right wall',(6.15,-.465,2.556),(.28,8.72,4.5),'canvasTan',.035)
box('Rear wainscot',(0,-4.60,.77),(12.6,.10,.86),'khaki',.025)
box('Right wainscot',(5.98,-.465,.78),(.10,8.72,.86),'khaki',.025)
for z in (.38,1.22,4.66):
    box('Rear moulding',(0,-4.57,z),(12.6,.13,.10),'brass',.012)
    box('Side moulding',(5.94,-.465,z+.008),(.13,8.72,.10),'brass',.012)
for i in range(25):
    box('Rear cornice brick',(-6+i*.50,-4.55,4.45),(.48,.16,.22),'woodWarm',.01)
for i in range(17):
    box('Side cornice brick',(5.94,-4.45+i*.5,4.45),(.16,.48,.22),'khaki',.01)
OWNER=roof
box('Roof rear coping',(0,-4.78,4.82),(12.8,.48,.16),'trouserViolet',.035)
box('Roof side coping',(6.15,-.465,4.835),(.48,9.0,.16),'trouserViolet',.035)
OWNER=interior
for u in (-6,-1.0,5.3):
    box('Pilaster',(u,-4.51,2.50),(.48,.50,4.50),'trouserViolet',.03)
    for a in (-.17,0,.17):
        box('Pilaster fluting',(u+a,-4.25,2.65),(.025,.018,3.65),'trouserViolet',.005)
    box('Pilaster base',(u,-4.50,.59),(.57,.57,.48),'trouserViolet',.02)
    box('Pilaster capital',(u,-4.51,4.81),(.70,.69,.16),'trouserViolet',.03)

# Sconce assemblies have independent pivots; emissive panes are owned by them.
def sconce(name,u,v,z):
    pivot=empty('lamp_'+name,(u,v,z),root)
    pivot['joint']='wall attachment'
    bpy.context.view_layer.update()
    # Meshes are built in world coordinates, then reparented preserving their matrices.
    start=len(static)
    box(name+' back',(u,v,z),(.23,.10,.77),'brass',.02)
    box(name+' brass housing',(u,v+.075,z),(.22,.13,.71),'brass',.02)
    pane=box(name+' glowing pane',(u,v+.148,z),(.15,.028,.58),'emi_windowGlow',.015)
    for dz in (-.35,.35): box(name+' cap',(u,v+.09,z+dz),(.26,.17,.07),'brass',.01)
    for ob in static[start:]:
        ob.parent=pivot
        ob.matrix_parent_inverse=pivot.matrix_world.inverted()
    anchor=empty('light:'+name,(u,v+.30,z),root)
    anchor['ss_light']=json.dumps({'type':'point','color':'light_window_warm','intensity':2.5,'range':3.5,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'mall','breakable':True,'emissiveNodes':[pane.name],'tiers':'all'})
for n,u in enumerate((-6,-1.0,5.3)): sconce('sconce_'+str(n),u,-4.20,3.29)
# Right-wall dividing column and lamp, facing into the room.
for v in (.42,3.80):
    box('Side pilaster',(5.96,v,2.50),(.50,.48,4.50),'trouserViolet',.03)
    box('Side pilaster base',(5.94,v,.59),(.58,.58,.48),'trouserViolet',.02)
    box('Side pilaster capital',(6.02,v,4.81),(.68,.70,.16),'trouserViolet',.03)
sconce('sconce_side',0,0,3.29)
side_lamp=bpy.data.objects['lamp_sconce_side']
side_lamp.location=xyz((5.68,.42,3.29))
side_lamp.rotation_euler.z=-math.pi/2
bpy.data.objects['light:sconce_side'].location=xyz((5.38,.42,3.29))


# Generic detailed fast-food stalls. All equipment is solid geometry.
def condiment(u,v,z):
    box('Condiment caddy',(u,v,z+.035),(.29,.22,.07),'uiDark',.015)
    for d,token,h in [(-.085,'survivorRed',.23),(0,'picketWhite',.27),(.085,'schoolBusYellow',.20)]:
        cyl('Sauce bottle',(u+d,v,z+h/2+.08),.038,h,token,12)
        cyl('Bottle nozzle',(u+d,v,z+h+.10),.014,.07,'picketWhite',10)

def register(u,v,z):
    box('Till base',(u,v,z+.04),(.39,.29,.08),'uiDark',.03)
    box('Till foot',(u,v-.03,z+.13),(.12,.11,.16),'silver',.015)
    screen=box('POS terminal',(u,v-.02,z+.26),(.36,.06,.24),'uiDark',.018)
    screen.rotation_euler.y=-.17
    box('POS screen inset',(u,v+.021,z+.26),(.30,.014,.18),'denimBlue',.004)
    box('POS status',(u+.10,v+.033,z+.20),(.055,.008,.015),'foliage',.002)

# Text and icon reliefs are at least 8 mm clear of underlying sign faces.
def burger_icon(u,v,z):
    sphere('Burger upper bun',(u,v,z+.14),(.37,.033,.18),'uiDark')
    box('Burger patty',(u,v,z-.015),(.70,.052,.10),'uiDark',.04)
    box('Burger cheese',(u,v+.012,z+.06),(.66,.048,.035),'schoolBusYellow',.015)
    sphere('Burger lower bun',(u,v,z-.13),(.35,.034,.095),'uiDark')
    for d in (-.17,0,.17): sphere('Sesame seed',(u+d,v+.035,z+.18),(.024,.008,.009),'schoolBusYellow',8,4)

def menu(u,v,z,w=.65):
    panel('Menu board',u,v,z,w,.66,'emi_windowGlow')
    box('Menu header',(u,v+.086,z+.23),(w-.16,.012,.065),'survivorRed',.003)
    for row in range(6):
        zz=z+.13-row*.07
        box('Menu item',(u-.10,v+.09,zz),(w*.36,.01,.022),'brick',.002)
        box('Menu price',(u+w*.28,v+.09,zz),(.07,.01,.022),'brick',.002)

STALL_PARTS=[]
def stall(u,v,w,label,color):
    start=len(static)
    # Back tiled backsplash.
    box(label+' alcove',(u,v-.63,2.09),(w,.11,2.02),'khaki',.02)
    for i in range(int(w/.40)):
        for j in range(4):
            box('Backsplash tile',(u-w/2+.22+i*.4,v-.56,1.40+j*.32),(.38,.024,.30),'bandage',.004)
    box(label+' fascia',(u,v-.40,3.77),(w+.08,.25,.99),'woodWarm',.025)
    box(label+' sign',(u,v-.253,3.77),(w-.07,.025,.80),color,.01)
    text(label+' lettering',label,(u+.34,v-.226,3.78),.54,'picketWhite' if color!='canvasTan' else 'uiDark',w-1.12)
    if label=='BURGER': burger_icon(u-w/2+.52,v-.214,3.75)
    elif label=='ASIAN KITCHEN':
        sphere('Bowl icon',(u-w/2+.50,v-.214,3.65),(.31,.022,.16),'picketWhite')
        rod('Chopstick',(u-w/2+.43,v-.185,3.74),(u-w/2+.69,v-.185,4.08),.017,'picketWhite')
        rod('Chopstick',(u-w/2+.51,v-.185,3.74),(u-w/2+.77,v-.185,4.10),.017,'picketWhite')
    else:
        sphere('Taco icon',(u-w/2+.50,v-.214,3.73),(.37,.035,.25),'schoolBusYellow')
        for k in range(6):
            a=math.pi*k/5
            sphere('Taco lettuce',(u-w/2+.50+.32*math.cos(a),v-.19,3.73+.23*math.sin(a)),(.065,.024,.07),'foliage',8,4)
    for i in range(3): menu(u+(i-1)*w*.235,v-.35,2.99,w*.215)
    box(label+' service base',(u,v+.24,.90),(w,.80,1.12),'woodWarm',.025)
    for i in range(int(w/.25)):
        box('Counter timber slat',(u-w/2+.13+i*.25,v+.65,.91),(.23,.03,1.02),'woodWarm',.008)
    box('Counter toe kick',(u,v+.66,.39),(w,.05,.12),'uiDark',.01)
    box('Counter worktop',(u,v+.29,1.51),(w+.15,1.08,.13),'picketWhite',.025)
    box('Counter front trim',(u,v+.842,1.45),(w+.08,.035,.055),'brass',.008)
    # Stainless prep bench, appliance oven and range behind.
    box('Prep cabinetry',(u,v-.34,.94),(w-.18,.40,1.13),'silver',.025)
    box('Prep worktop',(u,v-.32,1.54),(w-.08,.52,.10),'silver',.018)
    for off in (-w*.30,0,w*.30):
        box('Cabinet inset',(u+off,v-.095,.94),(.60,.018,.83),'hairSilver',.01)
        rod('Cabinet handle',(u+off-.10,v-.077,1.23),(u+off+.10,v-.077,1.23),.017,'uiDark')
    box('Griddle',(u-.62,v-.32,1.69),(.77,.41,.24),'silver',.025)
    box('Griddle dark top',(u-.62,v-.32,1.82),(.64,.34,.027),'uiDark',.01)
    for dx in (-.23,0,.23): cyl('Range control',(u-.62+dx,v-.086,1.68),.025,.026,'uiDark',12,(0,1,0))
    box('Oven',(u+.71,v-.30,1.84),(.70,.46,.56),'silver',.025)
    box('Oven inset',(u+.71,v-.054,1.79),(.53,.026,.29),'uiDark',.008)
    box('Oven window',(u+.71,v-.035,1.79),(.42,.014,.19),'denim',.006)
    rod('Oven pull',(u+.53,v+.002,1.94),(u+.88,v+.002,1.94),.019,'silver')
    cyl('Oven dial',(u+.94,v-.04,2.02),.027,.025,'uiDark',12,(0,1,0))
    # Hood and fascia vents sit apart from backsplash.
    box('Extraction hood',(u-.57,v-.41,2.52),(.81,.34,.34),'silver',.025)
    for i in range(5): box('Hood vent',(u-.85+i*.14,v-.225,2.52),(.07,.014,.13),'uiDark',.003)
    register(u-w*.29,v+.55,1.58)
    condiment(u-w*.43,v+.48,1.58)
    condiment(u+w*.40,v+.48,1.58)
    # Food trays, burger stack, fry box and paper cups.
    for off in (-.45,.08,.57):
        box('Serving tray',(u+off,v+.26,1.59),(.43,.32,.03),'survivorRed',.012)
        box('Tray liner',(u+off,v+.26,1.611),(.35,.25,.008),'canvasTan',.004)
        sphere('Food bun',(u+off,v+.25,1.66),(.12,.10,.055),'corgiOrange',12,6)
    box('Fries carton',(u+w*.32,v+.05,1.76),(.22,.20,.31),'survivorRed',.015)
    for i in range(7):
        box('Golden fries',(u+w*.32-.08+(i%4)*.05,v+.01+(i//4)*.07,1.99),(.035,.035,.22+(i%3)*.025),'schoolBusYellow',.007)
    # Central sneeze guard: slim posts and a translucent-free open rail frame.
    if label=='ASIAN KITCHEN':
        for off in (-w*.35,w*.35):
            rod('Serving screen post',(u+off,v+.38,1.59),(u+off,v+.38,2.26),.026,'brass')
        rod('Serving screen rail',(u-w*.35,v+.38,2.26),(u+w*.35,v+.38,2.26),.025,'silver')
        box('Inset serving front',(u,v+.70,.94),(w*.57,.055,.92),'trouserViolet',.022)
        for off in (-w*.15,w*.15):
            box('Serving door inset',(u+off,v+.735,.94),(w*.27,.02,.80),'hairSilver',.009)
            cyl('Serving door knob',(u+off+.13,v+.755,1.21),.024,.025,'brass',12,(0,1,0))
    # Purposeful equipment detail for close views: soda fountain and fryer.
    su=u-w*.36
    box('Drink dispenser body',(su,v-.32,1.94),(.57,.37,.72),'silver',.025)
    box('Drink dispenser face',(su,v-.118,1.99),(.47,.025,.44),'uiDark',.008)
    box('Drip tray',(su,v-.005,1.60),(.56,.40,.055),'uiDark',.012)
    for i in range(3):
        dx=(i-1)*.145
        box('Drink flavor label',(su+dx,v-.098,2.10),(.10,.016,.13),['survivorRed','schoolBusYellow','tealDark'][i],.006)
        rod('Drink nozzle',(su+dx,v-.052,1.89),(su+dx,v-.052,1.80),.018,'uiDark')
        box('Drip grate',(su+dx,v+.015,1.637),(.05,.25,.012),'silver',.002)
    cyl('Drink paper cup',(su+.18,v+.10,1.78),.061,.25,'picketWhite',12)
    cyl('Cup lid',(su+.18,v+.10,1.911),.066,.018,'picketWhite',12)
    rod('Cup straw',(su+.18,v+.10,1.92),(su+.18,v+.10,2.08),.008,'survivorRed',6)
    fu=u+w*.33
    box('Fryer steel basin',(fu,v-.31,1.68),(.64,.40,.25),'silver',.025)
    box('Fryer dark oil inset',(fu,v-.31,1.813),(.51,.31,.025),'uiDark',.005)
    for i in range(5):
        rod('Fryer basket wire',(fu-.22+i*.11,v-.44,1.84),(fu-.22+i*.11,v-.17,1.84),.008,'silver',6)
    for i in range(4):
        rod('Fryer cross wire',(fu-.22,v-.44+i*.09,1.852),(fu+.22,v-.44+i*.09,1.852),.008,'silver',6)
    rod('Basket handle',(fu,v-.17,1.85),(fu,v+.08,2.02),.020,'silver',8)
    box('Basket insulated grip',(fu,v+.08,2.03),(.21,.07,.07),'uiDark',.015)
    for dx in (-.18,.18): cyl('Fryer temperature knob',(fu+dx,v-.09,1.70),.025,.026,'uiDark',12,(0,1,0))
    for off in (-.45,.08,.57):
        cyl('Burger patty',(u+off,v+.25,1.685),.108,.035,'leather',12)
        box('Burger cheese slice',(u+off,v+.25,1.709),(.20,.18,.017),'schoolBusYellow',.003)
        sphere('Burger top bun',(u+off,v+.25,1.75),(.12,.10,.044),'corgiOrange',12,6)
    if label=='ASIAN KITCHEN':
        for h in (1.59,1.70,1.81):
            cyl('Bamboo steamer rim',(u,v-.32,h),.24,.08,'woodWarm',16)
            cyl('Bamboo steamer inset',(u,v-.32,h+.045),.20,.018,'canvasTan',16)
        cyl('Steamer lid knob',(u,v-.32,1.88),.035,.05,'woodWarm',12)
        rod('Kitchen shelf',(u-.8,v-.56,2.27),(u+.8,v-.56,2.27),.023,'silver',12)
    STALL_PARTS.append(static[start:])

stall(-3.13,-3.84,3.98,'BURGER','canvasTan')
stall(2.11,-3.84,5.70,'ASIAN KITCHEN','redDark')
# Taco stall is authored facing forward, then rotated onto the right enclosing wall.
stall(2.0,-3.84,3.37,'TACOS','tealDark')
# Transform the taco assembly into the right-wall coordinate frame.
# u'=5.70-(v+3.84), v'=-2.25+(u-2.0)
for ob in STALL_PARTS[-1]:
    u=ob.location.y; v=ob.location.x
    ob.location=xyz((5.70-(v+3.84),-2.25+(u-2.0),ob.location.z))
    ob.rotation_euler.z-=math.pi/2

# Oriental lanterns: red lobed forms, gold ribs, pole and hanging joint.
def lantern(name,u,v,z):
    pivot=empty(name,(u,v,z+.65),root)
    bpy.context.view_layer.update()
    start=len(static)
    rod('Lantern hanging stem',(u,v,z+.36),(u,v,z+.65),.018,'brass')
    sphere('Red lantern',(u,v,z),(.23,.23,.31),'survivorRed',20,10)
    for k in range(8):
        a=2*math.pi*k/8
        pts=[]
        for j in range(9):
            t=math.pi*j/8
            pts.append((u+.237*math.sin(t)*math.cos(a),v+.237*math.sin(t)*math.sin(a),z+.31*math.cos(t)))
        for a1,b1 in zip(pts,pts[1:]): rod('Lantern gold rib',a1,b1,.009,'brass',6)
    for dz in (-.31,.31): cyl('Lantern gold cap',(u,v,z+dz),.08,.06,'brass',12)
    rod('Lantern tassel',(u,v,z-.32),(u,v,z-.52),.022,'brass')
    for ob in static[start:]:
        ob.parent=pivot; ob.matrix_parent_inverse=pivot.matrix_world.inverted()
    pivot['joint']='top suspension'
lantern('lamp_lantern_left',-.17,-3.39,2.65)
lantern('lamp_lantern_right',4.34,-3.39,2.65)
lantern('lamp_lantern_taco',5.32,-.90,2.70)

# Left end poster in actual remaining wall space.
panel('Community poster',-5.44,-4.16,2.60,.60,1.35,'trouserViolet')
text('Poster motto','GOOD\nFOOD\nSTRONGER\nPEOPLE',(-5.44,-4.065,2.60),.145,'picketWhite',.51)
for du in (-.25,.25):
    for dz in (-.57,.57): cyl('Poster brass screw',(-5.44+du,-4.045,2.60+dz),.013,.016,'brass',8,(0,1,0))
# Right wall town lettering, authored flat then turned toward the interior.
start=len(static)
text('Town mural','SUNSET\nGROVE\nSTRONGER\nTOGETHER',(0,0,2.51),.36,'uiDark',1.78)
sphere('Mural sun',(0,.005,3.65),(.25,.02,.16),'orange')
for k in range(7):
    a=math.pi*k/6
    rod('Mural ray',(.32*math.cos(a),.01,3.65+.30*math.sin(a)),(.43*math.cos(a),.01,3.65+.42*math.sin(a)),.018,'orange')
for ob in static[start:]:
    u=ob.location.y; v=ob.location.x
    ob.location=xyz((5.965-v,2.40+u,ob.location.z))
    ob.rotation_euler.z-=math.pi/2

# Tables and stackable padded chairs, with tapered splayed legs and exposed frames.
def chair(u,v,angle,color):
    start=len(static)
    box('Chair cushion',(0,0,.86),(.54,.53,.11),color,.04)
    box('Chair seat frame',(0,0,.79),(.56,.55,.05),'uiDark',.015)
    box('Chair back cushion',(0,-.25,1.16),(.54,.095,.49),color,.04)
    for du in (-.22,.22):
        rod('Chair back upright',(du,-.245,.74),(du,-.245,1.41),.025,'uiDark')
    for du in (-.21,.21):
        for dv in (-.20,.20):
            rod('Splayed chair leg',(du,dv,.79),(du*1.20,dv*1.30,.34),.028,'uiDark')
    for ob in static[start:]:
        x,y=ob.location.x,ob.location.y
        ob.location=xyz((u,v,0))+Vector((x*math.cos(angle)-y*math.sin(angle),x*math.sin(angle)+y*math.cos(angle),ob.location.z))
        ob.rotation_euler.z+=angle

def table(u,v,color):
    box('Cafe tabletop',(u,v,1.21),(1.52,1.27,.12),'picketWhite',.05)
    box('Table edge underside',(u,v,1.14),(1.42,1.17,.05),'silver',.015)
    cyl('Table pedestal',(u,v,.75),.062,.78,'uiDark',12)
    for du,dv in [(-.55,0),(.55,0),(0,-.44),(0,.44)]:
        rod('Pedestal foot',(u,v,.37),(u+du,v+dv,.37),.034,'uiDark')
    condiment(u,v,1.28)
    chair(u,v-.96,0,color)
    chair(u,v+.96,math.pi,color)
    chair(u-.98,v,-math.pi/2,color)
    chair(u+.98,v,math.pi/2,color)

table(-3.74,-.43,'schoolBusYellow')
table(.46,-1.26,'survivorRed')
table(-1.49,1.48,'schoolBusYellow')
table(3.67,.84,'denimBlue')
table(1.43,3.20,'survivorRed')

# Timber planters, soil, and chunky arching pointed leaves.
def leaf(u,v,z,angle,length,token):
    verts=[]
    for t in (0,.25,.5,.75,1):
        radial=.02+length*.80*t
        zz=z+length*(2.5*t-1.5*t*t)
        width=length*.115*math.sin(math.pi*t)+.009
        center=Vector((u+radial*math.cos(angle),v+radial*math.sin(angle),zz))
        side=Vector((-math.sin(angle)*width,math.cos(angle)*width,0))
        for p in (center-side,center+Vector((0,0,.025)),center+side): verts.append(xyz(p))
    faces=[]
    for k in range(4):
        i=k*3
        faces.extend([(i,i+3,i+4,i+1),(i+1,i+4,i+5,i+2)])
    me=bpy.data.meshes.new('Leaf folded mesh'); me.from_pydata(verts,[],faces)
    ob=bpy.data.objects.new('Pointed planter leaf',me); scene.collection.objects.link(ob)
    finish(ob,ob.name,token)
    so=ob.modifiers.new('Leaf thickness','SOLIDIFY'); so.thickness=.014
    bpy.context.view_layer.objects.active=ob; bpy.ops.object.modifier_apply(modifier=so.name)
    blade=bpy.data.meshes.new('Distance leaf')
    blade.from_pydata([verts[i] for i in (1,6,8,13)],[],[(0,1,3),(0,3,2)])
    coarse[ob]=blade

def planter(u,v,w,d):
    box('Planter box',(u,v,.67),(w,d,.64),'woodWarm',.035)
    box('Planter soil',(u,v,1.00),(w-.13,d-.13,.07),'leather',.01)
    for side in (-1,1):
        box('Planter long rim',(u,v+side*(d/2-.02),1.06),(w+.09,.12,.13),'brass',.015)
        box('Planter short rim',(u+side*(w/2-.02),v,1.06),(.12,d-.16,.13),'woodWarm',.015)
    for i in range(int(w/.22)):
        for side in (-1,1): box('Planter vertical board',(u-w/2+.12+i*.22,v+side*(d/2+.008),.67),(.20,.025,.54),'woodWarm',.006)
    count=max(1,int(w/.55))
    for i in range(count):
        pu=u-w*.35+(w*.70*i/max(1,count-1))
        for k in range(9): leaf(pu,v,1.04,k*2.399+i*.37,.40+(k%3)*.13,'foliage' if k%2 else 'grass')
        for k in range(3): leaf(pu,v,1.04,k*2.10+.5,.62,'foliage')
planter(-2.72,-1.82,1.86,.66)
planter(3.37,2.04,2.02,.68)
planter(-.92,3.95,1.90,.68)
planter(-5.38,1.68,1.03,.61)
planter(5.48,3.39,.56,.56)

# Recessed-mouth litter bins, tray stacks, napkin dispensers and return islands.
def bin_(u,v):
    box('Waste bin shell',(u,v,.82),(.49,.51,.91),'trouserViolet',.035)
    box('Bin front inset',(u,v+.263,.80),(.37,.018,.69),'hairSilver',.008)
    # Open rim made from four separate strips, with a lowered black cavity.
    box('Bin cavity',(u,v,1.28),(.36,.36,.018),'uiDark',.005)
    for du in (-.22,.22): box('Bin side lip',(u+du,v,1.31),(.07,.55,.08),'trouserViolet',.012)
    for dv in (-.24,.24): box('Bin front lip',(u,v+dv,1.31),(.37,.07,.08),'trouserViolet',.012)
    box('Bin handle inset',(u,v+.279,1.10),(.17,.016,.065),'uiDark',.012)
    text('Bin label','WASTE',(u,v+.292,.89),.065,'picketWhite',.23)

def trays(u,v,z,color):
    for i in range(6):
        box('Stacked return tray',(u,v,z+i*.034),(.43,.33,.026),color,.009)
        for dv in (-.145,.145): box('Tray raised rim',(u,v+dv,z+.018+i*.034),(.41,.028,.016),color,.003)

def island(u,v):
    box('Tray island plinth',(u,v,.40),(1.85,.72,.13),'uiDark',.02)
    box('Tray island cabinet',(u,v,.84),(1.77,.69,.80),'teeLavender',.03)
    for du in (-.83,.83): box('Tray island corner trim',(u+du,v+.365,.84),(.055,.025,.79),'trouserViolet',.008)
    box('Tray island top',(u,v,1.30),(1.98,.86,.12),'picketWhite',.03)
    box('Tray return recess',(u+.59,v,1.367),(.43,.41,.017),'uiDark',.005)
    text('Tray return lettering','TRAYS\nHERE',(u,v+.365,.83),.255,'uiDark',1.04)
    trays(u-.46,v,1.38,'redDark')
    trays(u+.02,v+.02,1.38,'uiDark')
    box('Napkin dispenser',(u+.62,v-.19,1.52),(.25,.18,.27),'silver',.018)
    box('Napkin slot',(u+.62,v-.087,1.59),(.17,.015,.035),'uiDark',.003)
    condiment(u-.72,v-.19,1.37)
    bin_(u-1.22,v)
    bin_(u+1.22,v)
island(-4.70,3.16)
island(4.50,4.02)
bin_(.49,-3.42)
bin_(5.12,-.36)

# Collider empties are metadata only: floor and two boundaries.
for name,p,size in [('floor',(0,0,.15),(12.7,10.1,.30)),('rear-wall',(0,-4.78,2.55),(12.6,.28,4.50)),('side-wall',(6.15,-.465,2.55),(.28,8.72,4.50))]:
    col=empty('col:'+name,p,root)
    col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[size[1],size[0],size[2]]

# Capture coarse structure in each assembly's coordinates before joining.
bpy.context.view_layer.update()
coarse_groups={'.lod1':{},'.lod2':{}}
far_omit={'Prep cabinetry','Prep worktop','Table edge underside','Chair seat frame',
          'Planter long rim','Planter short rim','Counter toe kick','Pilaster base',
          'Pilaster capital','Side pilaster base','Side pilaster capital'}
for ob,data in coarse.items():
    group=ob.vertex_groups.new(name='LOD_structure')
    group.add(list(range(len(ob.data.vertices))),1,'REPLACE')
    key=(ob.parent.name,ob.data.materials[0].name)
    transform=ob.parent.matrix_world.inverted() @ ob.matrix_world
    data.calc_loop_triangles()
    for level in ('.lod1','.lod2'):
        if level=='.lod2' and (ob.name.split('.')[0] in far_omit or ob.name.startswith('Ceramic floor tile')):
            continue
        verts,faces=coarse_groups[level].setdefault(key,([],[]))
        start=len(verts)
        verts.extend(transform @ vert.co for vert in data.vertices)
        faces.extend(tuple(start+i for i in tri.vertices) for tri in data.loop_triangles)
# At distance, one intact floor plane replaces the individual ceramic tiles.
key=('interior','pal_canvasTan')
verts,faces=coarse_groups['.lod2'].setdefault(key,([],[]))
start=len(verts)
verts.extend(xyz((u,v,.3325)) for u,v in outline)
faces.extend((start,start+i+1,start+i) for i in range(1,5))

# Join by palette material inside each rigid assembly; lamps remain independent.
bpy.context.view_layer.update()
for ob in static:
    bpy.context.view_layer.objects.active=ob
    for mod in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
groups={}
for ob in static:
    groups.setdefault((ob.parent.name,ob.data.materials[0].name),[]).append(ob)
meshes=[]
for (owner,material),objects in sorted(groups.items()):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects: ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    ob=bpy.context.object
    ob.name=owner+'_'+material
    meshes.append(ob)
    if owner=='interior' and material.startswith('emi_'): ob['decorativeEmissive']=True
# Runtime anchors reference merged emissive pane nodes.
for anchor in [o for o in root.children_recursive if 'ss_light' in o]:
    data=json.loads(anchor['ss_light'])
    lamp=bpy.data.objects.get('lamp_'+anchor.name.split(':')[1])
    data['emissiveNodes']=[o.name for o in lamp.children if o.type=='MESH' and o.data.materials[0].name.startswith('emi_')]
    anchor['ss_light']=json.dumps(data)

def statistics(objects=None):
    triangles=0
    objects = meshes if objects is None else objects
    objects = [ob for ob in objects if len(ob.data.polygons)]
    for ob in objects:
        ob.data.calc_loop_triangles()
        triangles+=len(ob.data.loop_triangles)
    return {'triangles':triangles,'draw_calls':len(objects),'materials':sorted({o.data.materials[0].name for o in objects})}

print('OK base statistics '+json.dumps(statistics()))

if args.glb:
    # True deterministic AO, baked before simplification and carried as COLOR_0.
    ao.bake_all(meshes,samples=32)
    # Wall corner samples can be fully occluded by trim. Keep the baked
    # contact contrast without blacking out an entire interpolated panel.
    for ob in meshes:
        for color in ob.data.color_attributes['ao'].data:
            value=color.color
            color.color=(.55+.45*value[0], .55+.45*value[1], .55+.45*value[2], 1)
    originals={ob:ob.data for ob in meshes}
    stats={}
    for suffix,ratio in [('',1),('.lod1',.12),('.lod2',0)]:
        for ob in meshes:
            ob.data=originals[ob] if ratio==1 else originals[ob].copy()
            if ratio<1:
                bpy.context.view_layer.objects.active=ob
                # Remove detailed structural meshes; reinsert intact low-poly
                # versions after reducing the ornaments and small equipment.
                if suffix=='.lod2':
                    ob.data.clear_geometry()
                else:
                    structure=ob.vertex_groups.get('LOD_structure')
                    if structure:
                        bm=bmesh.new(); bm.from_mesh(ob.data)
                        weights=bm.verts.layers.deform.active
                        if weights:
                            remove=[vert for vert in bm.verts if vert[weights].get(structure.index,0)>.5]
                            bmesh.ops.delete(bm,geom=remove,context='VERTS')
                        bm.to_mesh(ob.data); bm.free()
                    mod=ob.modifiers.new('Distance triangle reduction','DECIMATE')
                    mod.ratio=ratio
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                key=(ob.parent.name,ob.data.materials[0].name)
                if key in coarse_groups[suffix]:
                    verts,faces=coarse_groups[suffix][key]
                    transform=ob.matrix_world.inverted() @ ob.parent.matrix_world
                    bm=bmesh.new(); bm.from_mesh(ob.data)
                    color=bm.loops.layers.float_color.get('ao') or bm.loops.layers.float_color.new('ao')
                    added=[bm.verts.new(transform @ point) for point in verts]
                    for indices in faces:
                        face=bm.faces.new([added[i] for i in indices])
                        for loop in face.loops: loop[color]=(.87,.87,.87,1)
                    bm.normal_update(); bm.to_mesh(ob.data); bm.free()
                    ob.data.color_attributes.active_color=ob.data.color_attributes['ao']
        exported = meshes
        source_names = {}
        if suffix == '.lod2':
            # Far static geometry uses eleven readable palette colors: twelve
            # static calls including the separately hideable roof boundary.
            remap = {'bandage':'canvasTan','brass':'woodWarm','brick':'survivorRed',
                     'corgiOrange':'schoolBusYellow','denim':'denimBlue','grass':'foliage',
                     'hairSilver':'silver','khaki':'canvasTan','leather':'uiDark',
                     'orange':'schoolBusYellow','redDark':'survivorRed','sidewalk':'canvasTan',
                     'tealDark':'foliage','teeLavender':'picketWhite'}
            groups = {}
            for ob in meshes:
                name = ob.name
                source_names[ob] = name
                ob.name = name + '_exportSource'
                duplicate = ob.copy()
                duplicate.data = ob.data.copy()
                scene.collection.objects.link(duplicate)
                duplicate.name = name
                if duplicate.parent in (interior, roof):
                    token = duplicate.data.materials[0].name
                    if token.startswith('pal_'):
                        duplicate.data.materials[0] = mat(remap.get(token[4:], token[4:]))
                key = (duplicate.parent.name, duplicate.data.materials[0].name)
                groups.setdefault(key, []).append(duplicate)
            exported = []
            for (owner, material), objects in sorted(groups.items()):
                bpy.ops.object.select_all(action='DESELECT')
                for ob in objects: ob.select_set(True)
                bpy.context.view_layer.objects.active = objects[0]
                bpy.ops.object.join()
                exported.append(bpy.context.object)
        bpy.ops.object.select_all(action='DESELECT')
        for ob in [root, *[o for o in root.children_recursive if o.type == 'EMPTY'], *exported]:
            ob.select_set(True)
        path=Path(args.glb).resolve()
        path=path.with_name(path.stem+suffix+path.suffix)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_cameras=False,export_lights=False)
        stats[suffix or 'lod0']=statistics(exported)
        if source_names:
            for ob in exported: bpy.data.objects.remove(ob,do_unlink=True)
            for ob,name in source_names.items(): ob.name=name
    for ob in meshes: ob.data=originals[ob]
    (HERE/'metrics.json').write_text(json.dumps(stats,indent=2))
    print('OK exported '+json.dumps(stats))

if args.render:
    scene.render.engine='CYCLES'
    scene.cycles.samples=args.samples
    scene.cycles.use_denoising=True
    scene.cycles.seed=31
    world=bpy.data.worlds.new('Dark plum studio'); world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.105,.14,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
    scene.world=world
    def light(name,loc,energy,color,size):
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.color=color; data.shape='DISK'; data.size=size
        ob=bpy.data.objects.new(name,data); scene.collection.objects.link(ob); ob.location=loc
        ob.rotation_euler=(Vector((0,0,1.5))-ob.location).to_track_quat('-Z','Y').to_euler()
    light('Soft golden key',(3,3,11),2300,(1,.79,.59),7)
    light('Cool fill',(5,-8,8),1700,(.68,.73,1),8)
    light('Warm edge',(-6,1,8),1700,(1,.60,.31),6)
    for u in (-6,-1.0,5.3):
        ld=bpy.data.lights.new('Sconce studio glow','POINT'); ld.energy=12; ld.color=(1,.47,.10); ld.shadow_soft_size=.24
        ob=bpy.data.objects.new('Sconce studio glow',ld); scene.collection.objects.link(ob); ob.location=xyz((u,-3.94,3.29))
    cam=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera')); scene.collection.objects.link(cam)
    views={'ref':(16,-19,10),'game':(16,-16,22),'front':(23,0,10),'side':(3,24,11),'rear':(-18,-18,14)}
    cam.location=views.get(args.view,views['ref'])
    target_z=2.10 if args.view=='ref' else 1.85
    cam.rotation_euler=(Vector((0,0,target_z))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'; cam.data.ortho_scale=25.8 if args.view=='game' else 18.8
    scene.camera=cam
    scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.view_settings.exposure=-.25
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.filepath=str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True)
    print('OK rendered '+args.render)
