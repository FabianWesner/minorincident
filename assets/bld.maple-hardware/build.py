"""Maple Hardware — deterministic geometry-only Hero building, metres, +X front.
All signage has >= 3 mm clearance. Root, roof and interior are visibility
assemblies; door_front and the three lamps retain their joint origins.
Run through tools/blender/build.py with the headless asset pipeline.
"""
import argparse, json, math, random, subprocess, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
# Damage deliveries reuse these native primitives before batching.
from sslib.commerce_damage import consume_arguments, build_variants, finish_native
COMMERCE = consume_arguments()
if COMMERCE and COMMERCE['dispatch']:
    build_variants(Path(__file__), COMMERCE['decay'], COMMERCE['output'], COMMERCE['tierOnly'])
    sys.exit(0)

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
for key in ('render', 'glb'): p.add_argument('--' + key)
p.add_argument('--view', default='ref', choices=['ref','game','front','side','rear'])
for key, default in [('samples',24),('width',960),('height',540)]: p.add_argument('--'+key,type=int,default=default)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = random.Random(731)
DISTANT = bool(COMMERCE)
COLORS = {'woodWarm':'c18440','schoolBusYellow':'e8b568','sidewalk':'c6afa0',
          'asphalt':'756577','uiDark':'34303e','picketWhite':'f2dfc6',
          'brick':'a8483a','backpackTeal':'2f6e6a','windowGlow':'ffb344'}
M = {}
for token, color in COLORS.items():
    rgb = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgba = tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
    m=bpy.data.materials.new('pal_'+token); m.use_nodes=True; m.diffuse_color=rgba
    bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=rgba
    bs.inputs['Roughness'].default_value=.72
    M[token]=m
m=M['windowGlow'].copy();m.name='emi_windowGlow'; M['glow']=m
bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Emission Color'].default_value=m.diffuse_color;bs.inputs['Emission Strength'].default_value=3.5

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc
    if parent:
        bpy.context.view_layer.update();w=o.matrix_world.copy();o.parent=parent;o.matrix_world=w
    return o
root=empty('root');root['asset_id']='bld.maple-hardware';root['tier']='Hero'
roof=empty('roof',parent=root);inside=empty('interior',parent=root)
door=empty('door_front',(2.87,-4.18,.30),root)
cart_wheels=[]
lamps=[empty('lamp_'+str(i),(2.91,y,4.94),root) for i,y in enumerate([-4.1,0,4.1])]

def finish(o,name,mat,parent=root,bevel=0):
    o.name=name;o.data.materials.append(M[mat])
    bpy.context.view_layer.objects.active=o
    if bevel and not COMMERCE:
        mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=2 if bevel>=.025 and not DISTANT else 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update();w=o.matrix_world.copy();o.parent=parent;o.matrix_world=w
    return o

def box(name,loc,size,mat,parent=root,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,min(bevel,min(size)*.35))

def cyl(name,loc,r,depth,mat,parent=root,axis='z',n=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=min(n, 8 if COMMERCE and COMMERCE['tier']==2 else 12) if COMMERCE else n,radius=r,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='x':o.rotation_euler.y=math.pi/2
    if axis=='y':o.rotation_euler.x=math.pi/2
    return finish(o,name,mat,parent,0 if DISTANT else .009)

def tube(name,points,r,mat,parent=root):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=0 if DISTANT else 2
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for q,v in zip(s.points,points):q.co=(*v,1)
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,name,mat,parent)

font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf')
FRONT=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_quaternion()
SIDE=Matrix(((-1,0,0),(0,0,1),(0,1,0))).to_quaternion()
def text(word,loc,w,h,mat,side=False,parent=root):
    bpy.ops.object.select_all(action='DESELECT');bpy.ops.object.text_add(location=loc);o=bpy.context.object
    o.rotation_mode='QUATERNION';o.rotation_quaternion=SIDE if side else FRONT
    o.data.body=word;o.data.font=font;o.data.size=1;o.data.extrude=0 if DISTANT else .006;o.data.bevel_depth=0 if DISTANT else .002
    o.data.resolution_u=1 if DISTANT else 3;o.data.bevel_resolution=0
    bpy.ops.object.convert(target='MESH');o=bpy.context.object
    xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices]
    cx=(max(xs)+min(xs))/2;cy=(max(ys)+min(ys))/2
    for v in o.data.vertices:
        v.co.x=(v.co.x-cx)*w/(max(xs)-min(xs));v.co.y=(v.co.y-cy)*h/(max(ys)-min(ys))
    return finish(o,'raised_'+word,mat,parent)

