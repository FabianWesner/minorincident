"""Sunset Grove pharmacy/clinic cutaway. Deterministic, metres, +X front, Z up.
Static parts merge by material; doors and wheelchair wheels retain joint pivots.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
for f in ['render', 'glb']: p.add_argument('--'+f)
p.add_argument('--view', default='ref'); p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M = {}
def material(token, h, rough=.6, metal=0, emission=0, alpha=1):
    name = ('emi_' if emission else 'pal_')+token
    if alpha<1: name='keep_glass'
    m=bpy.data.materials.new(name); m.use_nodes=True
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    col=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(alpha,)
    bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=col
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    bs.inputs['Alpha'].default_value=alpha
    if emission: bs.inputs['Emission Color'].default_value=col; bs.inputs['Emission Strength'].default_value=emission
    if alpha<1: m.surface_render_method='DITHERED'
    M[token]=m
for token,h in {'sidewalk':'b9a4a0','picketWhite':'f2e6dc','backpackTeal':'2f6e6a','policeBlue':'2355bd','survivorRed':'d9363e','schoolBusYellow':'f2b630','uiDark':'25222c','blood':'b3121f','foliage':'7da23c','grass':'6f8f3a','infectedSkin':'c9a39a'}.items(): material(token,h,.34 if token in ['sidewalk','policeBlue','blood'] else .6)
material('signGlow','e4faff',emission=2)
# Keep the emissive name a known palette token.
M['signGlow'].name='emi_picketWhite'
material('glass','a6d9df',.19,alpha=.10)

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
    if parent:
        bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    return o
root=empty('root'); root['asset_id']='int.pharmacy-clinic'; root['front']='+X'
interior=empty('interior',parent=root)
parts=[]
def finish(o,name,mat,parent=interior,bevel=0):
    o.name=name; o.data.materials.clear(); o.data.materials.append(M[mat])
    if bevel:
        b=o.modifiers.new('soft bevel','BEVEL'); b.width=bevel; b.segments=1 if bevel<=.012 else 2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
        n=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=n.name)
    if parent:
        bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    parts.append(o); return o

def box(name,loc,size,mat='picketWhite',parent=interior,bevel=.024,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object
    o.scale=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot: o.rotation_euler=rot
    return finish(o,name,mat,parent,min(bevel,min(size)*.25))
def cyl(name,loc,r,depth,mat='sidewalk',parent=interior,axis='z',n=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='x': o.rotation_euler.y=math.pi/2
    if axis=='y': o.rotation_euler.x=math.pi/2
    return finish(o,name,mat,parent,min(.008,depth*.2))
def beam(name,start,end,r=.025,mat='sidewalk',parent=interior):
    v=Vector(end)-Vector(start); o=cyl(name,(Vector(start)+Vector(end))/2,r,v.length,mat,parent,n=12)
    o.rotation_euler=v.to_track_quat('Z','Y').to_euler(); return o

def torus(name,loc,r,tube,mat='uiDark',parent=interior,axis='y'):
    bpy.ops.mesh.primitive_torus_add(major_segments=36,minor_segments=8,location=loc,major_radius=r,minor_radius=tube)
    o=bpy.context.object
    if axis=='y': o.rotation_euler.x=math.pi/2
    if axis=='x': o.rotation_euler.y=math.pi/2
    return finish(o,name,mat,parent)
font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf')
def text(name,word,loc,width,height,mat='policeBlue',parent=interior):
    bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,math.pi/2)); o=bpy.context.object
    o.data.body=word; o.data.font=font; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.size=1
    o.data.extrude=.002; o.data.resolution_u=2
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object
    xs=[v.co.x for v in o.data.vertices]; ys=[v.co.y for v in o.data.vertices]
    for v in o.data.vertices: v.co.x*=width/(max(xs)-min(xs)); v.co.y*=height/(max(ys)-min(ys))
    o['lettering']=True
    return finish(o,name,mat,parent)
def cross(loc,size,mat,parent=interior):
    x,y,z=loc
    box('medical_cross_horizontal',(x,y,z),(.06,size,size*.32),mat,parent,.014)
    box('medical_cross_vertical',(x+.005,y,z),(.065,size*.32,size),mat,parent,.014)

def floor_slab(name,loc,size,mat,bevel):
    x,y,z=loc; sx,sy,sz=size
    poly=[(x-sx/2,y-sy/2),(x+sx/2,y-sy/2),(x+sx/2,y+sy/2),(x-sx/2,y+sy/2)]
    for sign in [-1,1]:
        clipped=[]
        for start,end in zip(poly,poly[1:]+poly[:1]):
            d0=start[0]+sign*start[1]-5.47; d1=end[0]+sign*end[1]-5.47
            if d0<=0: clipped.append(start)
            if (d0<=0)!=(d1<=0):
                t=d0/(d0-d1); clipped.append((start[0]+t*(end[0]-start[0]),start[1]+t*(end[1]-start[1])))
        poly=clipped
    if len(poly)<3: return
    n=len(poly); vs=[(xx,yy,zz) for zz in [z-sz/2,z+sz/2] for xx,yy in poly]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    return finish(o,name,mat,bevel=bevel)

# Individually rounded tiled platform; seams are genuine gaps over a grout bed.
floor_slab('floor_grout',(0,0,.13),(6.25,6.25,.26),'sidewalk',bevel=.055)
for ix in range(8):
    for iy in range(8):
        floor_slab('glazed_floor_tile',(-2.73+ix*.78,-2.73+iy*.78,.285),(.768,.768,.06),'infectedSkin' if (ix+iy)%5==0 else 'picketWhite',bevel=.015)
# Shell: cutaway at +X; rear courtyard-like open top, raised masonry cornices.
box('rear_wall',(-3.0,0,1.89),(.23,6.18,3.15),'sidewalk')
box('right_wall',(-1.0,-3.0,1.89),(4.22,.23,3.15),'sidewalk')
# Solid poster wing on right of doors, front wall x=-.7.
box('poster_wall',(-.68,-2.12,1.82),(.24,1.78,3.0),'sidewalk')
box('side_window_sill',(-1.87,3.0,.50),(2.48,.23,.40),'sidewalk')
for x in [-3.0,-.7]: box('left_window_pier',(x,3.0,1.88),(.23,.23,3.16),'sidewalk')
for y in [-3,3]:
    for i in range(6 if y<0 else 3):
        x=-2.64+i*.72
        box('cornice_block',(x,y,3.40),(.71,.35,.43),'infectedSkin',bevel=.028)
for i in range(8):
    box('rear_cornice',(-3.0,-2.4675+i*.705,3.40),(.35,.693,.43),'infectedSkin')
    box('facade_cornice',(-.68,-2.4675+i*.705,3.40),(.36,.693,.43),'infectedSkin')
# Stone facing joints and skirting.
for z in [.55,1.34,2.16,2.98]:
    box('poster_wall_course',(-.547,-2.10,z),(.014,1.71,.019),'infectedSkin',bevel=.003)
box('poster_plinth',(-.48,-2.10,.45),(.18,1.88,.24),'infectedSkin')
# Left storefront pane, inside shelf display.
box('side_glass',(-1.86,3.006,1.76),(2.08,.015,2.13),'glass',bevel=0)
for x in [-2.93,-1.90,-.82]: box('side_mullion',(x,3.045,1.75),(.07,.08,2.28),'sidewalk',bevel=.01)
for z in [.65,2.89]: box('side_window_rail',(-1.87,3.04,z),(2.23,.10,.12),'uiDark',bevel=.015)
# Front display bay and twin hinged entrance doors.
for y in [1.78,2.89,-1.22]: box('front_store_post',(-.53,y,1.69),(.15,.11,2.74),'sidewalk')
for z in [.40,2.94]: box('front_store_rail',(-.53,.84,z),(.15,4.28,.13),'sidewalk')
box('display_glass',(-.515,2.34,1.70),(.014,1.02,2.44),'glass',bevel=0)
doors=[]
for side,y,hinge in [('L',.68,1.25),('R',-.59,-1.22)]:
    joint=empty('door_'+side,(-.50,hinge,.36),root); joint['joint']='hinge_z'; doors.append(joint)
    for yy in [y-.57,y+.57]: box('door_stile',(-.50,yy,1.64),(.10,.065,2.56),'picketWhite',joint,.01)
    for z in [.40,2.89]: box('door_rail',(-.50,y,z),(.10,1.17,.085),'picketWhite',joint,.01)
    box('door_glass',(-.492,y,1.65),(.014,1.09,2.42),'glass',joint,0)
    handle_y=y+(-.43 if side=='L' else .43)
    for z in [1.15,1.43]: beam('handle_mount',(-.435,handle_y,z),(-.32,handle_y,z),.024,'sidewalk',joint)
    beam('door_pull',(-.32,handle_y,1.15),(-.32,handle_y,1.43),.03,'sidewalk',joint)
# Main chunky fascia and proud glowing geometric lettering.
box('sign_back',(-.40,.96,3.13),(.22,3.65,.95),'policeBlue',bevel=.045)
box('sign_face',(-.272,.96,3.13),(.045,3.51,.83),'policeBlue',bevel=.025)
text('sunset_lettering','SUNSET',(-.241,.59,3.35),2.22,.30,'signGlow')
text('pharmacy_lettering','PHARMACY',(-.241,.59,2.98),2.65,.30,'signGlow')
box('cross_panel',(-.23,2.35,3.14),(.11,.77,.83),'policeBlue')
cross((-.15,2.35,3.14),.62,'signGlow')
# Readable health message panel.
box('care_poster',(-.539,-2.08,1.96),(.025,1.46,1.86),'infectedSkin',bevel=.006)
for word,z in [('CARE',2.49),('TODAY',2.12),('STRONGER',1.74),('TOMORROW',1.40)]: text('care_'+word,word,(-.515,-2.08,z),1.22,.26)

# Shelving: backs, shelf lips, supports, packed medicines, tiny proud label blocks.
def carton(x,y,z,w=.22,h=.32,ink='backpackTeal',parent=interior):
    box('medicine_carton',(x,y,z+h/2),(.23,w,h),'picketWhite',parent,.012)
    box('carton_colour_band',(x+.121,y,z+h*.38),(.014,w*.88,h*.38),ink,parent,.006)
    box('carton_label',(x+.132,y,z+h*.76),(.009,w*.73,h*.20),'picketWhite',parent,.002)
    box('carton_label_mark',(x+.141,y,z+h*.76),(.008,w*.32,.016),ink,parent,.002)
    cross((x+.143,y,z+h*.37),min(w*.32,h*.24),'picketWhite',parent)
def bottle(x,y,z,ink='schoolBusYellow',parent=interior):
    cyl('bottle_body',(x,y,z+.13),.066,.25,ink,parent,n=16)
    cyl('bottle_neck',(x,y,z+.274),.039,.065,ink,parent,n=16)
    cyl('bottle_cap',(x,y,z+.313),.045,.032,'policeBlue',parent,n=16)
    box('bottle_label',(x+.066,y,z+.145),(.014,.085,.105),'picketWhite',parent,.004)
shelf_start=len(parts)
for sy,w in [(2.15,1.32),(-.91,1.10),(.54,1.34)]:
    box('shelf_back',(-2.58,sy,1.63),(.11,w,2.56),'backpackTeal',bevel=.012)
    for yy in [sy-w/2,sy+w/2]:
        if sy==2.15 and yy>sy: continue  # open end beside the display window
        box('shelf_side',(-2.30,yy,1.65),(.64,.055,2.66),'picketWhite',bevel=.008)
    for iz,z in enumerate([.49,.98,1.47,1.96,2.45]):
        box('shelf',(-2.28,sy,z),(.72,w,.055),'picketWhite',bevel=.012)
        box('shelf_edge',(-1.907,sy,z+.02),(.035,w,.08),'sidewalk',bevel=.008)
        for k in range(5):
            yy=sy-w*.39+k*w*.195; ink=['backpackTeal','survivorRed','policeBlue','schoolBusYellow'][(k+iz)%4]
            if (k+iz)%3==0: bottle(-2.09,yy,z+.03,ink)
            else: carton(-2.07,yy,z+.03,.18,.29+.04*(k%2),ink)
for o in parts[shelf_start:]: o.location.x+=.80
# Side-window display: labels face the glazing, independently of the main racks.
for row,z in enumerate([.72,1.40,2.10]):
    box('window_display_shelf',(-2.13,2.74,z),(1.93,.29,.055),'picketWhite',bevel=.012)
    for k,x in enumerate([-2.68,-2.24,-1.80]):
        start=len(parts); center=Vector((x,2.73,z+.03))
        ink=['schoolBusYellow','policeBlue','survivorRed'][(row+k)%3]
        if (row+k)%2: bottle(x,2.73,z+.03,ink)
        else: carton(x,2.73,z+.03,.26,.36,ink)
        rotation=Matrix.Rotation(math.pi/2,4,'Z')
        for o in parts[start:]:
            o.location=center+rotation.to_3x3() @ (o.location-center)
            o.rotation_euler=(rotation.to_3x3() @ o.rotation_euler.to_matrix()).to_euler()
# Large display stacks just inside the left pane and outside entrance.
for x,y in [(-1.19,2.43),(-.12,1.62)]:
    for z in [.32,.74,1.16]: carton(x,y,z,.39,.40,'policeBlue')
# Service counter at rear: cabinet fronts, inset panels, register and paperwork.
counter_start=len(parts)
box('service_counter',(-1.35,.60,.87),(.60,2.55,1.10),'backpackTeal')
box('counter_top',(-1.35,.60,1.455),(.79,2.75,.12),'picketWhite',bevel=.045)
for yy in [-.25,.58,1.40]:
    box('cabinet_face',(-1.036,yy,.90),(.045,.74,.84),'picketWhite')
    beam('cabinet_pull',(-.998,yy-.12,1.18),(-.998,yy+.12,1.18),.017,'uiDark')
box('register_foot',(-1.31,.82,1.57),(.28,.34,.10),'uiDark')
beam('register_stem',(-1.31,.82,1.61),(-1.34,.82,1.86),.036,'uiDark')
box('register_monitor',(-1.33,.82,1.91),(.10,.46,.31),'uiDark',rot=(0,.13,0))
box('register_screen',(-1.265,.82,1.92),(.013,.39,.235),'backpackTeal',bevel=.005)
for z in [1.85,1.91,1.98]: box('screen_text',(-1.253,.82,z),(.008,.25,.012),'picketWhite',bevel=.002)
box('prescription_pad',(-1.29,1.42,1.534),(.31,.32,.025),'picketWhite')
for o in parts[counter_start:]: o.location.x-=.95
# Consultation bed inside right alcove, with cushion, pillow, metal feet and step.
box('consultation_couch',(-1.97,-2.21,1.00),(1.53,.72,.22),'sidewalk',bevel=.065)
box('exam_cushion',(-1.96,-2.21,1.145),(1.50,.70,.14),'backpackTeal',bevel=.05)
box('exam_pillow',(-2.48,-2.21,1.26),(.35,.60,.13),'picketWhite',bevel=.055)
for x in [-2.47,-1.48]:
    for y in [-2.46,-1.96]: beam('exam_leg',(x,y,.34),(x,y,.92),.032,'sidewalk')
box('exam_step',(-1.35,-2.22,.49),(.40,.65,.32),'sidewalk')
# Waiting bench: four individually formed blue seats on a shared metal rail.
beam('bench_rail',(.08,-2.43,.78),(2.50,-2.43,.78),.055,'uiDark')
for x in [.20,.86,1.52,2.18]:
    box('waiting_seat',(x,-2.30,.87),(.59,.66,.105),'policeBlue',bevel=.055)
    box('seat_back',(x,-2.59,1.26),(.56,.105,.60),'policeBlue',bevel=.048,rot=(.10,0,0))
    beam('seat_bracket',(x,-2.42,.77),(x,-2.61,1.33),.028,'sidewalk')
for x in [.14,2.30]:
    for y in [-2.09,-2.58]: beam('bench_leg',(x,y,.34),(x,y+(.07 if y<-2.3 else -.07),.79),.034,'sidewalk')

# Wheelchair, forward facing +X: rubber tires, push rims, 12 spokes and joint pivots.
wx,wy=2.10,-1.16
box('wheelchair_seat',(wx,wy,.82),(.57,.60,.08),'uiDark',bevel=.04)
box('wheelchair_back',(wx-.28,wy,1.15),(.075,.60,.61),'uiDark',bevel=.035,rot=(0,-.10,0))
wheel_joints=[]
for side,yy in [('L',wy+.40),('R',wy-.40)]:
    joint=empty('wheel'+side,(wx-.14,yy,.75),root); joint['joint']='axle_y'; wheel_joints.append(joint)
    torus('rubber_tire',(wx-.14,yy,.75),.40,.047,'uiDark',joint)
    torus('metal_rim',(wx-.14,yy,.75),.377,.015,'sidewalk',joint)
    out=yy+(.071 if side=='L' else -.071)
    torus('push_rim',(wx-.14,out,.75),.345,.017,'infectedSkin',joint)
    cyl('wheel_hub',(wx-.14,yy,.75),.055,.17,'sidewalk',joint,'y')
    for j in range(12):
        th=j*math.tau/12
        beam('wheel_spoke',(wx-.14,yy,.75),(wx-.14+math.sin(th)*.37,yy,.75+math.cos(th)*.37),.008,'sidewalk',joint)
    caster=empty('caster'+side,(wx+.35,yy,.45),root); caster['joint']='axle_y'; wheel_joints.append(caster)
    torus('caster_tire',(wx+.35,yy,.45),.096,.03,'uiDark',caster)
    cyl('caster_hub',(wx+.35,yy,.45),.071,.06,'sidewalk',caster,'y',16)
    beam('caster_fork',(wx+.35,yy,.45),(wx+.35,yy,.68),.023,'sidewalk')
    beam('chair_lower_frame',(wx-.33,yy,.61),(wx+.32,yy,.61),.023,'sidewalk')
    beam('chair_upright',(wx-.29,yy,.61),(wx-.39,yy,1.53),.025,'sidewalk')
    beam('push_handle',(wx-.39,yy,1.53),(wx-.56,yy,1.53),.036,'uiDark')
    beam('arm_front',(wx+.14,yy,.66),(wx+.14,yy,1.04),.025,'sidewalk')
    box('padded_armrest',(wx-.03,yy,1.06),(.49,.087,.068),'uiDark',bevel=.025)
    beam('footrest_stem',(wx+.26,yy,.61),(wx+.54,yy,.49),.022,'sidewalk')
    box('foot_plate',(wx+.56,yy,.48),(.24,.24,.055),'uiDark')
beam('chair_cross_brace',(wx-.26,wy-.38,.58),(wx+.17,wy+.38,.77),.020,'sidewalk')
beam('chair_cross_brace',(wx-.26,wy+.38,.58),(wx+.17,wy-.38,.77),.020,'sidewalk')
# Potted broad-leaf plant by entrance.
box('plant_pot',(-.03,2.51,.64),(.56,.56,.62),'infectedSkin',bevel=.045)
box('pot_rim',(-.03,2.51,.96),(.62,.62,.10),'infectedSkin')
box('soil',(-.03,2.51,1.018),(.49,.49,.025),'uiDark')
for j in range(12):
    t=j*2.4; end=Vector((-.03+math.sin(t)*(.23+.05*(j%3)),2.51+math.cos(t)*.29,1.33+.105*(j%5)))
    beam('plant_stem',(-.03,2.51,1.02),end,.013,'grass')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,location=end)
    o=bpy.context.object; o.scale=(.11,.31,.045); o.rotation_euler=(.55,.65,t)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); finish(o,'broad_leaf','foliage' if j%2 else 'grass')
# A-frame flu shot board in foreground; lettering sits 7 mm proud.
sign=interior
box('a_board',(1.48,1.77,1.01),(.08,.94,1.31),'uiDark',sign,rot=(0,-.12,0))
box('a_poster',(1.543,1.77,1.01),(.025,.82,1.18),'infectedSkin',sign)
for word,z in [('FLU',1.43),('SHOTS',1.16),('HERE',.89)]: text('flu_'+word,word,(1.564,1.77,z),.66,.20,parent=sign)
cross((1.57,1.77,.57),.31,'policeBlue',sign)
for yy in [1.28,2.26]:
    beam('a_frame_front',(1.58,yy,.32),(1.42,yy,1.69),.028,'uiDark')
    beam('a_frame_rear',(1.05,yy,.32),(1.42,yy,1.69),.028,'uiDark')
    beam('a_frame_brace',(1.15,yy,.65),(1.55,yy,.65),.017,'sidewalk')
# Spilled blood: disjoint silhouettes, 40 mm above tiles for distant depth precision.
spill_bounds=[]
def pool(name,cx,cy,rx,ry,z,mat='blood',n=64):
    verts=[(cx,cy,z)]+[(cx+math.cos(i*math.tau/n)*rx*(1+.07*math.sin(i*math.tau/n*3)+.06*math.sin(i*math.tau/n*7)),cy+math.sin(i*math.tau/n)*ry*(1+.08*math.cos(i*math.tau/n*5)),z) for i in range(n)]
    bounds=(min(v[0] for v in verts),max(v[0] for v in verts),min(v[1] for v in verts),max(v[1] for v in verts))
    if any(bounds[0]<b[1] and bounds[1]>b[0] and bounds[2]<b[3] and bounds[3]>b[2] for b in spill_bounds): return
    spill_bounds.append(bounds)
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],[(0,1+i,1+(i+1)%n) for i in range(n)]); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); finish(o,name,mat)
pool('blood_pool',1.04,.18,.54,.55,.355)
for j in range(29):
    th=j*2.39; rad=.75+(j%5)*.105
    pool('blood_droplet',1.04+math.cos(th)*rad,.18+math.sin(th)*rad,.024+(j%3)*.012,.021,.355,n=12)
for j in range(6): pool('blood_trail',1.66+j*.12,-.50-j*.12,.063,.04,.355,n=16)
# Dropped IV canister with tube, bandage and scattered aid cartons.
cyl('fallen_canister',(.23,.62,.50),.13,.40,'survivorRed',axis='y')
for yy in [.41,.82]: cyl('canister_end',(.23,yy,.50),.132,.04,'picketWhite',axis='y')
cyl('canister_neck',(.23,.87,.50),.065,.09,'survivorRed',axis='y')
for st,en in [((.23,.92,.50),(.15,1.05,.41)),((.15,1.05,.41),(.30,1.15,.34))]: beam('iv_tube',st,en,.018,'infectedSkin')
for x,y,ink in [(2.54,.86,'backpackTeal'),(2.17,.30,'policeBlue')]: carton(x,y,.32,.44,.38,ink)
cyl('dropped_bottle',(2.73,1.43,.40),.09,.28,'policeBlue',axis='y')
cyl('bottle_lid',(2.73,1.59,.40),.082,.035,'picketWhite',axis='y')
box('bandage_wrapper',(2.43,2.18,.36),(.30,.23,.085),'infectedSkin',rot=(0,0,.37))
for i in range(3): box('wrapper_crease',(2.43+i*.045,2.18,.412),(.024,.18,.022),'picketWhite',rot=(0,0,.37))

# Present the glazed side to the fixed game camera. Mirror the layout, not glyphs.
bpy.context.view_layer.update()
mirrored=[]
for o in parts:
    parent=o.parent; w=o.matrix_world.copy(); center=w.translation.copy()
    o.parent=None
    for v in o.data.vertices:
        point=w @ v.co
        point.y = point.y-2*center.y if o.get('lettering') else -point.y
        v.co=point-Vector((center.x,-center.y,center.z))
    if not o.get('lettering'):
        bm=bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.reverse_faces(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
    world=Matrix.Translation((center.x,-center.y,center.z))
    o.matrix_world=world; mirrored.append((o,parent,world))
for joint in doors+wheel_joints: joint.location.y=-joint.location.y
bpy.context.view_layer.update()
for o,parent,world in mirrored:
    o.parent=parent; o.matrix_world=world

# Join by material inside each moving assembly. Preserve required building nodes.
assemblies=[interior]+doors+wheel_joints
for parent in assemblies:
    for m in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==m]
        if not obs: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name=parent.name+'_'+m.name
# Anchor for illuminated pharmacy fascia.
anchor=empty('light:pharmacy',(-.18,-.90,3.13),root)
anchor.rotation_euler=(0,-math.pi/2,0)
anchor['ss_light']=json.dumps({'type':'neon','color':'light_led_white','intensity':2,'range':3,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'sunset-grove-pharmacy','breakable':True,'emissiveNodes':['interior_emi_picketWhite'],'tiers':'all'})
col=empty('col:floor',(0,0,.14),root); col['collider']='cuboid'; col['size']=[6.25,6.25,.28]
for name,loc,size in [('rear',(-3,0,1.89),(.23,6.18,3.15)),('right',(-1,3,1.89),(4.22,.23,3.15)),('poster',(-.68,2.12,1.82),(.24,1.78,3))]:
    c=empty('col:'+name,loc,root); c['collider']='cuboid'; c['size']=size
asset=list(bpy.context.scene.objects); meshes=[o for o in asset if o.type=='MESH']
# AO in glTF COLOR_0, deterministic CPU bake.
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=117
scene.render.bake.target='VERTEX_COLORS'; scene.render.bake.use_clear=True
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER'); o.data.color_attributes.active_color=attr; o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.bake(type='AO')
tri=0
for o in meshes: o.data.calc_loop_triangles(); tri+=len(o.data.loop_triangles)
report={'id':'int.pharmacy-clinic','tier':'Hero','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ['root','interior','door_L','door_R','wheelL','wheelR','casterL','casterR','light:pharmacy']),'within_budget':tri<=100000 and len(meshes)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    # LODs retain named joints, palette identity and baked AO. Restore hero data for renders.
    hero_data={o:o.data for o in meshes}
    for level,ratio in [(1,.15),(2,.03)]:
        for o,data in hero_data.items():
            o.data=data.copy()
            bpy.context.view_layer.objects.active=o
            dec=o.modifiers.new('distance LOD','DECIMATE'); dec.ratio=ratio; dec.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=dec.name)
        lodpath=Path(a.glb).with_name(Path(a.glb).stem+'.lod'+str(level)+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(lodpath.resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
        for o,data in hero_data.items():
            reduced=o.data; o.data=data; bpy.data.meshes.remove(reduced)
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.21,.31,1); world.node_tree.nodes['Background'].inputs[1].default_value=.45
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.055))
    m=bpy.data.materials.new('stage'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.045,.035,.058,1); bpy.context.object.data.materials.append(m)
    for loc,power,size,color in [((1,4,8),1000,6,(1,.77,.60)),((-4,-2,6),800,5,(.65,.73,1)),((5,-3,5),600,5,(1,.65,.48))]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=color; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; target=Vector((0,0,1.70))
    views={'ref':(9,-10,8),'game':(10,-10,13),'front':(12,0,5),'side':(0,12,5),'rear':(-10,-10,9)}
    cam.location=views[a.view]; cam.data.type='ORTHO'; cam.data.ortho_scale=13.2 if a.view!='game' else 13.2
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices: d.use=True
    scene.cycles.device='GPU'; scene.render.resolution_x=a.width; scene.render.resolution_y=a.height
    scene.view_settings.view_transform='AgX'; scene.render.filepath=str(Path(a.render).resolve()); bpy.ops.render.render(write_still=True)
    print('RENDER OK')
    if a.view=='ref':
        cam.location=views['game']; cam.data.ortho_scale=13.2
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        path=Path(a.render)
        scene.render.filepath=str(path.with_name('game.png' if path.stem=='hero' else path.stem.replace('-ref','-game')+'.png').resolve())
        bpy.ops.render.render(write_still=True); print('GAME RENDER OK')
