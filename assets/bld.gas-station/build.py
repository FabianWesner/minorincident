"""Sunset Fuel hero diorama. Deterministic metres, +X front, Z up.
Static meshes merge by material inside roof/interior/hinged-door assemblies.
All applied signage and surface details stand at least 3 mm proud.
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.lod import export_lods, rebuild_from_baked

HERE=Path(__file__).resolve().parent
if '--lod-only' in sys.argv:
    rebuild_from_baked(HERE/'model.glb')
    sys.exit(0)

p=argparse.ArgumentParser()
for k in ['render','glb']: p.add_argument('--'+k)
p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng=random.Random(713)
COLORS={'asphalt':'4b4152','sidewalk':'b9a4a0','woodWarm':'b0703f','picketWhite':'f2e6dc','brick':'a8483a','survivorRed':'d9363e','backpackTeal':'2f6e6a','schoolBusYellow':'f2b630','policeBlue':'284184','windowGlow':'ffc773','uiDark':'25222c','sirenRed':'ff2d2d'}
M={}
for token,h in COLORS.items():
    for em in ([False,True] if token in ['windowGlow','sirenRed','policeBlue'] else [False]):
        name=('emi_' if em else 'pal_')+token
        m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
        eh='4f8bff' if em and token=='policeBlue' else h
        rgb=[int(eh[i:i+2],16)/255 for i in (0,2,4)]
        c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
        b.inputs['Base Color'].default_value=c; b.inputs['Roughness'].default_value=.42 if token in ['survivorRed','policeBlue'] else .65
        if em: b.inputs['Emission Color'].default_value=c; b.inputs['Emission Strength'].default_value=3
        M[name]=m

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o);o.location=loc
    if parent:
        bpy.context.view_layer.update();w=o.matrix_world.copy();o.parent=parent;o.matrix_world=w
    return o
root=empty('root'); root['asset_id']='bld.gas-station';root['tier']='Hero'
roof=empty('roof',parent=root);interior=empty('interior',parent=root)
door=empty('door_front',(-.94,-1.55,.24),root)

def finish(o,name,mat,parent,bevel=0,segments=2):
    o.name=name;o.data.materials.clear();o.data.materials.append(M[mat if mat in M else 'pal_'+mat])
    if bevel:
        mod=o.modifiers.new('rounded edges','BEVEL');mod.width=bevel;mod.segments=segments
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update();w=o.matrix_world.copy();o.parent=parent;o.matrix_world=w
    return o

def box(name,loc,size,mat,parent=root,bevel=.028,segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,min(bevel,min(size)*.28),segments)

def cyl(name,loc,r,d,mat,parent=root,n=24,axis='z',bevel=.008):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d,location=loc);o=bpy.context.object
    if axis=='x':o.rotation_euler.y=math.pi/2
    if axis=='y':o.rotation_euler.x=math.pi/2
    return finish(o,name,mat,parent,bevel)

def tube(name,pts,r,mat,parent=root,closed=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=2
    s=c.splines.new('POLY');s.points.add(len(pts)-1)
    for q,v in zip(s.points,pts):q.co=(*v,1)
    s.use_cyclic_u=closed;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,name,mat,parent)

fonts={k:bpy.data.fonts.load('/System/Library/Fonts/Supplemental/'+v) for k,v in {'bold':'Arial Bold.ttf','script':'Brush Script.ttf','plain':'Arial.ttf'}.items()}
def text(word,loc,w,h,mat,parent=root,side=False,font='bold'):
    bpy.ops.object.select_all(action='DESELECT');bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,0 if side else math.pi/2))
    o=bpy.context.object;o.data.body=word;o.data.font=fonts[font];o.data.align_x='CENTER';o.data.align_y='CENTER'
    o.data.extrude=.006;o.data.bevel_depth=.002;o.data.resolution_u=4;o.data.bevel_resolution=0
    bpy.ops.object.convert(target='MESH');o=bpy.context.object
    xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices]
    cx=(min(xs)+max(xs))/2;cy=(min(ys)+max(ys))/2
    for v in o.data.vertices:v.co.x=(v.co.x-cx)*w/(max(xs)-min(xs));v.co.y=(v.co.y-cy)*h/(max(ys)-min(ys))
    return finish(o,'letter_'+word,mat,parent)

def logo(loc,r,parent=root,side=False):
    x,y,z=loc
    cyl('sunset_border',loc,r+.025,.022,'picketWhite',parent,n=48,axis='y' if side else 'x',bevel=.004)
    cyl('sunset_sun',(x,y-.017,z) if side else (x+.017,y,z),r,.022,'schoolBusYellow',parent,n=48,axis='y' if side else 'x',bevel=.004)
    for dz in [-.07,-.21,-.35]:
        if abs(dz)>r*.90:continue
        width=2*math.sqrt(r*r-dz*dz)*.97
        if side:box('sunset_stripe',(x,y-.038,z+dz),(width,.017,.070),'survivorRed',parent,.004)
        else:box('sunset_stripe',(x+.038,y,z+dz),(.017,width,.070),'survivorRed',parent,.004)

# Paved miniature lot. Every slab has an actual open seam.
box('foundation',(0,.5,.10),(10.3,10.4,.20),'asphalt',bevel=.10)
for i in range(10):
    for j in range(10):
        box('paving_slab',(-4.64+i*1.03,-4.13+j*1.03,.215),(1.012,1.012,.16),'sidewalk',bevel=.018)
for i in range(10):
    box('front_kerbstone',(5.08,-4.13+i*1.03,.18),(.22,1.008,.35),'sidewalk',bevel=.04)
    box('side_kerbstone',(-4.64+i*1.03,-4.70,.18),(1.008,.22,.35),'sidewalk',bevel=.04)

# Convenience shop, real entrance and broad glazed display openings.
box('shop_back',(-4.35,-.25,1.73),(.23,7.1,2.92),'picketWhite')
for y in [-3.7,3.2]:
    box('shop_side',(-2.77,y,1.73),(3.16,.23,2.92),'picketWhite')
    box('shop_plinth',(-2.77,y+(-.132 if y<0 else .132),.65),(3.22,.05,.75),'asphalt')
for y,w in [(-3.59,.38),(-1.71,.24),(-.36,.25),(1.42,.25),(3.08,.4)]:
    box('shop_pier',(-1.13,y,1.73),(.30,w,2.92),'picketWhite')
    box('pier_foot',(-.96,y,.58),(.07,w+.035,.55),'sidewalk')
box('front_lintel',(-1.13,-.25,2.99),(.30,7.1,.40),'picketWhite')
for y,w in [(-2.66,1.50),(.53,1.51),(2.27,1.36)]:
    box('window_lower',(-1.10,y,.53),(.22,w,.48),'sidewalk')
    box('window_dark_back',(-1.25,y,1.75),(.025,w,1.91),'uiDark',interior,0)
    # Display shelves are in front of the dark recess, yielding visible stock.
    for z in [.87,1.38,1.89]:
        box('display_shelf',(-1.05,y,z),(.23,w-.12,.055),'woodWarm',interior,.01)
        for j in range(6):
            yy=y-w/2+.15+j*(w-.27)/5
            token=['survivorRed','schoolBusYellow','backpackTeal','windowGlow'][j%4]
            box('snack_package',(-1.12,yy,z+.17),(.13,.15,.27),'picketWhite' if j%5==0 else token,interior,.014)
            box('packet_label',(-1.044,yy,z+.18),(.014,.095,.070),'picketWhite',interior,.003)
    for yy in [y-w/2,y+w/2,y]:box('window_mullion',(-.91,yy,1.78),(.095,.057,1.96),'woodWarm',bevel=.01)
    for z in [.78,2.78]:box('window_rail',(-.91,y,z),(.095,w+.10,.064),'woodWarm',bevel=.01)
    box('window_glow_header',(-1.04,y,2.58),(.025,w-.13,.18),'emi_windowGlow',interior,.01)
    box('window_sill',(-.89,y,.79),(.20,w+.13,.07),'picketWhite')
# Interior layout remains useful with roof hidden.
box('shop_floor',(-2.76,-.25,.32),(2.9,6.73,.065),'woodWarm',interior)
for y in [-2.7,-1.4,.0,1.4,2.65]:
    box('stock_shelf',(-4.02,y,1.05),(.39,1.1,1.42),'backpackTeal',interior)
    for z in [.55,1.1,1.65]:
        box('stock_shelf_edge',(-3.77,y,z),(.09,1.13,.07),'picketWhite',interior)
        for j in range(5):box('stock_item',(-3.83,y-.42+j*.21,z+.18),(.16,.15,.28),['survivorRed','schoolBusYellow','windowGlow'][j%3],interior,.012)
box('checkout',(-2.4,2.40,.88),(.72,1.3,1.10),'survivorRed',interior)
box('countertop',(-2.4,2.4,1.47),(.84,1.42,.10),'picketWhite',interior)
box('register',(-2.4,2.5,1.64),(.31,.34,.27),'uiDark',interior)
# Hinged front leaf, with glazing simulated by framed warm window recess.
box('door_leaf',(-1.02,-1.03,1.51),(.09,1.05,2.35),'asphalt',door)
box('door_lower',(-.963,-1.03,.84),(.018,.88,.80),'backpackTeal',door)
box('door_glazing',(-.96,-1.03,2.04),(.02,.86,1.11),'windowGlow',door)
for yy in [-1.55,-.51]:box('door_stile',(-.926,yy,1.51),(.07,.05,2.35),'sidewalk',door,.01)
for z in [.36,1.39,2.65]:box('door_rail',(-.926,-1.03,z),(.07,1.04,.065),'sidewalk',door,.01)
tube('door_pull',[(-.87,-.63,1.27),(-.80,-.63,1.27),(-.80,-.63,1.58),(-.87,-.63,1.58)],.023,'woodWarm',door)
for z in [.76,2.22]:cyl('door_hinge',(-.94,-1.55,z),.035,.16,'uiDark',door,n=12)
text('PULL',(-.905,-.69,1.83),.19,.09,'uiDark',door)
box('threshold',(-.90,-1.03,.335),(.40,1.19,.07),'picketWhite')
box('ice_badge',(-.88,.50,.62),(.04,1.10,.28),'policeBlue')
text('ICE',(-.849,.5,.63),.71,.19,'picketWhite')

# Store fascia, coping and tar roof, with small HVAC and drainage hardware.
box('shop_fascia',(-2.76,-.25,3.26),(3.55,7.49,.45),'survivorRed',roof,.06)
box('shop_lower_trim',(-2.76,-.25,3.03),(3.59,7.53,.10),'picketWhite',roof)
box('shop_roof',(-2.76,-.25,3.49),(3.54,7.48,.09),'asphalt',roof)
for y in [-3.93,3.43]:box('shop_coping',(-2.76,y,3.58),(3.62,.16,.19),'picketWhite',roof)
for x in [-4.50,-1.02]:box('shop_coping',(x,-.25,3.58),(.16,7.5,.19),'picketWhite',roof)
box('shop_vent',(-3.35,-2.20,3.70),(.63,.55,.26),'sidewalk',roof)
box('shop_vent_lid',(-3.35,-2.2,3.85),(.70,.62,.07),'picketWhite',roof)
tube('drain',[(-4.46,-3.82,.38),(-4.46,-3.82,3.48)],.047,'asphalt')
# Side brand poster on a proud mounting frame.
box('poster_frame',(-2.9,-3.84,1.71),(1.44,.12,1.90),'sidewalk',bevel=.03)
box('poster_blue',(-2.9,-3.908,1.71),(1.27,.023,1.71),'policeBlue',bevel=.018)
logo((-2.9,-3.93,2.16),.30,side=True)
for word,z,w in [('Good Fuel',1.70,.94),('Brighter',1.34,1.0),('Days',1.04,.65)]:text(word,(-2.9,-3.954,z),w,.25,'picketWhite',side=True,font='script')
# OPEN neon sign above front door; warm wall lamps are named separately.
box('open_mount',(-.87,-2.5,2.85),(.11,1.65,.60),'policeBlue')
box('open_dark',(-.805,-2.5,2.85),(.024,1.5,.46),'uiDark')
text('OPEN',(-.783,-2.5,2.85),1.22,.31,'emi_sirenRed')
pts=[(-.776,-3.24,2.64),(-.776,-3.24,3.06),(-.776,-1.76,3.06),(-.776,-1.76,2.64)]
tube('open_neon_border',pts,.021,'emi_policeBlue',closed=True)
for x,y,side in [(-3.85,-3.86,True),(-1.8,-3.86,True)]:
    lamp=empty('lamp_shop_'+str(x),(x,y,2.86),root)
    box('lamp_back',(x,y,2.98),(.19,.12,.24),'uiDark',lamp)
    box('lamp_lens',(x,y-.04,2.85),(.24,.20,.07),'emi_windowGlow',lamp)

# Canopy: chunky trim, inset fascia panels and raised diagonal brand slashes.
box('canopy_body',(1.3,-.25,4.24),(5.86,7.57,.66),'survivorRed',roof,.075)
box('canopy_lower_edge',(1.3,-.25,3.91),(5.98,7.69,.12),'picketWhite',roof,.04)
# A perimeter frame avoids a second broad face just below the tar surface.
for y in [-4.005,3.505]:box('canopy_upper_edge',(1.3,y,4.60),(5.98,.18,.16),'picketWhite',roof,.045)
for x in [-1.6,4.2]:box('canopy_upper_edge',(x,-.25,4.60),(.18,7.33,.16),'picketWhite',roof,.045)
box('roof_subdeck',(1.3,-.25,4.60),(5.55,7.26,.025),'uiDark',roof,.006)
for ix in range(3):
    for iy in range(3):
        box('tar_roof_panel',(1.3+(ix-1)*5.57/3,-.25+(iy-1)*7.28/3,4.687),(5.57/3-.022,7.28/3-.022,.024),'asphalt',roof,.005)
for y in [-3.91,3.41]:
    box('canopy_parapet',(1.3,y,4.77),(5.74,.10,.15),'sidewalk',roof,.015)
    box('canopy_blue_side',(1.25,y+(-.151 if y<0 else .151),4.25),(5.52,.026,.47),'policeBlue',roof,.015)
for x in [-1.55,4.15]:box('canopy_parapet',(x,-.25,4.77),(.10,7.30,.15),'sidewalk',roof,.015)
box('canopy_brand_back',(4.254,-.70,4.24),(.033,5.06,.50),'policeBlue',roof,.024)
text('Sunset Fuel',(4.283,-.70,4.25),4.60,.40,'picketWhite',roof)
for y in [2.24,2.69]:
    o=box('brand_slash',(4.285,y,4.25),(.02,.27,.49),'picketWhite' if y<2.5 else 'schoolBusYellow',roof,.005);o.rotation_euler.x=-.4
box('side_logo_mount',(1.45,-4.087,4.24),(1.1,.06,.54),'survivorRed',roof)
logo((1.45,-4.13,4.24),.235,roof,side=True)
# Strong supports with yellow collision guards, visible base plates and bolts.
for y in [-2.78,2.28]:
    box('column',(1.75,y,2.20),(.39,.43,3.75),'picketWhite')
    box('column_base',(1.75,y,.60),(.59,.64,.58),'schoolBusYellow',bevel=.045)
    box('column_base_plate',(1.75,y,.32),(.72,.77,.08),'woodWarm')
    for xx in [1.48,2.02]:
        for yy in [y-.30,y+.30]:cyl('base_bolt',(xx,yy,.374),.027,.028,'uiDark',n=8)
# Recessed under-canopy illumination.
for x in [.10,2.5]:
    for y in [-2.3,1.8]:
        box('canopy_fixture',(x,y,3.86),(.45,.72,.10),'uiDark',roof)
        box('canopy_lens',(x,y,3.796),(.36,.61,.035),'emi_windowGlow',roof)
# Roof seams and two low HVAC boxes with grills/fan rings.
for x,y,sx,sy in [(.0,-.1,1.40,1.0),(-.76,.12,.50,.64)]:
    box('hvac_foot',(x,y,4.76),(sx-.1,sy-.12,.14),'woodWarm',roof)
    box('hvac_body',(x,y,4.94),(sx,sy,.30),'sidewalk',roof,.045)
    box('hvac_lid',(x,y,5.11),(sx+.06,sy+.06,.08),'picketWhite',roof)
    if sx>1:
        cyl('fan_recess',(x,y,5.158),.31,.015,'uiDark',roof,n=32)
        for j in range(7):box('fan_grill',(x-.26+j*.086,y,5.175),(.026,.54,.019),'asphalt',roof,.003)
        box('hvac_vent',(x+sx/2+.012,y,4.96),(.014,.67,.18),'uiDark',roof,.004)
        for j in range(4):box('vent_louver',(x+sx/2+.028,y,4.90+j*.043),(.028,.61,.018),'asphalt',roof,.003)

# Two curbed fuel islands and three pumps, all with digital readouts and hoses.
for y in [-1.97,1.61]:
    box('fuel_island',(1.76,y,.38),(4.49,1.14,.20),'schoolBusYellow',bevel=.075)
    box('island_top',(1.76,y,.493),(4.25,.94,.025),'sidewalk',bevel=.03)

def pump(x,y,token,index):
    z=.51
    box('pump_foot',(x,y,z+.06),(.89,.74,.12),'uiDark')
    box('pump_cabinet',(x,y,z+.79),(.80,.66,1.47),token,bevel=.045)
    box('pump_cream_side',(x,y-.34,z+.97),(.69,.025,1.58),'picketWhite',bevel=.012)
    box('pump_face',(x+.416,y,z+.93),(.025,.56,1.12),token,bevel=.012)
    box('pump_cream_front',(x+.433,y,z+.96),(.015,.49,.72),'picketWhite',bevel=.009)
    box('pump_head',(x,y,z+1.86),(.98,.82,.34),token,bevel=.055)
    box('pump_top_inset',(x,y,z+2.041),(.54,.48,.016),'schoolBusYellow',bevel=.022)
    box('pump_display_frame',(x+.428,y,z+1.52),(.045,.60,.51),'asphalt',bevel=.018)
    box('pump_display',(x+.457,y,z+1.54),(.018,.50,.38),'uiDark',bevel=.008)
    text('0.00',(x+.477,y,z+1.63),.37,.12,'schoolBusYellow')
    text('00.00',(x+.477,y,z+1.47),.37,.10,'windowGlow')
    box('payment_plate',(x+.453,y,z+1.02),(.035,.55,.35),'picketWhite',bevel=.012)
    box('card_slot',(x+.478,y+.13,z+1.06),(.017,.11,.045),'uiDark',bevel=.004)
    box('receipt_slot',(x+.478,y,z+.88),(.019,.28,.03),'uiDark',bevel=.003)
    for j in range(3):box('grade_button',(x+.480,y-.18+j*.18,z+1.13),(.022,.115,.073),['schoolBusYellow','survivorRed','policeBlue'][j],bevel=.009)
    box('service_panel',(x+.43,y,z+.37),(.026,.58,.51),token,bevel=.014)
    for yy in [y-.25,y+.25]:
        for zz in [z+.16,z+.57]:cyl('pump_screw',(x+.448,yy,zz),.014,.011,'sidewalk',axis='x',n=8,bevel=0)
    logo((x+.506,y,z+1.86),.105)
    logo((x,y-.365,z+1.48),.15,side=True)
    for side in [-1,1]:
        yy=y+side*.39
        box('nozzle_holster',(x+.13,yy,z+1.12),(.21,.085,.29),'uiDark',bevel=.025)
        handle=box('nozzle_grip',(x+.20,yy+side*.025,z+1.09),(.115,.075,.24),'asphalt',bevel=.015);handle.rotation_euler.y=-.32
        tube('nozzle_spout',[(x+.21,yy,z+1.20),(x+.10,yy,z+1.31),(x+.01,yy,z+1.31)],.022,'sidewalk')
        # Smooth purpose-built hose loop with ground clearance, no self overlap.
        pts=[(x+.05,yy,z+1.54),(x-.18,yy+side*.13,z+1.28),(x-.44,yy+side*.18,z+.66),(x-.52,yy+side*.16,z+.22),(x-.40,yy+side*.17,z+.09),(x-.12,yy+side*.18,z+.10),(x+.15,yy+side*.12,z+.36),(x+.21,yy+side*.04,z+.99)]
        tube('fuel_hose',pts,.036,'uiDark')
    text(str(index),(x+.520,y+.30,z+1.85),.075,.12,'picketWhite')
pump(.30,-1.97,'policeBlue',1);pump(3.10,-1.97,'survivorRed',2);pump(3.00,1.61,'survivorRed',3)

# Tall two-post roadside sign: sunset emblem, segmented prices and town panel.
SX,SY=4.40,4.47
for y in [SY-.91,SY+.91]:
    box('price_post',(SX,y,3.72),(.18,.18,6.88),'asphalt')
    box('post_foot',(SX,y,.37),(.47,.46,.14),'woodWarm')
    box('post_baseplate',(SX,y,.48),(.31,.30,.08),'sidewalk')
box('brand_sign_frame',(SX,SY,6.78),(.32,2.32,1.82),'picketWhite',bevel=.16)
box('brand_sign_blue',(SX+.177,SY,6.78),(.055,2.12,1.62),'policeBlue',bevel=.12)
logo((SX+.217,SY,6.78),.60)
# Back face uses the same fictional brand and readable letters.
box('sign_back',(SX-.18,SY,6.78),(.04,2.10,1.60),'policeBlue',bevel=.10)
for i,(word,price) in enumerate([('REG','3.49'),('PLUS','3.79'),('DIESEL','3.99')]):
    z=5.49-i*.65
    box('price_row_frame',(SX,SY,z),(.30,2.38,.62),'sidewalk',bevel=.05)
    box('fuel_label',(SX+.171,SY-.56,z),(.04,1.10,.51),'backpackTeal',bevel=.03)
    box('price_dark',(SX+.174,SY+.58,z),(.045,1.03,.51),'uiDark',bevel=.025)
    text(word,(SX+.201,SY-.56,z),.85,.24,'picketWhite')
    # Seven segment raised luminous numbers match reference digital typography.
    digits={'3':'abgcd','4':'fgbc','7':'abc','9':'abfgcd'}
    for j,ch in enumerate(price):
        cy=SY+.19+j*.245
        if ch=='.':box('decimal',(SX+.208,cy-.06,z-.145),(.013,.042,.040),'emi_sirenRed',bevel=.007);continue
        cy=SY+.18+(j-(1 if j>1 else 0))*.30
        seg={'a':(0,.175,.16,.022),'g':(0,0,.16,.022),'d':(0,-.175,.16,.022),'f':(-.086,.085,.022,.145),'b':(.086,.085,.022,.145),'e':(-.086,-.085,.022,.145),'c':(.086,-.085,.022,.145)}
        for key in digits[ch]:
            dy,dz,w,h=seg[key];box('price_segment',(SX+.210,cy+dy,z+dz),(.016,w,h),'emi_sirenRed',bevel=.006)
box('town_frame',(SX,SY,2.76),(.33,2.35,1.96),'picketWhite',bevel=.09)
box('town_blue',(SX+.19,SY,2.76),(.06,2.15,1.76),'policeBlue',bevel=.065)
text('SUNSET',(SX+.231,SY+.20,3.26),1.58,.26,'picketWhite')
text('GROVE',(SX+.231,SY+.20,2.92),1.51,.26,'picketWhite')
box('town_rule',(SX+.235,SY,2.66),(.015,1.77,.035),'schoolBusYellow',bevel=.006)
text('A Brighter',(SX+.238,SY,2.39),1.72,.27,'picketWhite',font='script')
text('Tomorrow',(SX+.238,SY,2.06),1.71,.27,'picketWhite',font='script')
# Fastener heads sit clear of all painted sign faces.
for z in [2.0,3.52,6.12,7.43]:
    for y in [SY-.96,SY+.96]:cyl('sign_bolt',(SX+.24,y,z),.021,.018,'woodWarm',axis='x',n=8,bevel=.003)
# Sparse coarse wear adds depth without noisy texture.
for i in range(32):
    x=rng.uniform(-4.8,4.8);y=rng.uniform(-4.4,5.4)
    box('paver_chip',(x,y,.303),(rng.uniform(.025,.12),rng.uniform(.025,.10),.013),'woodWarm',bevel=.004)
for y in [-3.59,3.08]:
    for z in [.94,1.85,2.61]:box('stucco_patch',(-.968,y+.06,z),(.017,.13,.10),'sidewalk',bevel=.012)

# Masonry courses, coping seams, fasteners and subtle finish damage.
for y,w in [(-2.66,1.50),(.53,1.51),(2.27,1.36)]:
    for yy in [y-w/3,y+w/3]:box('plinth_joint',(-.977,yy,.51),(.012,.018,.36),'asphalt',bevel=.003)
    box('plinth_course',(-.975,y,.53),(.012,w,.015),'woodWarm',bevel=.003)
for y in [-3.3,-2.0,-.7,.6,1.9,3.2]:
    box('fascia_seam',(4.273,y,4.25),(.012,.012,.47),'asphalt',roof,.002)
    for z in [4.02,4.49]:cyl('fascia_fastener',(4.290,y,z),.016,.012,'sidewalk',roof,n=8,axis='x',bevel=.002)
for x in [-1.15,.15,1.45,2.75,3.9]:
    box('coping_seam',(x,-3.96,4.691),(.020,.16,.013),'woodWarm',roof,.002)
for y in [-2.78,2.28]:
    for j in range(5):
        box('guard_chip',(1.75+rng.uniform(-.22,.22),y-.330,.40+rng.random()*.40),(.045,.013,.060),'woodWarm',bevel=.008)
for y,w in [(-2.66,1.50),(.53,1.51),(2.27,1.36)]:
    tube('window_glint',[(-.849,y-.33,2.27),(-.849,y-.05,2.59)],.009,'windowGlow')

# Merge static geometry by palette, preserving visibility groups and hinge.
parents=[root,roof,interior,door]+[o for o in root.children if o.name.startswith('lamp_shop')]
def merge_by_material(objects,suffix=''):
    for parent in parents:
        for m in M.values():
            group=[o for o in objects if o.parent==parent and o.data.materials[0]==m]
            if not group:continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in group:o.select_set(True)
            bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();joined=group[0]
            objects=[o for o in objects if o not in group]+[joined]
            joined.name=parent.name+'_'+m.name+suffix
            bpy.context.scene.cursor.location=parent.matrix_world.translation;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
            bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return objects
meshes=merge_by_material([o for o in bpy.context.scene.objects if o.type=='MESH'])
for o in meshes:o.data.calc_loop_triangles()
raw_tri=sum(len(o.data.loop_triangles) for o in meshes)
if raw_tri>95000:
    for o in meshes:
        bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('hero triangle budget','DECIMATE');mod.ratio=94500/raw_tri;bpy.ops.object.modifier_apply(modifier=mod.name)
def clean_triangles(o):
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bad=[f for f in bm.faces if f.calc_area()<1e-11]
    if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
    bm.to_mesh(o.data);bm.free();o.data.update()
for o in meshes:clean_triangles(o)
# Runtime-owned lights exported as semantic anchors, never KHR lights.
for name,loc,kind,group in [('canopy',(1.4,-.25,3.76),'area',roof),('shop',(-.85,-.25,2.2),'window',interior),('open',(-.75,-2.5,2.85),'neon',root),('prices',(SX+.24,SY,4.8),'neon',root)]:
    anchor=empty('light:'+name,loc,root)
    if name!='canopy':anchor.rotation_euler=(0,-math.pi/2,0)
    anchor['ss_light']=json.dumps({'type':kind,'color':'light_window_warm' if kind!='neon' else 'light_siren_red','intensity':2,'range':6,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[o.name for o in meshes if o.parent==group and o.data.materials[0].name.startswith('emi_')],'tiers':'all'})
for lamp in [q for q in parents if q.name.startswith('lamp_shop')]:
    anchor=empty('light:'+lamp.name,tuple(lamp.location),root)
    anchor['ss_light']=json.dumps({'type':'area','color':'light_window_warm','intensity':1.5,'range':3,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[o.name for o in meshes if o.parent==lamp and o.data.materials[0].name.startswith('emi_')],'tiers':'all'})
for name,loc,size in [('shop',(-2.76,-.25,1.85),(3.40,7.15,3.1)),('columnL',(1.75,-2.78,2.2),(.4,.44,3.75)),('columnR',(1.75,2.28,2.2),(.4,.44,3.75)),('sign',(SX,SY,3.8),(.4,2.4,7.2)),('pump1',(.30,-1.97,1.56),(.98,.82,2.16)),('pump2',(3.1,-1.97,1.56),(.98,.82,2.16)),('pump3',(3.0,1.61,1.56),(.98,.82,2.16))]:
    col=empty('col:'+name,loc,root);col['collider']='cuboid';col['size']=size
# Center complete lot on X/Y and place lower kerb edge at zero.
bpy.context.view_layer.update();points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
shift=Vector(((min(q.x for q in points)+max(q.x for q in points))/2,(min(q.y for q in points)+max(q.y for q in points))/2,min(q.z for q in points)))
for o in list(root.children):o.location-=shift
bpy.context.view_layer.update()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=713;scene.cycles.device='CPU'
if a.glb:
    scene.render.bake.target='VERTEX_COLORS';bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        layer=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER');o.data.color_attributes.active_color=layer;o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.bake(type='AO',use_clear=True)
for o in meshes:o.data.calc_loop_triangles()
tri=sum(len(o.data.loop_triangles) for o in meshes)
report={'id':'bld.gas-station','tier':'Hero','triangles':tri,'draw_calls':len(meshes),'materials':sorted({o.data.materials[0].name for o in meshes}),'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','roof','interior','door_front','light:canopy','light:shop','col:shop']),'within_budget':tri<=100000 and len(meshes)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
# Rendering must not overwrite the result of an already verified export.
if a.glb:(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
root['lods']=json.dumps({'LOD0':'model.glb','LOD1':'model.lod1.glb','LOD2':'model.lod2.glb'})
if a.glb:
    asset=list(scene.objects);bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    def export(path):bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    path=Path(a.glb).resolve();export(path)
    anchors=[o for o in asset if 'ss_light' in o]
    anchor_data={o:o['ss_light'] for o in anchors}
    distant={'pal_survivorRed':'pal_survivorRed','pal_policeBlue':'pal_policeBlue','pal_backpackTeal':'pal_policeBlue','pal_picketWhite':'pal_picketWhite','pal_schoolBusYellow':'pal_picketWhite','pal_windowGlow':'pal_picketWhite'}
    export_lods(path, meshes)

if a.render:
    world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.17,.25,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));o=bpy.context.object
    m=bpy.data.materials.new('studio_ground');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.026,.021,.033,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1;o.data.materials.append(m)
    for loc,power,size,color in [((10,-8,14),3100,8,(1,.76,.53)),((-5,1,12),2200,7,(.66,.71,1)),((2,7,11),2200,6,(1,.45,.24)),((13,-8,7),1100,8,(1,.84,.68))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
    for loc in [(-.3,-2.5,2.2),(-.3,.6,2.2),(-2.0,-.2,2.3),(2.3,-.5,3.6)]:
        bpy.ops.object.light_add(type='POINT',location=loc);o=bpy.context.object;o.data.energy=75;o.data.color=(1,.53,.21);o.data.shadow_soft_size=.7
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;target=Vector((0,0,3.4))
    views={'ref':(22,-17,15),'game':(18,-18,24),'front':(24,0,9),'side':(0,-24,10),'rear':(-18,22,18)}
    cam.location=views[a.view];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=23.5 if a.view=='game' else 21.2
    scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=views['game'];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=23.5
        scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        out=Path(a.render).resolve();scene.render.filepath=str(out.with_name('game.png' if out.name=='hero.png' else out.stem.replace('-ref','')+'-game.png'))
        bpy.ops.render.render(write_still=True)
    print('RENDER OK')
