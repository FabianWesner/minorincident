"""Joe's Diner: deterministic geometry-only Hero lot, metres / +X front / Z up.
Rebuild with experiment/tools/blender_run.py. Roof and interior are visibility
assemblies; door_front has its origin at the hinge. Details stand proud >=3mm.
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.distance import tier_argument, export_variant, build_native_lods
DISTANCE = tier_argument()

HERE = Path(__file__).resolve().parent

parser = argparse.ArgumentParser()
for key in ['render', 'glb']: parser.add_argument('--'+key)
parser.add_argument('--lod-only', action='store_true')
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
if args.lod_only:
    build_native_lods(__file__)
    sys.exit(0)

rng=random.Random(284)
M={}
colors={'asphalt':'5b4f5c','sidewalk':'b9a4a0','grass':'6f8f3a','foliage':'7da23c','woodWarm':'b0703f','picketWhite':'f2e6dc','brick':'a8483a','survivorRed':'d9363e','backpackTeal':'2f6e6a','schoolBusYellow':'f2b630','windowGlow':'ffc773','uiDark':'25222c'}
def material(name, token, emission=0):
    h=colors[token]; rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=c
    bs.inputs['Roughness'].default_value=.4 if token in ['survivorRed','picketWhite'] else .72
    if emission:
        bs.inputs['Emission Color'].default_value=c; bs.inputs['Emission Strength'].default_value=emission
    M[name]=m
    return name
for token in colors: material('pal_'+token,token)
material('emi_windowGlow','windowGlow',3)
material('emi_survivorRed','survivorRed',4)
# Warm, lightly tinted panes retain the furnished cafe view.
M['pal_windowGlow'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.12
M['pal_windowGlow'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.19
bs=M['pal_windowGlow'].node_tree.nodes['Principled BSDF'];bs.inputs['Emission Color'].default_value=bs.inputs['Base Color'].default_value;bs.inputs['Emission Strength'].default_value=.35

def empty(name, loc=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
    if parent:
        bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    return o
root=empty('root'); root['asset_id']='bld.joes-diner'; root['tier']='Hero'
roof=empty('roof',parent=root); interior=empty('interior',parent=root)
door=empty('door_front',(2.81,-1.13,.33),root)
door_service=empty('door_service',(-2.81,.97,.33),root)
def finish(o,name,mat,parent,bevel=0):
    if DISTANCE: bevel = 0
    o.name=name; o.data.materials.clear(); o.data.materials.append(M[mat if mat in M else 'pal_'+mat])
    if bevel:
        mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=2 if bevel>=.02 else 1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    return o

def box(name,loc,size,mat,parent=root,bevel=.025):
    if DISTANCE: bevel = 0
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,min(bevel,min(size)*.3))

def cyl(name,loc,r,depth,mat,parent=root,n=16,axis='z'):
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 8)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=loc); o=bpy.context.object
    if axis=='x':o.rotation_euler.y=math.pi/2
    if axis=='y':o.rotation_euler.x=math.pi/2
    return finish(o,name,mat,parent,.008)

def tube(name,pts,r,mat,parent=root,closed=False):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=1; c.bevel_depth=r; c.bevel_resolution=0 if DISTANCE else 2
    s=c.splines.new('POLY'); s.points.add(len(pts)-1)
    for p,v in zip(s.points,pts):p.co=(*v,1)
    s.use_cyclic_u=closed
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); bpy.context.view_layer.objects.active=o
    o.select_set(True); bpy.ops.object.convert(target='MESH'); o=bpy.context.object; o.select_set(False)
    return finish(o,name,mat,parent)

def extrude(name, yz, x, depth, mat, parent=roof, bevel=.035):
    if DISTANCE: bevel = 0
    n=len(yz); verts=[(xx,y,z) for xx in [x-depth/2,x+depth/2] for y,z in yz]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
    return finish(o,name,mat,parent,bevel)

fonts={k:bpy.data.fonts.load('/System/Library/Fonts/Supplemental/'+v) for k,v in {'script':'Brush Script.ttf','bold':'Arial Bold.ttf','plain':'Arial.ttf'}.items()}
def text(word,loc,w,h,mat,parent=root,font='bold',name='lettering'):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,math.pi/2)); o=bpy.context.object
    o.data.body=word; o.data.font=fonts[font]; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.size=1
    o.data.extrude=0 if DISTANCE else (.009); o.data.bevel_depth=0 if DISTANCE else (.004); o.data.bevel_resolution=0; o.data.resolution_u=2 if DISTANCE else (3)
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object
    xs=[v.co.x for v in o.data.vertices]; ys=[v.co.y for v in o.data.vertices]
    cx=(max(xs)+min(xs))/2; cy=(max(ys)+min(ys))/2
    for v in o.data.vertices:v.co.x=(v.co.x-cx)*w/(max(xs)-min(xs)); v.co.y=(v.co.y-cy)*h/(max(ys)-min(ys))
    return finish(o,name,mat,parent)

def rounded_xy(xc,yc,hx,hy,r,z):
    pts=[]
    for cx,cy,start in [(xc+hx-r,yc+hy-r,0),(xc-hx+r,yc+hy-r,90),(xc-hx+r,yc-hy+r,180),(xc+hx-r,yc-hy+r,270)]:
        steps=(4 if DISTANCE==1 else 2) if DISTANCE else 8
        for i in range(steps+1):
            a=math.radians(start+i*90/steps); pts.append((cx+r*math.cos(a),cy+r*math.sin(a),z))
    return pts

# Raised lot, individually rounded kerbstones and paving slabs.
box('lot_foundation',(0,-.28,.12),(6.7,8.55,.24),'asphalt',bevel=.12)
for x in [-3.1,-2.35,-1.6,-.85,-.1,.65,1.4,2.15,2.9]:
    for y in [-4.03,-3.25,-2.47,-1.69,-.91,-.13,.65,1.43,2.21,2.99,3.77]:
        box('paving',(x,y,.265),(.73,.76,.13),'sidewalk',bevel=.028)
for y in [-4.12,-3.27,-2.42,-1.57,-.72,.13,.98,1.83,2.68,3.53]:
    box('front_kerb',(3.3,y,.22),(.27,.82,.38),'sidewalk',bevel=.045)
for x in [-3.16,-2.38,-1.6,-.82,-.04,.74,1.52,2.3]:
    box('side_kerb',(x,-4.36,.22),(.75,.27,.38),'sidewalk',bevel=.045)

# Wall shell is built around real openings, allowing a furnished interior.
# Miter-free corners meet with a 10 mm seam, avoiding duplicate outside faces.
box('rear_wall',(-2.60,-1.215,1.72),(.20,4.31,2.78),'picketWhite')
box('rear_wall',(-2.60,2.625,1.72),(.20,1.53,2.78),'picketWhite')
box('rear_door_header',(-2.60,1.4,2.805),(.20,.92,.61),'picketWhite')
box('far_wall',(-.12,3.50,1.72),(5.16,.20,2.78),'picketWhite')
box('far_plinth',(-.12,3.64,.64),(5.16,.08,.60),'brick')
# Service leaf, hinge knuckles and an outdoor utility cluster.
box('service_leaf',(-2.75,1.40,1.40),(.08,.88,2.14),'backpackTeal',door_service)
box('service_kickplate',(-2.799,1.40,.59),(.018,.75,.31),'uiDark',door_service)
for y in [.97,1.83]:box('service_stile',(-2.80,y,1.40),(.04,.045,2.12),'woodWarm',door_service,.009)
for z in [.35,2.47]:box('service_rail',(-2.80,1.40,z),(.04,.86,.045),'woodWarm',door_service,.009)
for z in [.66,2.18]:cyl('service_hinge',(-2.81,.97,z),.034,.15,'uiDark',door_service)
tube('service_pull',[(-2.82,1.76,1.10),(-2.91,1.76,1.10),(-2.91,1.76,1.43),(-2.82,1.76,1.43)],.022,'uiDark',door_service)
box('rear_threshold',(-2.75,1.4,.36),(.34,1.07,.06),'picketWhite')
box('rear_vent',(-2.714,-1.35,1.68),(.022,.88,.51),'uiDark')
for z in [1.48,1.57,1.66,1.75,1.84]:box('rear_louver',(-2.745,-1.35,z),(.054,.80,.044),'sidewalk',bevel=.01)
tube('drain_pipe',[(-2.78,-2.8,.42),(-2.78,-2.8,3.55),(-2.64,-2.8,3.63)],.045,'asphalt')
for z in [.69,2.18,3.0]:box('pipe_clamp',(-2.795,-2.8,z),(.09,.14,.035),'sidewalk',bevel=.007)
box('utility_enclosure',(-2.765,-2.25,1.12),(.13,.33,.48),'sidewalk')
box('utility_access_face',(-2.84,-2.25,1.12),(.017,.27,.42),'asphalt',bevel=.006)

box('front_base',(2.60,0,.64),(.20,7.2,.60),'brick')
box('side_base',(0,-3.50,.64),(5.4,.20,.60),'brick')
for y,w in [(-3.39,.42),(-1.42,.36),(.03,.40),(3.36,.52)]:
    box('front_pier',(2.6,y,1.85),(.24,w,2.50),'picketWhite')
for x,w in [(-2.5,.4),(-.91,.25),(.85,.25),(2.49,.42)]:
    box('side_pier',(x,-3.5,1.85),(w,.24,2.5),'picketWhite')
box('front_header',(2.6,0,2.9),(.25,7.2,.42),'picketWhite')
box('side_header',(0,-3.5,2.9),(5.4,.25,.42),'picketWhite')
# Raised checker tiles wrap piers, without covering windows or the entrance.
for y,w in [(-3.39,.42),(-1.42,.36),(.03,.40),(3.36,.52)]:
    count=max(2,round(w/.17)); ww=w/count
    for row in range(3):
        for j in range(count): box('checker_tile',(2.731,y-w/2+ww*(j+.5),1.00+row*.17),(.018,ww-.009,.16),'survivorRed' if (j+row)%2 else 'picketWhite',bevel=.003)
for x,w in [(-2.5,.4),(-.91,.25),(.85,.25),(2.49,.42)]:
    count=max(2,round(w/.17)); ww=w/count
    for row in range(3):
        for j in range(count):box('checker_tile',(x-w/2+ww*(j+.5),-3.631,1.+row*.17),(ww-.009,.018,.16),'survivorRed' if (j+row)%2 else 'picketWhite',bevel=.003)
# Brick courses and small irregular paint scars give the plinth substance.
for z in [.43,.65,.86]:
    for y in [-3.12,-2.6,-2.08,-1.56,-1.04,-.52,0,.52,1.04,1.56,2.08,2.6,3.12]:
        if -1.18<y<-.10:continue
        box('front_brick',(2.719,y,z),(.016,.495,.19),'brick',bevel=.009)
    for x in [-2.35,-1.84,-1.33,-.82,-.31,.2,.71,1.22,1.73,2.24]:box('side_brick',(x,-3.619,z),(.49,.016,.19),'brick',bevel=.009)

def window(axis,c,w):
    # Window panes sit behind the raised mullions and allow the furnishings to show.
    if axis=='front':box('window_pane',(2.68,c,1.88),(.018,w,1.64),'windowGlow',bevel=0)
    else:box('window_pane',(c,-3.58,1.88),(w,.018,1.64),'windowGlow',bevel=0)
    z=1.88; h=1.64
    for side in [-1,1]:
        if axis=='front':box('window_jamb',(2.74,c+side*w/2,z),(.12,.075,h+.15),'woodWarm')
        else:box('window_jamb',(c+side*w/2,-3.64,z),(.075,.12,h+.15),'woodWarm')
    for zz in [z-h/2,z+h/2]:
        if axis=='front':box('window_frame',(2.75,c,zz),(.13,w+.13,.08),'woodWarm')
        else:box('window_frame',(c,-3.65,zz),(w+.13,.13,.08),'woodWarm')
    for j in range(1,3):
        offset=-w/2+j*w/3
        if axis=='front':box('mullion',(2.775,c+offset,z),(.07,.055,h),'picketWhite',bevel=.008)
        else:box('mullion',(c+offset,-3.675,z),(.055,.07,h),'picketWhite',bevel=.008)
    if axis=='front':box('red_sill',(2.80,c,z-h/2-.09),(.36,w+.24,.13),'survivorRed')
    else:box('red_sill',(c,-3.70,z-h/2-.09),(w+.24,.36,.13),'survivorRed')
window('front',-2.40,1.51); window('front',1.65,2.64)
for x,w in [(-1.72,1.20),(-.03,1.43),(1.67,1.23)]:window('side',x,w)
# Entrance leaf and its hardware: joint at left jamb, no overlap with masonry.
box('door_panel',(2.76,-.65,1.42),(.08,.96,2.18),'sidewalk',door)
box('door_lower_inset',(2.809,-.65,.91),(.019,.80,.85),'woodWarm',door)
box('door_window',(2.81,-.65,2.03),(.02,.78,.72),'emi_windowGlow',door)
for y in [-1.10,-.2]:box('door_stile',(2.83,y,1.42),(.07,.04,2.10),'picketWhite',door,.008)
for z in [.42,1.53,2.48]:box('door_crossbar',(2.83,-.65,z),(.07,.88,.045),'picketWhite',door,.008)
tube('door_pull',[(2.90,-.27,1.12),(2.98,-.27,1.12),(2.98,-.27,1.49),(2.90,-.27,1.49)],.024,'uiDark',door)
for z in [.69,2.20]:cyl('hinge',(2.81,-1.13,z),.035,.16,'uiDark',door)
box('threshold',(2.82,-.65,.36),(.34,1.07,.06),'picketWhite')
text('OPEN',(2.846,-.65,2.05),.48,.13,'survivorRed',door,name='open_lettering')

# Checker cafe floor, upholstered booths, pedestal tables, cups and pendants.
box('floor',(0,0,.36),(5.1,6.9,.08),'uiDark',interior)
for x in [-2.2,-1.6,-1.,-.4,.2,.8,1.4,2.0]:
    for y in [-3.1,-2.5,-1.9,-1.3,-.7,-.1,.5,1.1,1.7,2.3,2.9]:
        if (round((x+2.2)/.6)+round((y+3.1)/.6))%2==0:box('floor_tile',(x,y,.407),(.59,.59,.013),'picketWhite',interior,.003)
for x,y,orientation in [(-1.55,-2.65,0),(.42,-2.65,0),(1.98,-2.35,1),(1.90,1.30,1),(1.90,2.78,1),(-1.4,2.72,0)]:
    # Two small opposing padded bench seats around each compact table.
    for s in [-1,1]:
        xx=x+s*.66 if orientation==0 else x; yy=y if orientation==0 else y+s*.58
        sx,sy=(.41,.86) if orientation==0 else (.86,.41)
        box('booth_plinth',(xx,yy,.60),(sx,sy,.32),'brick',interior)
        box('booth_cushion',(xx,yy,.84),(sx+.05,sy+.04,.16),'survivorRed',interior,.05)
        bx=xx+s*.16 if orientation==0 else xx; by=yy if orientation==0 else yy+s*.16
        size=(.16,.90,.69) if orientation==0 else (.90,.16,.69)
        box('booth_back',(bx,by,1.12),size,'survivorRed',interior,.055)
        box('booth_top_piping',(bx,by,1.47),(.18,.91,.034) if orientation==0 else (.91,.18,.034),'picketWhite',interior,.01)
    cyl('table_base',(x,y,.49),.23,.07,'uiDark',interior)
    cyl('table_stem',(x,y,.80),.055,.59,'sidewalk',interior)
    box('tabletop',(x,y,1.10),(.73,.69,.09),'picketWhite',interior,.05)
    for sign in [-1,1]:
        cyl('plate',(x,y+sign*.21,1.162),.11,.018,'picketWhite',interior)
        cyl('coffee_cup',(x+.16,y+sign*.21,1.23),.045,.12,'picketWhite',interior)
        cyl('coffee',(x+.16,y+sign*.21,1.294),.035,.006,'uiDark',interior)
    box('napkin_holder',(x-.2,y,1.20),(.12,.08,.12),'woodWarm',interior,.012)
# Warm cove lights remain visible in the runtime without baked image textures.
box('rear_cove',(-2.465,0,2.68),(.035,6.7,.10),'emi_windowGlow',interior)
box('far_cove',(0,3.365,2.68),(4.95,.035,.10),'emi_windowGlow',interior)
# Back service counter, coffee urns and menu.
box('service_counter',(-1.95,.25,.95),(.75,2.90,1.08),'backpackTeal',interior)
box('counter_top',(-1.95,.25,1.52),(.91,3.04,.12),'picketWhite',interior)
for y in [-.60,.20,.80]:
    cyl('coffee_urn',(-1.94,y,1.84),.14,.51,'sidewalk',interior)
    cyl('urn_lid',(-1.94,y,2.11),.16,.05,'uiDark',interior)
    box('urn_tap',(-1.76,y,1.77),(.10,.035,.04),'uiDark',interior)
box('menu_board',(-2.475,.45,2.30),(.05,2.1,.68),'uiDark',interior)
text('SUNSET GROVE',(-2.438,.45,2.46),1.80,.16,'windowGlow',interior)
text('COFFEE   PIE   BREAKFAST',(-2.438,.45,2.22),1.83,.12,'picketWhite',interior,font='plain')
for x,y in [(1.45,1.55),(1.25,-2.55),(-1.55,-2.65)]:
    cyl('pendant_cable',(x,y,2.78),.012,.42,'uiDark',interior,n=8)
    bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.25,radius2=.07,depth=.17,location=(x,y,2.56))
    finish(bpy.context.object,'pendant_shade','schoolBusYellow',interior,.012)
    cyl('pendant_lens',(x,y,2.469),.21,.015,'emi_windowGlow',interior)

# Roof slab and rounded neon cornice; double continuous tubes held off fascia.
box('roof_slab',(0,0,3.18),(5.91,7.73,.30),'sidewalk',roof,.14)
box('fascia_red',(0,0,3.32),(5.96,7.78,.12),'survivorRed',roof,.055)
for z in [3.22,3.40]:
    tube('cornice_neon',rounded_xy(0,0,3.01,3.92,.38,z),.032,'emi_windowGlow',roof,True)
for z in [3.13,3.49]:tube('cornice_edge',rounded_xy(0,0,3.0,3.91,.38,z),.055,'picketWhite',roof,True)
box('roof_tar',(0,0,3.53),(5.64,7.46,.08),'asphalt',roof)
for y in [-3.57,3.57]:
    box('parapet',(0,y,3.76),(5.65,.22,.43),'asphalt',roof)
    box('parapet_cap',(0,y,4.01),(5.75,.30,.10),'sidewalk',roof)
    for x in [-2.3,-1.4,-.5,.4,1.3,2.2]:box('parapet_panel',(x,y+(-.118 if y<0 else .118),3.76),(.87,.018,.36),'asphalt',roof,.012)
box('rear_parapet',(-2.71,0,3.76),(.22,7.3,.43),'asphalt',roof)
box('rear_parapet_cap',(-2.71,0,4.01),(.30,7.42,.10),'sidewalk',roof)
# Tile patches and visible flat-roof seams.
for x,y in [(-2.1,-2.4),(-.6,-1.4),(1.0,.8),(1.7,-2.5),(-.9,2.5)]:box('roof_patch',(x,y,3.58),(.50,.42,.04),'sidewalk',roof,.009)
for y in [-2,-.7,.6,1.9]:box('tar_seam',(0,y,3.58),(5.15,.023,.016),'uiDark',roof,.004)
# HVAC: feet, lid, framed access doors, louvers, screws and duct elbow.
for x in [-1.78,-.62]:
    for y in [-1.12,.12]:box('hvac_foot',(x,y,3.72),(.19,.19,.27),'woodWarm',roof)
box('hvac_body',(-1.2,-.50,4.20),(1.43,1.60,1.02),'sidewalk',roof,.06)
box('hvac_base',(-1.2,-.50,3.76),(1.52,1.69,.13),'picketWhite',roof)
box('hvac_lid',(-1.2,-.50,4.74),(1.55,1.72,.10),'picketWhite',roof)
for y in [-.92,-.12]:
    box('hvac_recess',(-.464,y,4.23),(.035,.60,.78),'uiDark',roof,.03)
    box('hvac_access',(-.434,y,4.23),(.028,.53,.69),'sidewalk',roof,.025)
    for z in [3.96,4.50]:
        for yy in [y-.20,y+.20]:cyl('access_screw',(-.411,yy,z),.018,.016,'uiDark',roof,axis='x',n=8)
for x in [-1.57,-.83]:
    box('hvac_vent_dark',(x,-1.321,4.22),(.60,.028,.78),'uiDark',roof,.025)
    for z in [3.92,4.04,4.16,4.28,4.40,4.52]:
        o=box('hvac_louver',(x,-1.355,z),(.52,.065,.055),'asphalt',roof,.012); o.rotation_euler.x=.25
box('duct_long',(-1.1,2.05,3.80),(2.68,.65,.45),'sidewalk',roof,.08)
box('duct_elbow',(-2.3,1.83,3.83),(.51,1.05,.51),'sidewalk',roof,.08)
for x in [-1.95,-1.2,-.45]:box('duct_band',(x,2.05,4.04),(.04,.67,.022),'woodWarm',roof,.004)

# Main sign: flattened rounded rectangle with a double scallop above Joe's.
outline=[(-2.88,3.68),(2.88,3.68),(3.04,3.84),(3.04,5.06),(2.90,5.24),(1.43,5.24)]
# Central top arc, then left small scallop, descending to the lower board.
for i in range(17):
    a=math.radians(15+i*150/16); outline.append((-.55+2.05*math.cos(a),5.05+1.27*math.sin(a)))
outline += [(-2.51,5.30),(-2.73,5.28),(-2.98,5.05),(-3.07,4.73),(-2.97,4.48),(-2.88,4.43)]
extrude('sign_red_outline',outline,2.60,.27,'survivorRed')
cy,cz=0,4.55
inner=[(cy+(y-cy)*.952,cz+(z-cz)*.936) for y,z in outline]
extrude('sign_dark_face',inner,2.758,.063,'uiDark',bevel=.022)
tube('sign_border',[(2.806,y,z) for y,z in inner],.019,'schoolBusYellow',roof,True)
text("Joe's",(2.827,-.65,5.40),3.20,.93,'emi_windowGlow',roof,font='script',name='joes_neon')
text('DINER',(2.829,.10,4.34),4.65,.84,'emi_survivorRed',roof,name='diner_neon')
for y in [-2.45,2.45]:box('sign_mount',(2.50,y,3.77),(.22,.17,.43),'uiDark',roof)
# Neon coffee cup, mounted at the right-hand roof corner.
def cup(x,y,z,scale,mat,parent=root):
    def line(points,r=.023):tube('cup_neon' if mat.startswith('emi') else 'chalk_cup',[(x,y+u*scale,z+v*scale) for u,v in points],r*scale,mat,parent)
    line([(-.43,.33),(.38,.33),(.30,-.18),(.20,-.32),(-.15,-.36),(-.32,-.22),(-.43,.33)])
    line([(.39,.25),(.56,.28),(.64,.18),(.63,.02),(.50,-.12),(.33,-.12)])
    line([(-.46,-.40),(-.30,-.47),(.10,-.47),(.38,-.39)])
    for u in [-.20,.07]:line([(u,.53),(u-.05,.65),(u+.015,.77),(u,.87)])
for y in [3.48]:
    cyl('cup_sign_stem',(2.10,y,4.23),.055,1.47,'uiDark',roof)
    cup(2.76,y,5.39,.96,'emi_survivorRed',roof)

# Side entrance awning in alternating sewn red/cream strips.
for i in range(9):
    x=.58+(i-4)*.245
    o=box('awning_stripe',(x,-3.92,2.61),(.241,.76,.07),'survivorRed' if i%2==0 else 'picketWhite',bevel=.012); o.rotation_euler.x=.30
    box('awning_valance',(x,-4.277,2.38),(.241,.08,.19),'survivorRed' if i%2==0 else 'picketWhite',bevel=.037)
for x in [-.45,1.62]:tube('awning_bracket',[(x,-3.61,2.38),(x,-4.15,2.45),(x,-3.61,2.78)],.025,'woodWarm')

# Slogan sign, its planted curb enclosure and lettering.
for y in [-6.85,-5.03]:box('sign_post',(1.1,y,1.12),(.20,.20,1.90),'woodWarm')
box('slogan_frame',(1.13,-5.94,2.24),(.20,2.95,2.06),'picketWhite',bevel=.08)
box('slogan_red_panel',(1.25,-5.94,2.24),(.075,2.72,1.82),'survivorRed',bevel=.035)
for word,z,w in [('Good Food',2.79,2.32),('Brighter',2.24,2.08),('Days',1.69,1.35)]:text(word,(1.302,-5.94,z),w,.42,'picketWhite',font='script',name='slogan_lettering')
for y in [-7.16,-4.72]:
    for z in [1.47,3.0]:cyl('sign_fastener',(1.307,y,z),.024,.018,'woodWarm',axis='x',n=8)
box('sign_garden_base',(1.1,-5.94,.10),(1.28,3.25,.20),'grass',bevel=.06)
for y in [-7.5,-4.37]:box('sign_garden_kerb',(1.1,y,.19),(1.38,.19,.31),'sidewalk',bevel=.035)
for x in [.45,1.75]:
    for y in [-7.19,-6.55,-5.91,-5.27,-4.63]:box('sign_garden_kerb',(x,y,.19),(.18,.61,.31),'sidewalk',bevel=.03)

# A-frame chalkboards with coffee line drawings, physically raised lettering.
for y in [-1.78,3.29]:
    for yy in [y-.39,y+.39]:
        o=box('chalkboard_front_leg',(3.17,yy,.86),(.075,.075,1.12),'woodWarm',bevel=.012); o.rotation_euler.y=-.16
        o=box('chalkboard_rear_leg',(2.81,yy,.84),(.075,.075,1.1),'woodWarm',bevel=.012); o.rotation_euler.y=.24
    box('chalkboard_frame',(3.245,y,.94),(.10,.88,.95),'woodWarm',bevel=.025)
    box('chalkboard_face',(3.307,y,.94),(.025,.72,.80),'uiDark',bevel=.018)
    cup(3.330,y,.92,.47,'picketWhite')
    for z in [.42,1.44]:box('chalkboard_crossbar',(3.20,y,z),(.12,.91,.045),'woodWarm',bevel=.008)
# Hollow yellow brick planter at the sidewalk corner.
for row in range(3):
    for y in [-3.34,-2.89]:box('planter_brick',(2.28,y,.40+row*.16),(.66,.21,.15),'schoolBusYellow',bevel=.02)
    for x in [1.96,2.60]:box('planter_brick',(x,-3.11,.40+row*.16),(.19,.37,.15),'schoolBusYellow',bevel=.02)
box('planter_soil',(2.28,-3.11,.77),(.42,.29,.035),'asphalt')

# Stylized individually oriented leaves and yellow flowers, seeded for repeatability.
def shrub(x,y,z,rad,count):
    if DISTANCE:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,z+.2))
        o=bpy.context.object; o.scale=(rad,rad,.22); finish(o,'distance shrub','foliage',root); return
    for i in range(count):
        ang=rng.uniform(0,math.tau); rr=rad*math.sqrt(rng.random()); xx=x+rr*math.cos(ang); yy=y+rr*math.sin(ang); zz=z+rng.uniform(.03,.35)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(xx,yy,zz))
        o=bpy.context.object; o.scale=(rng.uniform(.075,.14),rng.uniform(.08,.16),rng.uniform(.12,.22)); o.rotation_euler=(rng.random(),rng.random(),ang)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'leaf','foliage' if i%3 else 'grass',root)
        if i%5==0:
            for j in range(4):
                a=j*math.pi/2
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.034,location=(xx+.043*math.cos(a),yy+.043*math.sin(a),zz+.16))
                finish(bpy.context.object,'flower_petal','schoolBusYellow',root)
            cyl('flower_center',(xx,yy,zz+.17),.024,.016,'schoolBusYellow',n=8)
for x,y,r,c in [(-1.85,-3.88,.35,35),(-.65,-3.92,.38,40),(.50,-3.93,.37,40),(1.35,-3.93,.32,32),(2.96,.75,.28,25),(2.94,1.65,.31,30),(2.94,2.55,.28,25),(2.28,-3.11,.20,20),(1.10,-6.90,.32,25),(1.1,-5.9,.28,24),(1.1,-4.9,.28,24)]:shrub(x,y,.34 if y!=-3.11 else .78,r,c)
# Small coarse chips on stucco/coping rather than texture noise.
for y,w in [(-3.39,.42),(-1.42,.36),(.03,.40),(3.36,.52)]:
    for j in range(5):
        yy=y+rng.uniform(-w*.28,w*.28); z=rng.uniform(1.65,2.72)
        box('stucco_chip',(2.729,yy,z),(.013,rng.uniform(.024,.065),rng.uniform(.045,.12)),'sidewalk',bevel=.007)
for x in [-2.5,-.91,.85,2.49]:
    for j in range(4):box('stucco_chip',(x+rng.uniform(-.07,.07),-3.629,rng.uniform(1.6,2.75)),(.04,.012,.07),'sidewalk',bevel=.006)

if DISTANCE==2:
    box('distance forecourt',(0,-.13,.265),(6.5,8.42,.13),'sidewalk',bevel=0)
if DISTANCE:
    export_variant(Path(__file__).parent, DISTANCE, omit=('stucco_chip',), far_omit=('floor_tile', 'slogan_lettering','chalk_cup','paving','front_brick','side_brick','checker_tile','leaf', 'flower', 'cup', 'plate', 'utensil', 'stool', 'pebble','louver','pipe_clamp','sign_border','access_screw','planter_brick','sign_garden_kerb'))

# Merge by palette within each independently controlled group, retaining pivots.
for parent in [root,roof,interior,door,door_service]:
    for m in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==m]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); o=obs[0]; o.name=parent.name+'_'+m.name
        # Origin on its owning joint/visibility assembly, preserving the geometry.
        bpy.context.scene.cursor.location=parent.matrix_world.translation
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)

meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
# Bound tessellation without deleting purposeful parts or control assemblies.
raw_tri=0
for o in meshes:o.data.calc_loop_triangles();raw_tri+=len(o.data.loop_triangles)
if raw_tri>94000:
    for o in meshes:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('hero budget','DECIMATE');mod.ratio=92000/raw_tri
        bpy.ops.object.modifier_apply(modifier=mod.name)

# Deterministic AO into a vertex-color channel. Bake only for the exported build.
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=284
if args.glb:
    scene.render.bake.target='VERTEX_COLORS'; scene.render.bake.use_clear=True
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        a=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER'); o.data.color_attributes.active_color=a; o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.bake(type='AO')
for name,loc,kind,color,parents in [('neon',(2.85,0,4.65),'neon','light_neon_pink',[roof]),('windows',(2.8,1.0,1.9),'window','light_window_warm',[interior,door])]:
    anchor=empty('light:'+name,loc,root); anchor.rotation_euler=(0,-math.pi/2,0)
    anchor['ss_light']=json.dumps({'type':kind,'color':color,'intensity':3,'range':6,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[o.name for o in meshes if o.parent in parents and o.data.materials[0].name.startswith('emi_')],'tiers':'all'})
col=empty('col:building',(0,0,1.68),root); col['collider']='cuboid';col['size']=[5.4,7.2,3.36]
# Center the complete lot using actual vertices, including the neon cup/sign bed.
bpy.context.view_layer.update()
points=[o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
for axis in [0,1]:
    center=(min(p[axis] for p in points)+max(p[axis] for p in points))/2
    for o in list(root.children):o.location[axis]-=center
bpy.context.view_layer.update()
tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'id':'bld.joes-diner','tier':'Hero','triangles':tri,'draw_calls':len(meshes),'materials':sorted({o.data.materials[0].name for o in meshes}),'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','roof','interior','door_front','door_service','light:neon','light:windows','col:building']),'within_budget':tri<=100000 and len(meshes)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
root['lods']=json.dumps({'LOD0':'model.glb','LOD1':'model.lod1.glb','LOD2':'model.lod2.glb'})
asset=list(bpy.context.scene.objects)
if args.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    def export_glb(path):
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    path=Path(args.glb).resolve(); export_glb(path)

print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if args.render:
    world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.19,.28,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.035));o=bpy.context.object
    m=bpy.data.materials.new('studio_ground');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.047,.039,.057,1);o.data.materials.append(m)
    for loc,power,size,color in [((4,-5,11),1700,7,(1,.76,.53)),((-4,1,9),1800,6,(.66,.72,1)),((1,5,8),1200,5,(1,.40,.27))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,-.5,2))-o.location).to_track_quat('-Z','Y').to_euler()
    for loc in [(1.0,-2.7,2.25),(1.7,1.8,2.25),(-1.4,.3,2.3)]:
        bpy.ops.object.light_add(type='POINT',location=loc);o=bpy.context.object;o.data.energy=160;o.data.color=(1,.48,.16);o.data.shadow_soft_size=.7
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;target=Vector((0,0,2.7))
    views={'ref':(17,-13,12),'game':(14,-14,18),'front':(18,-1,6),'side':(0,-20,7),'rear':(-13,15,12)}
    cam.location=views[args.view];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=18.2
    scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    for d in prefs.devices:d.use=True
    scene.cycles.device='GPU';scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(Path(args.render).resolve());bpy.ops.render.render(write_still=True)
    if args.view=='ref':
        cam.location=views['game'];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        render_path=Path(args.render).resolve()
        paired='game.png' if render_path.name=='hero.png' else render_path.stem.replace('-ref','')+'-game.png'
        scene.render.filepath=str(render_path.with_name(paired));bpy.ops.render.render(write_still=True)
    print('RENDER OK')

if args.glb and not DISTANCE:
    build_native_lods(__file__)