# Minimal footprint pavement. Every paver has a genuine recessed seam.
box('slab',(.55,0,.10),(7.35,11.4,.20),'sidewalk',bevel=.06)
for x in [-2.6,-1.5,-.4,.7,1.8,2.9,3.85]:
    for j in range(10):
        box('paver',(x,-5.08+j*1.13,.235),(1.06 if x!=3.85 else .8,1.09,.07),'sidewalk',bevel=.018)
for j in range(11):box('front_kerbstone',(4.20,-5.15+j*1.03,.13),(.20,.99,.26),'sidewalk',bevel=.035)
# Shell with real entrance/display openings, not window decals on a solid box.
box('rear_wall',(-2.68,0,2.64),(.24,10.5,4.72),'woodWarm')
for y in [-5.16,5.16]:box('side_wall',(0,y,2.64),(5.12,.24,4.72),'woodWarm')
box('front_upper',(2.66,0,4.00),(.28,10.55,1.70),'woodWarm')
box('front_sill',(2.66,.5,.65),(.28,9.5,.72),'woodWarm')
# Opening intervals: entrance [-4.18,-3.08], left display [-2.8,-.35], right display [.55,3.55].
for y,w in [(-4.76,.72),(-2.96,.25),(.10,.85),(4.40,1.60)]:
    box('front_pier',(2.66,y,1.99),(.28,w,2.42),'woodWarm')
box('floor',(0,0,.34),(5.10,10.18,.12),'asphalt',inside)
# Side/rear masonry courses: widely spaced soft ochre blocks with visible seams.
for side in [-1,1]:
    for row in range(7):
        z=.64+row*.60
        for j in range(8):
            x=-2.48+j*.67
            box('masonry',(x,side*5.295,z),(.648,.055,.578),'schoolBusYellow' if (j+row)%6==0 else 'woodWarm',bevel=.015)
    box('wall_plinth',(0,side*5.34,.57),(5.22,.11,.52),'asphalt')
for row in range(8):
    for j in range(12):
        box('rear_course',(-2.814,-4.89+j*.89,.61+row*.55),(.035,.865,.53),'woodWarm',bevel=.012)
# Cream/gold corner quoins and bottom trim.
for x in [-2.68,2.68]:
    for y in [-5.23,5.23]:
        for row in range(7):box('corner_quoin',(x,y,.64+row*.63),(.42,.42,.61),'schoolBusYellow',bevel=.04)
for y,w in [(-4.79,.55),(-2.95,.20),(.1,.75),(4.43,1.42)]:box('front_plinth',(2.83,y,.61),(.065,w,.56),'asphalt')
# Flat mauve roof and jointed parapet coping, all belong to the hideable roof.
box('roof_deck',(0,0,4.83),(5.34,10.5,.22),'asphalt',roof,.045)
for i in range(4):
    for j in range(8):box('roof_panel',(-1.92+i*1.28,-4.52+j*1.29,4.965),(1.26,1.27,.025),'asphalt',roof,.007)
for x in [-2.7,2.7]:
    for j in range(11):box('coping',(x,-4.58+j*.916,5.14),(.38,.898,.35),'schoolBusYellow',roof,.035)
for y in [-5.24,5.24]:
    for i in range(6):box('coping',(-2.24+i*.89,y,5.14),(.867,.38,.35),'schoolBusYellow',roof,.035)
# Fascia and large physical raised lettering.
box('sign_border',(2.87,0,4.19),(.095,10.58,1.13),'woodWarm')
box('gold_sign',(2.937,0,4.19),(.055,10.43,1.02),'schoolBusYellow')
text('MAPLE HARDWARE',(2.977,0,4.21),8.82,.77,'uiDark')
box('trade_fascia',(2.92,0,3.37),(.19,10.73,.61),'uiDark',bevel=.04)
text('TOOLS · PAINT · PLUMBING · MORE',(3.028,0,3.39),8.48,.35,'picketWhite')
for y in [-5.02,5.02]:
    for z in [3.98,4.57]:cyl('sign_bolt',(2.982,y,z),.022,.025,'woodWarm',axis='x',n=8)
# Frames are built around glowing inset recesses filled with actual stock.
def display(y,width):
    box('display_back',(2.34,y,1.98),(.05,width,1.86),'glow',inside,.018)
    box('display_bottom',(2.53,y,1.00),(.52,width,.14),'asphalt')
    for yy in [y-width/2,y+width/2]:box('frame_stile',(2.91,yy,1.97),(.14,.105,1.98),'asphalt')
    for z in [1.05,1.96,2.90]:box('frame_rail',(2.94,y,z),(.15,width+.10,.09),'asphalt')
    for yy in [y-width/6,y+width/6]:box('mullion',(2.94,yy,1.97),(.12,.07,1.90),'woodWarm')
    box('hood',(2.91,y,3.00),(.45,width+.20,.20),'asphalt',bevel=.055)
    box('hood_edge',(3.14,y,2.93),(.05,width+.23,.08),'sidewalk')
    for z in [1.24,2.15]:
        box('display_shelf',(2.58,y,z-.12),(.44,width-.13,.08),'woodWarm',inside)
        for j in range(int(width/.37)):
            yy=y-width/2+.25+j*.37
            if j%3:
                cyl('paint_tin',(2.65,yy,z+.10),.13,.31,'brick' if j%2 else 'schoolBusYellow',inside,n=12)
                cyl('tin_lid',(2.65,yy,z+.27),.136,.032,'picketWhite',inside,n=12)
                box('tin_label',(2.789,yy,z+.10),(.014,.14,.10),'picketWhite',inside,.005)
            else:
                box('stock_box',(2.65,yy,z+.10),(.29,.30,.31),'schoolBusYellow',inside,.035)
                box('carton_label',(2.804,yy,z+.10),(.018,.20,.17),'picketWhite',inside,.008)
                box('carton_mark',(2.820,yy,z+.10),(.012,.10,.034),'brick',inside,.003)
display(-1.57,2.43);display(2.04,3.00)
# Entrance leaf and hardware, grouped on its vertical hinge.
box('entrance_leaf',(2.86,-3.63,1.65),(.10,1.04,2.68),'asphalt',door)
box('door_window',(2.924,-3.63,2.17),(.015,.76,1.25),'glow',door,.012)
for y in [-4.07,-3.19]:box('door_stile',(2.952,y,1.67),(.052,.08,2.57),'sidewalk',door,.01)
for z in [.37,1.45,2.84]:box('door_rail',(2.951,-3.63,z),(.052,.95,.07),'sidewalk',door,.01)
box('door_lower_inset',(2.923,-3.63,.91),(.02,.79,.90),'uiDark',door,.012)
tube('door_pull',[(2.94,-3.25,1.46),(3.04,-3.25,1.46),(3.04,-3.25,1.78),(2.94,-3.25,1.78)],.025,'uiDark',door)
for z in [.72,2.55]:cyl('hinge',(2.95,-4.16,z),.03,.16,'uiDark',door)
box('threshold',(2.97,-3.63,.33),(.53,1.24,.08),'sidewalk')
box('doormat',(3.32,-3.62,.325),(.48,1.04,.025),'asphalt',bevel=.02)
box('hours_plate',(2.865,-2.96,1.79),(.04,.16,.27),'picketWhite',bevel=.008)
# Side mural raised above the masonry. Readable at the game camera.
box('side_mural',(0,5.365,2.62),(3.83,.085,2.89),'uiDark',bevel=.04)
for word,z,w,mat in [('BUILD A',3.56,2.75,'picketWhite'),('BRIGHTER',2.91,3.05,'picketWhite'),('SUNSET GROVE',2.26,3.24,'schoolBusYellow'),('TOGETHER',1.61,3.08,'picketWhite')]:
    text(word,(0,5.42,z),w,.46,mat,side=True)
for x in [-1.77,1.77]:
    for z in [1.29,3.95]:cyl('mural_bolt',(x,5.431,z),.025,.022,'schoolBusYellow',axis='y',n=8)
# Front tool plaque: a hammer and open-jaw spanner, not a font glyph.
box('tools_plaque',(2.875,4.42,2.34),(.08,1.24,1.38),'uiDark',bevel=.04)
for sign in [-1,1]:
    o=box('tool_handle',(2.936,4.42,2.29),(.032,.12,1.04),'sidewalk',bevel=.018);o.rotation_euler.x=sign*.61
# Hammer head at upper left and open wrench jaw at upper right.
o=box('hammer_head',(2.939,4.10,2.72),(.044,.44,.19),'sidewalk',bevel=.035);o.rotation_euler.x=.61
for yy,zz in [(4.67,2.72),(4.80,2.66)]:
    o=box('wrench_jaw',(2.941,yy,zz),(.04,.12,.31),'sidewalk',bevel=.023);o.rotation_euler.x=-.61
box('wrench_throat',(2.942,4.67,2.53),(.04,.25,.14),'sidewalk',bevel=.025)
# Three layered notices, all clear of plaque/wall and of their own ink.
for i in range(3):
    y=4.00+i*.38;z=1.10+(i%2)*.03
    box('notice',(2.855,y,z),(.028,.33,.47),'picketWhite',bevel=.008)
    box('notice_header',(2.878,y,z+.12),(.012,.25,.058),'asphalt',bevel=.003)
    for k in range(3):box('notice_ink',(2.879,y,z+.035-k*.067),(.012,.22-k*.024,.02),'woodWarm',bevel=.003)
# Gooseneck lamps: flange, curved arm, conical enamel shade, recessed glowing lens.
for group,y in zip(lamps,[-4.1,0,4.1]):
    cyl('lamp_flange',(2.91,y,4.94),.105,.075,'uiDark',group,axis='x')
    tube('gooseneck',[(2.96,y,4.94),(3.13,y,5.04),(3.31,y,5.02),(3.42,y,4.93),(3.43,y,4.99)],.045,'uiDark',group)
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.23,radius2=.085,depth=.20,location=(3.43,y,4.89))
    finish(bpy.context.object,'lamp_shade','uiDark',group,.012)
    cyl('shade_lip',(3.43,y,4.793),.237,.042,'uiDark',group)
    cyl('lamp_lens',(3.43,y,4.762),.184,.023,'glow',group)
# Roof plant: two fan condenser, tall rear package unit, ductwork and small vent.
def hvac(x,y,w,d,h,fans=False):
    base=4.99
    for yy in [y-w*.36,y+w*.36]:box('unit_foot',(x,yy,base+.09),(d+.13,.13,.15),'uiDark',roof)
    box('hvac_shell',(x,y,base+h/2+.16),(d,w,h),'sidewalk',roof,.07)
    box('unit_lid',(x,y,base+h+.18),(d+.08,w+.08,.10),'asphalt',roof,.035)
    for yy in [y-w/2+.13,y+w/2-.13]:box('lid_rim',(x,yy,base+h+.24),(d,.075,.10),'sidewalk',roof)
    for xx in [x-d/2+.08,x+d/2-.08]:box('lid_rim',(xx,y,base+h+.24),(.075,w,.10),'sidewalk',roof)
    for yy in [y-w*.25,y+w*.25]:
        box('top_grille',(x,yy,base+h+.245),(d*.71,w*.40,.035),'uiDark',roof,.016)
        for i in range(6):box('top_louver',(x-d*.28+i*d*.112,yy,base+h+.269),(.018,w*.36,.015),'asphalt',roof,.004)
    if fans:
        for yy in [y-w*.25,y+w*.25]:
            box('fan_panel',(x+d/2+.023,yy,base+h*.53),(.032,w*.44,h*.76),'asphalt',roof,.025)
            cyl('fan_recess',(x+d/2+.046,yy,base+h*.53),min(w*.18,h*.27),.025,'uiDark',roof,axis='x',n=28)
            # Ring, hub and three broad blades sit beyond the backing.
            r=min(w*.17,h*.25)
            bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.022,major_segments=28,minor_segments=8,location=(x+d/2+.073,yy,base+h*.53),rotation=(0,math.pi/2,0))
            finish(bpy.context.object,'fan_ring','sidewalk',roof)
            cyl('fan_hub',(x+d/2+.083,yy,base+h*.53),.055,.04,'sidewalk',roof,axis='x')
            for k in range(3):
                ang=k*math.tau/3
                o=box('fan_blade',(x+d/2+.081,yy+math.sin(ang)*r*.46,base+h*.53+math.cos(ang)*r*.46),(.026,.065,r*.88),'asphalt',roof,.012);o.rotation_euler.x=-ang
    else:
        for yy in [y-w*.25,y+w*.25]:
            box('access_panel',(x+d/2+.026,yy,base+h*.54),(.025,w*.43,h*.76),'asphalt',roof,.032)
            box('access_inset',(x+d/2+.047,yy,base+h*.54),(.015,w*.36,h*.64),'sidewalk',roof,.026)
    for yy in [y-w/2-.02,y+w/2+.02]:
        box('unit_side_border',(x,yy,base+h*.53),(d*.82,.028,h*.77),'asphalt',roof,.025)
        box('unit_side_inset',(x,yy+(.022 if yy>y else -.022),base+h*.53),(d*.70,.017,h*.65),'sidewalk',roof,.024)
    for xx in [x-d/2-.016,x+d/2+.016]:
        box('side_access',(xx,y,base+h*.52),(.02,w*.80,h*.65),'woodWarm',roof,.025)
        for yy in [y-w*.34,y+w*.34]:
            for zz in [base+h*.25,base+h*.80]:cyl('unit_bolt',(xx+(.016 if xx>x else -.016),yy,zz),.017,.018,'uiDark',roof,axis='x',n=8)
hvac(1.45,2.20,1.90,1.18,1.04,True)
hvac(-1.82,2.55,1.91,1.24,1.71)
hvac(-1.24,-2.72,.86,.73,.48)
for i in range(6):box('vent_louver',(-.849,-2.72,5.20+i*.045),(.025,.63,.02),'asphalt',roof,.004)
tube('condenser_pipe',[(-1.12,3.39,5.56),(-.81,3.39,5.56),(-.69,3.39,5.37),(-.69,3.39,5.04)],.073,'uiDark',roof)
box('roof_brick',(-1.38,-1.33,5.04),(.41,.46,.15),'woodWarm',roof,.025)
# Pavement merchandising: sewn soft bags on a slatted pallet, a crate, a cart.
def crate(x,y,z,s=.72):
    box('crate_body',(x,y,z+s*.40),(s*.76,s*.91,s*.75),'woodWarm',bevel=.045)
    for yy in [y-s*.47,y+s*.47]:
        for zz in [z+.10,z+s*.77]:box('crate_rail',(x,yy,zz),(s,.085,.10),'schoolBusYellow')
    for xx in [x-s*.46,x+s*.46]:
        for yy in [y-s*.46,y+s*.46]:box('crate_corner',(xx,yy,z+s*.41),(.09,.09,s*.83),'woodWarm')
    for j in range(3):box('crate_top',(x-s*.27+j*s*.27,y,z+s*.81),(.16,s,.075),'schoolBusYellow')
    box('crate_label',(x+s*.394,y,z+s*.43),(.018,s*.51,s*.29),'asphalt',bevel=.008)
    box('crate_label_line',(x+s*.408,y,z+s*.43),(.01,s*.34,.028),'brick',bevel=.003)
crate(3.26,-.65,.30,.67)
crate(3.30,3.53,.30,.84)
def sacks(y,rows):
    x=3.34
    for yy in [y-.43,y+.43]:box('pallet_runner',(x,yy,.36),(.98,.12,.16),'woodWarm')
    for j in range(5):box('pallet_slat',(x-.40+j*.20,y,.47),(.14,1.43,.07),'woodWarm')
    for row in range(rows):
        for col in range(2):
            yy=y+(col-.5)*.66;xx=x+(.04 if row%2 else -.015);zz=.63+row*.245
            o=box('cement_sack',(xx,yy,zz),(.78,.64,.255),'picketWhite',bevel=.10);o.rotation_euler.z=(row%2-.5)*.045
            box('sack_seam',(xx,yy,zz+.133),(.60,.012,.008),'sidewalk',bevel=.002)
            box('sack_brand',(xx,yy,zz+.142),(.29,.28,.016),'brick',bevel=.025)
            box('sack_stripe',(xx+.10,yy,zz+.153),(.075,.31,.008),'schoolBusYellow',bevel=.004)
            box('sack_end',(xx+.395,yy,zz),(.012,.49,.052),'woodWarm',bevel=.007)
sacks(-4.95,5);sacks(4.78,4)
# Handcart rail behind the front crate, with two small wheels and packaged tools.
for i,yy in enumerate([3.22,3.83]):
    tube('cart_rail',[(3.12,yy,.39),(3.12,yy,1.68),(3.19,yy,1.80),(3.56,yy,1.80),(3.56,yy,1.30)],.035,'uiDark')
    wheel=empty('wheel_cart_'+('L' if i==0 else 'R'),(3.13,yy,.48),root);cart_wheels.append(wheel)
    cyl('cart_tire',(3.13,yy,.48),.16,.12,'uiDark',wheel,axis='y',n=16)
box('cart_tray',(3.36,3.53,.60),(.48,.63,.08),'uiDark')
for yy in [3.33,3.62]:
    box('cart_stock',(3.35,yy,1.20),(.33,.25,.44),'backpackTeal',bevel=.055)
    box('cart_stock_label',(3.53,yy,1.20),(.019,.13,.14),'schoolBusYellow',bevel=.015)
    cyl('cart_stock_cap',(3.35,yy,1.445),.08,.05,'picketWhite')
# Purposeful chipped paint and wear shapes, raised 6 mm from each support face.
for i in range(85):
    yy=rng.uniform(-5.05,5.05);zz=rng.uniform(3.90,4.58)
    if i%3==0:continue
    box('sign_patina',(2.973,yy,zz),(.009,rng.uniform(.025,.09),rng.uniform(.02,.055)),'woodWarm',bevel=.003)
for y,w in [(-4.77,.52),(-2.96,.14),(.10,.54),(4.45,1.12)]:
    for i in range(14):
        box('wall_chip',(2.812,y+rng.uniform(-w/2,w/2),rng.uniform(.96,2.98)),(.022,rng.uniform(.03,.11),rng.uniform(.05,.17)),'schoolBusYellow' if i%3 else 'asphalt',bevel=.008)
for i in range(18):
    x=-2.15+(i%5)*1.02+rng.uniform(-.14,.14);y=-4.25+(i//5)*2.30+rng.uniform(-.18,.18)
    # Adjacent tiles form an irregular patch, never overlapping top faces.
    for j in range(3):
        box('roof_wear',(x+j*.12,y,4.987),(.115,rng.uniform(.10,.36),.007),'woodWarm' if i%4==0 else 'brick',roof,.002)
# Rear utility detail adds finish without changing the reference silhouette.
box('rear_service_panel',(-2.862,-2.6,1.85),(.075,.64,.84),'asphalt')
for z in [1.50,2.20]:box('utility_strap',(-2.910,-2.6,z),(.024,.61,.045),'sidewalk')
tube('rear_conduit',[(-2.879,-2.14,.39),(-2.879,-2.14,2.78),(-2.879,-1.84,2.78)],.025,'uiDark')

for group in lamps: group.location.z += .28
empty('front',(3.05,0,2.5),root)

if COMMERCE:
    finish_native(Path(__file__), COMMERCE)
    sys.exit(0)

# Material batching stays inside independently controlled assemblies.
parents=[root,roof,inside,door]+lamps+cart_wheels
def merge_materials(objects, suffix=''):
    result=[]
    for parent in parents:
        for mat in M.values():
            obs=[o for o in objects if o.parent==parent and o.data.materials[0]==mat]
            if not obs: continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in obs: o.select_set(True)
            bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=obs[0]
            o.name=parent.name+suffix+'_'+mat.name
            scene.cursor.location=parent.matrix_world.translation;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
            bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
            result.append(o)
            objects=[q for q in objects if q not in obs]
    return result

def clean_meshes(objects):
    # Font outlines can tessellate into zero-area triangles.
    for o in objects:
        bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-10],context='FACES')
        bm.to_mesh(o.data);bm.free();o.data.update();o.data.calc_loop_triangles()

meshes=merge_materials([o for o in scene.objects if o.type=='MESH'])
clean_meshes(meshes)

# Center the complete footprint, keeping front +X and ground z=0.
bpy.context.view_layer.update()
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
center_shift=[0,0]
for axis in (0,1):
    shift=(max(v[axis] for v in points)+min(v[axis] for v in points))/2
    center_shift[axis]=shift
    for o in list(root.children):o.location[axis]-=shift
bpy.context.view_layer.update()
for i,group in enumerate(lamps):
    e=empty('light:lamp_'+str(i),group.matrix_world.translation,group)
    e['ss_light']=json.dumps({'type':'point','color':'light_window_warm','intensity':3,'range':4,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[o.name for o in meshes if o.parent==group and o.data.materials[0]==M['glow']],'tiers':'all'})
e=empty('light:shopfront',(2.30,0,1.9),root)
e['ss_light']=json.dumps({'type':'window','color':'light_window_warm','intensity':3,'range':4,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[o.name for o in meshes if o.parent in [inside,door] and o.data.materials[0]==M['glow']],'tiers':'all'})
col=empty('col:building',(-.66,0,2.55),root);col['collider']='cuboid';col['size']=[5.6,10.7,4.5]
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=731
if a.glb:
    # Bake genuine local occlusion to the runtime ao color attribute.
    scene.render.bake.target='VERTEX_COLORS';scene.render.bake.use_clear=True
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        for layer in list(o.data.uv_layers): o.data.uv_layers.remove(layer)
        for layer in list(o.data.color_attributes): o.data.color_attributes.remove(layer)
        att=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');o.data.color_attributes.active_color=att;o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.bake(type='AO')
    # Stylized occlusion stays soft: enclosed corner vertices must not turn
    # an otherwise exposed broad panel black through interpolation.
    for o in meshes:
        for color in o.data.color_attributes['ao'].data:
            value=max(.65,color.color[0]);color.color=(value,value,value,1)
tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'id':'bld.maple-hardware','tier':'Hero','triangles':tri,'draw_calls':len(meshes),'materials':sorted({o.data.materials[0].name for o in meshes}),'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','roof','interior','door_front','front']),'within_budget':tri<=100000 and len(meshes)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
if a.glb:
    (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    root['lods']=json.dumps({'LOD0':'model.glb','LOD1':'model.lod1.glb','LOD2':'model.lod2.glb'})
    bpy.ops.object.select_all(action='SELECT')
    def export(path):
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_vertex_color='NAME',export_vertex_color_name='ao',export_all_vertex_colors=False)
        subprocess.run(['node',str(HERE/'optimize.mjs'),str(path)],check=True)
    path=Path(a.glb).resolve();export(path)
    high={o:o.data for o in meshes}
    # LOD1 retains all parts; LOD2 is a deliberately authored coarse shell.
    for o,data in high.items():
        o.data=data.copy();bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('LOD1 simplification','DECIMATE');mod.ratio=.12
        bpy.ops.object.modifier_apply(modifier=mod.name)
    export(path.with_name(path.stem+'.lod1'+path.suffix))
    for o,data in high.items():
        low=o.data;o.data=data;bpy.data.meshes.remove(low)

    DISTANT=True
    before=set(scene.objects)
    def point(x,y,z): return (x-center_shift[0],y-center_shift[1],z)
    def far_box(name,loc,size,mat,parent=root,bevel=0):
        return box('far_'+name,point(*loc),size,mat,parent,bevel)
    far_box('foundation',(.55,0,.135),(7.35,11.4,.27),'picketWhite',bevel=.03)
    far_box('rear',(-2.68,0,2.64),(.24,10.5,4.72),'woodWarm')
    for y in [-5.16,5.16]:
        far_box('side',(0,y,2.64),(5.12,.24,4.72),'woodWarm')
        far_box('plinth',(0,y,.57),(5.3,.31,.52),'uiDark')
    far_box('header',(2.66,0,4.00),(.28,10.55,1.70),'woodWarm')
    far_box('sill',(2.66,.5,.65),(.28,9.5,.72),'woodWarm')
    for y,w in [(-4.76,.72),(-2.96,.25),(.10,.85),(4.40,1.60)]:
        far_box('pier',(2.66,y,1.99),(.28,w,2.42),'woodWarm')
    for x in [-2.68,2.68]:
        for y in [-5.23,5.23]:
            for z in [1.44,3.71]: far_box('quoin',(x,y,z),(.42,.42,2.23),'schoolBusYellow')
    far_box('roof',(0,0,4.86),(5.34,10.5,.22),'asphalt',roof)
    for x in [-2.7,2.7]: far_box('coping',(x,0,5.14),(.38,10.1,.35),'picketWhite',roof,.03)
    for y in [-5.24,5.24]: far_box('coping',(0,y,5.14),(5.72,.38,.35),'picketWhite',roof,.03)
    far_box('gold_sign',(2.937,0,4.19),(.055,10.43,1.02),'schoolBusYellow')
    text('MAPLE HARDWARE',point(2.987,0,4.21),8.82,.77,'uiDark')
    far_box('trade_fascia',(2.92,0,3.37),(.19,10.73,.61),'uiDark')
    text('TOOLS · PAINT · PLUMBING · MORE',point(3.033,0,3.39),8.48,.35,'picketWhite')
    far_box('mural',(0,5.365,2.62),(3.83,.085,2.89),'uiDark')
    text('SUNSET GROVE',point(0,5.425,2.62),3.24,.50,'schoolBusYellow',side=True)
    far_box('tool_badge',(2.875,4.42,2.34),(.08,1.24,1.38),'uiDark')
    for sign in [-1,1]:
        ob=far_box('tool',(2.936,4.42,2.35),(.035,.12,1.1),'picketWhite');ob.rotation_euler.x=sign*.61
    for y,width in [(-1.57,2.43),(2.04,3.00)]:
        far_box('window',(2.34,y,1.98),(.05,width,1.86),'glow',inside)
        for yy in [y-width/2,y+width/2,y-width/6,y+width/6]:
            far_box('mullion',(2.94,yy,1.97),(.12,.075,1.93),'uiDark')
        for z in [1.05,1.96,2.90]: far_box('rail',(2.94,y,z),(.15,width+.10,.09),'uiDark')
        for z in [1.45,2.37]:
            for j in range(4):
                far_box('stock',(2.65,y-width*.36+j*width*.24,z),(.30,.32,.35),'schoolBusYellow',inside)
    far_box('door',(2.86,-3.63,1.65),(.10,1.04,2.68),'uiDark',door)
    far_box('door_window',(2.932,-3.63,2.17),(.015,.76,1.25),'glow',door)
    for x,y,w,d,h in [(1.45,2.20,1.90,1.18,1.04),(-1.82,2.55,1.91,1.24,1.71),(-1.24,-2.72,.86,.73,.48)]:
        far_box('unit',(x,y,5.15+h/2),(d,w,h),'picketWhite',roof,.035)
        far_box('unit_lid',(x,y,5.17+h),(d+.08,w+.08,.10),'uiDark',roof)
        for yy in [y-w*.25,y+w*.25]: far_box('grille',(x,yy,5.23+h),(d*.71,w*.4,.025),'uiDark',roof)
    for yy in [1.72,2.68]: cyl('far_fan',point(2.055,yy,5.55),.24,.027,'uiDark',roof,axis='x',n=8)
    for group,y in zip(lamps,[-4.1,0,4.1]):
        tube('far_arm',[point(2.91,y,5.22),point(3.20,y,5.32),point(3.43,y,5.19)],.045,'uiDark',group)
        bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.23,radius2=.085,depth=.20,location=point(3.43,y,5.17))
        finish(bpy.context.object,'far_shade','uiDark',group)
        cyl('far_lens',point(3.43,y,5.044),.19,.025,'glow',group,n=8)
    for y,h in [(-4.95,1.40),(4.78,1.16)]:
        far_box('sacks',(3.34,y,.31+h/2),(.90,1.38,h),'picketWhite',bevel=.06)
        far_box('sack_mark',(3.34,y,.32+h),(.30,.38,.024),'schoolBusYellow')
    for y,size in [(-.65,.67),(3.53,.84)]:
        far_box('crate',(3.30,y,.30+size*.4),(size,size,size*.8),'woodWarm')
    for group,yy in zip(cart_wheels,[3.22,3.83]): cyl('far_wheel',point(3.13,yy,.48),.16,.12,'uiDark',group,axis='y',n=8)
    far_box('cart_stock',(3.35,3.53,1.23),(.33,.58,.5),'schoolBusYellow')
    far=merge_materials([o for o in scene.objects if o not in before and o.type=='MESH'],'_lod2')
    clean_meshes(far)
    for o in far:
        for layer in list(o.data.uv_layers): o.data.uv_layers.remove(layer)
        for layer in list(o.data.color_attributes): o.data.color_attributes.remove(layer)
        color=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
        o.data.color_attributes.active_color=color
        # Coarse parts reuse the mean occlusion of their matching baked material.
        matching=[q for q in meshes if q.parent==o.parent and q.data.materials[0]==o.data.materials[0]]
        values=[c.color[0] for q in matching for c in q.data.color_attributes['ao'].data]
        value=sum(values)/len(values) if values else .9
        for c in color.data: c.color=(value,value,value,1)
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type=='EMPTY' or o in far: o.select_set(True)
    export(path.with_name(path.stem+'.lod2'+path.suffix))
    far_tri=sum(len(o.data.loop_triangles) for o in far)
    print('LOD2 OK',far_tri,'triangles',len(far),'draw calls')
    for o in far: bpy.data.objects.remove(o,do_unlink=True)
    DISTANT=False
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.17,.24,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.032));o=bpy.context.object
    m=bpy.data.materials.new('studio_ground');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.039,.032,.045,1);o.data.materials.append(m)
    for loc,power,size,color in [((6,-6,13),2400,8,(1,.75,.50)),((-4,2,11),2100,7,(.66,.70,1)),((1,7,10),1700,6,(1,.51,.31))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,2.5))-o.location).to_track_quat('-Z','Y').to_euler()
    for group in lamps:
        loc=group.matrix_world.translation+Vector((.54,0,-.40))
        bpy.ops.object.light_add(type='POINT',location=loc);o=bpy.context.object;o.data.energy=110;o.data.color=(1,.52,.14);o.data.shadow_soft_size=.20
    for y in [-1.57,2.04]:
        bpy.ops.object.light_add(type='POINT',location=(2.39,y,2.13));o=bpy.context.object;o.data.energy=85;o.data.color=(1,.48,.10);o.data.shadow_soft_size=.45
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;target=Vector((0,0,2.70))
    views={'ref':(15,19,14),'game':(16,16,22),'front':(20,0,7),'side':(0,22,9),'rear':(-16,-18,13)}
    cam.location=views[a.view];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=21.6 if a.view=='game' else 19.3
    scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.cycles.device='CPU'
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.data.ortho_scale=21.6;cam.location=views['game'];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.cycles.samples=24
        scene.render.resolution_x=960;scene.render.resolution_y=540
        dest=Path(a.render).resolve();scene.render.filepath=str(dest.with_name('game.png' if dest.stem=='hero' else dest.stem+'-game.png'));bpy.ops.render.render(write_still=True)
    print('RENDER OK')
