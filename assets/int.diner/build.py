"""Joe's Diner: deterministic geometry-only Hero cutaway, metres, +X front, Z up.
Static geometry joins by palette material; door and hanging lamps retain pivots.
All applied graphics are at least 0.004m clear of supporting faces.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for f in ['render','glb']: p.add_argument('--'+f)
p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
for t,h in {'uiDark':'25222c','picketWhite':'f2e6dc','sidewalk':'b9b4c1','survivorRed':'c71f2d','blood':'891e29','woodWarm':'b0703f','schoolBusYellow':'f2b630','windowGlow':'ffc773','backpackTeal':'2f6e6a','foliage':'7da23c','grass':'6f8f3a','asphalt':'5b4f5c'}.items():
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    m=bpy.data.materials.new('pal_'+t); m.use_nodes=True; bs=m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    bs.inputs['Roughness'].default_value=.28 if t in ['survivorRed','picketWhite','sidewalk'] else .6
    if t=='sidewalk':
        bs.inputs['Metallic'].default_value=.8; bs.inputs['Roughness'].default_value=.22
    if t in ['survivorRed','blood']: bs.inputs['Coat Weight'].default_value=.35
    M[t]=m
for t in ['windowGlow','survivorRed','schoolBusYellow']:
    m=M[t].copy(); m.name='emi_'+t; bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Emission Color'].default_value=bs.inputs['Base Color'].default_value; bs.inputs['Emission Strength'].default_value=3; M['emi_'+t]=m

def empty(n,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(n,None); bpy.context.collection.objects.link(o); o.location=loc
    if parent: o.parent=parent; o.matrix_parent_inverse=parent.matrix_world.inverted()
    return o
root=empty('root'); root['asset_id']='int.diner'; root['forward']='+X'; interior=empty('interior',parent=root)
def finish(o,n,m,parent,bevel=0):
    o.name=n; o.data.materials.append(M[m]); bpy.context.view_layer.objects.active=o
    if bevel:
        mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=1 if bevel<=.015 else 3; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w; return o

def box(n,loc,size,m,parent=interior,b=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,n,m,parent,min(b,min(size)*.35))
def cyl(n,loc,r,d,m,parent=interior,axis='z',verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc); o=bpy.context.object
    if axis=='y': o.rotation_euler.x=math.pi/2
    if axis=='x': o.rotation_euler.y=math.pi/2
    return finish(o,n,m,parent,.006)
def tube(n,pts,r,m,parent=interior):
    c=bpy.data.curves.new(n,'CURVE'); c.dimensions='3D'; c.bevel_depth=r; c.bevel_resolution=2; s=c.splines.new('POLY'); s.points.add(len(pts)-1)
    for q,v in zip(s.points,pts):q.co=(*v,1)
    o=bpy.data.objects.new(n,c); bpy.context.collection.objects.link(o); bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o=bpy.context.object; o.select_set(False); return finish(o,n,m,parent)
font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Narrow.ttf')
scriptfont=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Brush Script.ttf')
def text(n,word,loc,w,h,m,wall='back',script=False,parent=interior):
    bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,math.pi/2 if wall=='left' else 0)); o=bpy.context.object
    o.data.body=word; o.data.font=scriptfont if script else font; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.resolution_u=3; o.data.extrude=.002
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object; xs=[v.co.x for v in o.data.vertices]; ys=[v.co.y for v in o.data.vertices]
    if xs:
        for v in o.data.vertices:v.co.x*=w/(max(xs)-min(xs)); v.co.y*=h/(max(ys)-min(ys))
    return finish(o,n,m,parent)
# Raised checker floor on an edged foundation; floor z=.21.
box('foundation',(0,0,.09),(10,9,.18),'asphalt',b=.04)
for ix in range(20):
    for iy in range(18):box('floor_tile',(-4.75+ix*.5,-4.25+iy*.5,.197),(.496,.496,.035),'picketWhite' if (ix+iy)%2==0 else 'uiDark',b=.003)
for y in [-4.49,4.49]:box('slab_edge',(0,y,.1),(10,.035,.2),'sidewalk',b=.006)
# Two retained cutaway walls. Kitchen aperture is built from real wall segments.
box('left_wall',(-4.88,0,2.02),(.24,9,3.62),'windowGlow')
for x,w in [(-3.66,2.45),(3.595,2.59)]:box('back_wall_pier',(x,4.38,2.02),(w,.24,3.62),'windowGlow')
box('pass_below',(-.065,4.38,.78),(4.77,.24,1.14),'windowGlow')
box('pass_above',(-.065,4.38,3.5),(4.77,.24,.64),'windowGlow')
# Top fascia, baseboards, checker dado and corner posts.
for x in [-4.88,4.88]:box('wall_post',(x,4.38,2.03),(.29,.31,3.68),'asphalt')
box('left_end_post',(-4.88,-4.36,2.03),(.3,.3,3.68),'asphalt')
box('left_red_cornice',(-4.73,0,3.77),(.3,8.8,.23),'survivorRed')
box('back_red_cornice',(0,4.22,3.77),(9.6,.3,.23),'survivorRed')
box('left_base',(-4.735,0,.38),(.06,8.7,.25),'uiDark')
box('back_base',(0,4.235,.38),(9.5,.06,.25),'uiDark')
for i in range(35):
    for row in range(2):box('left_dado',(-4.733,-4.25+i*.25,.81+row*.25),(.035,.246,.246),'picketWhite' if (i+row)%2 else 'survivorRed',b=.002)
for i in range(38):
    for row in range(2):box('back_dado',(-4.6+i*.25,4.23,.81+row*.25),(.246,.035,.246),'picketWhite' if (i+row)%2 else 'survivorRed',b=.002)
# Left windows: warm frames, stylized landscape, horizontal venetian slats.
for y in [-2.6,-.75]:
    box('window_frame',(-4.70,y,2.4),(.13,1.68,1.65),'woodWarm')
    box('window_pane',(-4.623,y,2.4),(.018,1.48,1.45),'backpackTeal',b=.002)
    box('landscape_band',(-4.609,y,1.89),(.008,1.47,.3),'grass',b=.001)
    for yy in [-.76,.76]:box('window_trim',(-4.585,y+yy,2.4),(.045,.035,1.5),'schoolBusYellow',b=.008)
    for j in range(9):box('blind_slat',(-4.571,y,2.98-j*.067),(.047,1.47,.031),'schoolBusYellow',b=.005)
    for yy in [-.58,.58]:tube('blind_cord',[(-4.54,y+yy,3.06),(-4.54,y+yy,2.08)],.009,'picketWhite')
# Geometry signs mounted clear of the wall.
box('neon_board',(-4.67,1.48,2.45),(.12,2.42,1.86),'blood')
for y in [.25,2.71]:box('neon_gold_frame',(-4.58,y,2.45),(.05,.045,1.88),'schoolBusYellow')
for z in [1.5,3.4]:box('neon_gold_frame',(-4.58,1.48,z),(.05,2.5,.045),'schoolBusYellow')
text('Joes_script',"Joe's",(-4.588,1.48,2.85),1.96,.68,'emi_schoolBusYellow','left',True)
text('DINER','DINER',(-4.588,1.48,2.08),1.95,.57,'emi_survivorRed','left')
box('good_food_sign',(-4.65,-3.91,2.36),(.12,.78,1.56),'woodWarm')
box('good_food_paper',(-4.575,-3.91,2.36),(.018,.69,1.45),'windowGlow')
for j,w in enumerate(['GOOD','FOOD','BRIGHTER','DAYS']):text('good_food_words',w,(-4.557,-3.91,2.91-j*.35),.58,.22,'uiDark','left')
box('town_board',(3.28,4.19,2.73),(1.68,.13,1.7),'woodWarm')
box('town_blackboard',(3.28,4.108,2.73),(1.54,.018,1.56),'uiDark')
for j,w in enumerate(['SUNSET GROVE','SERVES','A BRIGHTER','TOMORROW']):text('town_motto',w,(3.28,4.09,3.29-j*.3),1.40 if j==0 else 1.26,.20,'picketWhite')
# Porthole kitchen door, framed and hinged on its left edge.
box('door_frame',(-3.52,4.16,1.66),(1.38,.24,2.86),'woodWarm')
door=empty('door_kitchen',(-4.12,4.0,.24),root); bpy.context.view_layer.update()
box('door_panel',(-3.52,4.015,1.65),(1.17,.10,2.72),'blood',door)
cyl('porthole_rim',(-3.52,3.944,2.2),.33,.044,'schoolBusYellow',door,'y')
cyl('porthole_glass',(-3.52,3.914,2.2),.286,.016,'windowGlow',door,'y')
for x in [-3.95,-3.09]:box('door_handle',(x,3.923,1.24),(.046,.053,.22),'sidewalk',door)
# Kitchen pass frame, recessed back, worktops and cabinetry.
box('kitchen_back',(-.065,4.49,2.27),(4.77,.025,1.76),'asphalt')
for x in [-2.48,2.35]:box('pass_jamb',(x,4.15,2.27),(.10,.22,1.87),'sidewalk')
for z in [1.34,3.2]:box('pass_edge',(-.065,4.15,z),(4.93,.22,.10),'sidewalk')
box('kitchen_lower',(.18,3.71,.8),(5.32,.82,1.13),'asphalt')
box('kitchen_worktop',(.18,3.65,1.4),(5.4,1,.12),'sidewalk')
box('kitchen_shelf',(-.065,4.13,2.58),(4.77,.62,.065),'sidewalk')
for x in [-1.9,-.85,.2,1.25,2.3]:
    box('cabinet_door',(x,3.285,.84),(.96,.045,.95),'uiDark')
    box('cabinet_inset',(x,3.254,.82),(.84,.014,.69),'asphalt')
    box('drawer_pull',(x,3.231,1.17),(.42,.035,.035),'sidewalk')
for x in [-1.25,.4,1.65]:
    box('appliance',(x,3.83,1.64),(.63,.44,.36),'uiDark')
    box('appliance_face',(x,3.592,1.64),(.54,.018,.26),'asphalt')
    for xx in [-.16,.16]:cyl('dial',(x+xx,3.57,1.65),.038,.02,'schoolBusYellow',axis='y')
    box('appliance_tray',(x,3.62,1.465),(.73,.5,.024),'sidewalk')
for x in [-1.65,-.85]:
    box('hood',(x,4.02,2.82),(.74,.58,.18),'sidewalk')
    box('hood_flue',(x,4.3,3.04),(.3,.25,.3),'asphalt')
for x in [.4,.75,1.1]:
    for j in range(4):cyl('stacked_plate',(x,4.05,2.64+j*.022),.14,.02,'picketWhite')
# Additional service equipment makes the pass-through a working kitchen.
for x in [-2.04,2.3]:
    cyl('soup_kettle',(x,3.60,1.65),.19,.38,'picketWhite')
    cyl('kettle_lid',(x,3.60,1.854),.20,.04,'sidewalk')
    cyl('kettle_knob',(x,3.60,1.899),.035,.045,'uiDark')
    cyl('kettle_switch',(x,3.396,1.63),.037,.021,'survivorRed',axis='y')
for x in [-.32,-.10,.12]:
    cyl('shelf_jar',(x,4.03,2.78),.074,.28,'woodWarm')
    cyl('jar_lid',(x,4.03,2.925),.080,.027,'schoolBusYellow')
    box('jar_label',(x,3.951,2.79),(.09,.008,.13),'picketWhite',b=.003)
for x in [1.83,2.17]:
    for j in range(6):cyl('service_plates',(x,3.61,1.46+j*.026),.135,.022,'picketWhite')
box('griddle',(-.35,3.57,1.48),(.85,.51,.09),'uiDark')
for i in range(9):box('griddle_ridge',(-.70+i*.085,3.57,1.535),(.018,.43,.018),'sidewalk',b=.003)
# Long red counter with cream rounded top and five chrome stools.
box('counter_plinth',(.65,1.45,.34),(6.25,1.13,.25),'uiDark',b=.09)
box('counter_body',(.65,1.45,.83),(6.18,1.08,.9),'blood',b=.07)
for i in range(19):box('counter_red_panel',(-2.27+i*.32,.892,.82),(.30,.037,.82),'survivorRed',b=.014)
box('counter_top',(.65,1.43,1.34),(6.55,1.32,.14),'picketWhite',b=.065)
box('counter_edge',(.65,.79,1.27),(6.37,.025,.055),'sidewalk')
for x in [-1.9,-.65,.6,1.85,3.1]:
    cyl('stool_base',(x,.10,.266),.29,.07,'sidewalk')
    cyl('stool_post',(x,.10,.66),.06,.76,'sidewalk')
    tube('stool_foot_ring',[(x+.21*math.cos(t*math.tau/32),.10+.21*math.sin(t*math.tau/32),.51) for t in range(33)],.018,'sidewalk')
    cyl('stool_chrome_band',(x,.10,1.02),.295,.12,'sidewalk')
    cyl('stool_cushion',(x,.10,1.105),.30,.13,'survivorRed')
# Booth seats and central tables, the three distinct groups in the reference.
def booth(x,y):
    for side in [-1,1]:
        yy=y+side*.68
        box('booth_base',(x,yy,.35),(1.75,.73,.28),'uiDark')
        box('booth_seat',(x,yy,.6),(1.72,.76,.25),'survivorRed',b=.085)
        back=y+side*1.02
        box('booth_back',(x,back,.99),(1.8,.20,1.46),'blood',b=.065)
        for j in range(5):box('upholstery_channel',(x-.68+j*.34,back-side*.12,1.16),(.325,.09,1.06),'picketWhite' if j==2 else 'survivorRed',b=.04)
        for j in range(5):
            box('booth_outer_panel',(x-.68+j*.34,back+side*.11,1.0),(.326,.038,1.31),'survivorRed',b=.012)
        box('booth_outer_piping',(x,back+side*.138,1.65),(1.70,.022,.029),'sidewalk',b=.006)
        for xx in [-.85,.85]:box('booth_chrome_end',(x+xx,back,.99),(.035,.024,1.35),'sidewalk',b=.008)
    cyl('table_base',(x,y,.265),.3,.07,'sidewalk'); cyl('table_pedestal',(x,y,.7),.055,.86,'sidewalk')
    box('booth_table',(x,y,1.17),(1.83,.95,.12),'picketWhite',b=.065)
booth(-3.28,-2.5); booth(-3.28,.30); booth(-.18,-2.76)
# Ketchup, mustard and chrome napkin dispensers, ceramic cups and saucers.
def condiments(x,y,z):
    box('condiment_tray',(x,y,z+.019),(.5,.25,.035),'uiDark',b=.012)
    for xx,m in [(-.16,'survivorRed'),(-.02,'schoolBusYellow')]:
        cyl('squeeze_bottle',(x+xx,y,z+.16),.048,.27,m,verts=16)
        bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.047,radius2=.014,depth=.08,location=(x+xx,y,z+.335)); finish(bpy.context.object,'bottle_neck',m,interior)
        cyl('bottle_tip',(x+xx,y,z+.39),.011,.036,'picketWhite',verts=12)
    box('napkin_holder',(x+.14,y,z+.15),(.17,.19,.26),'sidewalk',b=.022)
    box('napkins',(x+.14,y-.101,z+.19),(.13,.008,.2),'picketWhite',b=.002)
for x,y,z in [(-3.28,-2.5,1.23),(-3.28,.30,1.23),(-.18,-2.76,1.23),(-1.6,1.43,1.41),(.7,1.43,1.41),(2.9,1.43,1.41)]:condiments(x,y,z)
for x,y,z in [(-2.75,-2.5,1.23),(-2.8,.30,1.23),(.35,-2.76,1.23)]:
    cyl('saucer',(x,y,z+.018),.12,.032,'picketWhite'); cyl('coffee_cup',(x,y,z+.075),.065,.09,'survivorRed'); cyl('coffee',(x,y,z+.125),.049,.008,'woodWarm')
# Register and service counter machines.
box('register_base',(3.34,1.56,1.46),(.54,.42,.10),'asphalt')
reg=box('register_keys',(3.34,1.48,1.56),(.47,.3,.12),'sidewalk'); reg.rotation_euler.x=.18
for i in range(4):
    for j in range(3):box('register_key',(3.19+i*.09,1.40+j*.07,1.637),(.055,.044,.018),'uiDark',b=.003)
box('register_display',(3.34,1.70,1.78),(.47,.10,.26),'asphalt'); box('register_screen',(3.34,1.637,1.79),(.37,.018,.14),'backpackTeal')
# Framed miniature geometric pictures.
def picture(x,y,z,wall='back'):
    size=(.58,.06,.62) if wall=='back' else (.06,.58,.62)
    box('picture_frame',(x,y,z),size,'uiDark')
    face=(x,y-.038,z) if wall=='back' else (x+.038,y,z)
    box('picture_paper',face,(.48,.009,.52) if wall=='back' else (.009,.48,.52),'picketWhite',b=.002)
    for i in range(3):
        pos=(x-.14+i*.14,y-.049,z-.09+i%2*.1) if wall=='back' else (x+.049,y-.14+i*.14,z-.09+i%2*.1)
        cyl('picture_head',(pos[0],pos[1],pos[2]+.12),.045,.008,'asphalt',axis='y' if wall=='back' else 'x',verts=12)
        box('picture_silhouette',pos,(.105,.009,.13) if wall=='back' else (.009,.105,.13),'blood',b=.012)
for x,z in [(-4.3,3.06),(-2.64,3.07),(-1.82,3.48),(4.55,2.82),(4.55,2.1)]:picture(x,4.205,z)
for y,z in [(-.02,3.13),(-.02,2.38),(3.52,2.72)]:picture(-4.67,y,z,'left')
cyl('clock_frame',(.55,4.135,3.48),.28,.085,'uiDark',axis='y')
cyl('clock_face',(.55,4.083,3.48),.241,.017,'picketWhite',axis='y')
for j in range(12):
    t=j*math.tau/12; box('clock_tick',(.55+.2*math.sin(t),4.068,3.48+.2*math.cos(t)),(.017,.01,.035),'blood',b=.002)
tube('clock_hands',[(.44,4.055,3.56),(.55,4.055,3.48),(.55,4.055,3.65)],.012,'uiDark')
# Jukebox with layered horseshoe neon tubes, grille lattice, controls and feet.
jx,jy=4.10,2.57
box('jukebox_base',(jx,jy,.38),(1.10,.61,.32),'uiDark')
box('jukebox_body',(jx,jy,1.19),(1.11,.60,1.55),'blood',b=.09)
# Solid upper arched crown assembled as a filled extruded semicircle.
verts=[]; n=32
profile=[(.55*math.cos(i*math.pi/n),.55*math.sin(i*math.pi/n)) for i in range(n+1)]
for yy in [-.30,.30]:verts.extend([(jx+xx,jy+yy,1.92+zz) for xx,zz in profile])
l=len(profile); faces=[tuple(range(l-1,-1,-1)),tuple(range(l,2*l))]+[(i,(i+1)%l,(i+1)%l+l,i+l) for i in range(l)]
mesh=bpy.data.meshes.new('arched_crown'); mesh.from_pydata(verts,[],faces); bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free(); o=bpy.data.objects.new('arched_crown',mesh); bpy.context.collection.objects.link(o); finish(o,'jukebox_crown','survivorRed',interior,.016)
for r,m in [(.49,'emi_schoolBusYellow'),(.43,'emi_windowGlow'),(.37,'emi_survivorRed')]:
    pts=[(jx-r,jy-.326,.57),(jx-r,jy-.326,1.92)]+[(jx+r*math.cos(math.pi-i*math.pi/32),jy-.326,1.92+r*math.sin(math.pi-i*math.pi/32)) for i in range(33)]+[(jx+r,jy-.326,.57)]
    tube('jukebox_neon',pts,.018,m)
box('jukebox_grille',(jx,jy-.322,1.04),(.57,.035,.88),'backpackTeal',b=.06)
for sign in [-1,1]:
    for off in [-.3,0,.3]:tube('jukebox_grille_wire',[(jx-.24,jy-.35,.71+max(0,off)),(jx+.24,jy-.35,1.30+off)],.009,'schoolBusYellow')
# Recessed arched fan window and decorative rays.
arc=[(jx+.31*math.cos(i*math.pi/24),jy-.355,1.92+.31*math.sin(i*math.pi/24)) for i in range(25)]
me=bpy.data.meshes.new('fan_window'); me.from_pydata(arc,[],[tuple(range(25))]); ob=bpy.data.objects.new('fan_window',me); bpy.context.collection.objects.link(ob); finish(ob,'jukebox_fan_window','backpackTeal',interior)
for angle in [25,65,115,155]:
    t=math.radians(angle); tube('jukebox_fan_ray',[(jx,jy-.369,1.92),(jx+.29*math.cos(t),jy-.369,1.92+.29*math.sin(t))],.009,'schoolBusYellow')
tube('fan_lower_edge',[(jx-.31,jy-.369,1.92),(jx+.31,jy-.369,1.92)],.012,'schoolBusYellow')
box('jukebox_selection',(jx,jy-.364,1.64),(.75,.046,.28),'uiDark')
for i in range(4):
    box('jukebox_song_label',(jx-.28+i*.185,jy-.392,1.68),(.145,.014,.15),'schoolBusYellow')
    for k in range(3):box('song_line',(jx-.28+i*.185,jy-.405,1.64+k*.038),(.10,.006,.01),'blood',b=.001)
for x in [-.47,.47]:box('jukebox_chrome_band',(jx+x,jy-.33,1.38),(.16,.06,.065),'sidewalk')
# Three potted plants, with broad folded leaves rather than spheres.
def plant(x,y,scale=1):
    bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.21*scale,radius2=.29*scale,depth=.43*scale,location=(x,y,.22+.215*scale),rotation=(0,0,math.pi/4)); finish(bpy.context.object,'planter','woodWarm',interior,.015)
    cyl('pot_soil',(x,y,.22+.44*scale),.24*scale,.025,'uiDark')
    for i in range(11):
        t=i*2.399; z=.68*scale; r=(.32+(i%3)*.07)*scale
        dx,dy=math.cos(t),math.sin(t); wx,wy=-dy*.085*scale,dx*.085*scale
        mid=(x+r*.58*dx,y+r*.58*dy,z+.36*scale)
        points=[(x,y,z),(mid[0]+wx,mid[1]+wy,mid[2]-.055*scale),mid,(mid[0]-wx,mid[1]-wy,mid[2]-.055*scale),(x+r*dx,y+r*dy,z+(.24+i%3*.16)*scale)]
        me=bpy.data.meshes.new('leaf'); me.from_pydata(points,[],[(0,1,2),(0,2,3),(1,4,2),(2,4,3)]); o=bpy.data.objects.new('leaf',me); bpy.context.collection.objects.link(o); finish(o,'plant_leaf','foliage' if i%2 else 'grass',interior)
plant(-4.20,-3.89); plant(-4.15,3.3,.85); plant(4.48,3.47)
box('bin',(-3.48,-3.98,.57),(.46,.43,.69),'woodWarm')
box('bin_top',(-3.48,-3.98,.94),(.5,.47,.07),'asphalt')
box('bin_slot',(-3.48,-4.224,.75),(.18,.012,.065),'uiDark')
# Pendant pivots sit at ceiling mounting points, with emissive bulbs and extras.
lamps=[]
for i,(x,y) in enumerate([(-4.1,-2.7),(-4.1,-.95),(-4.1,2.75),(-2.85,3.5),(-1.75,3.6),(.2,3.75)]):
    lamp=empty('lamp_'+str(i),(x,y,3.71),root); bpy.context.view_layer.update(); lamps.append(lamp)
    tube('lamp_arm',[(x-.25,y,3.69),(x,y,3.69),(x,y,3.08)],.022,'uiDark',lamp)
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.21,radius2=.074,depth=.24,location=(x,y,2.97)); finish(bpy.context.object,'pendant_shade','emi_windowGlow',lamp,.008)
    cyl('lamp_cap',(x,y,3.103),.08,.055,'schoolBusYellow',lamp)
    cyl('pendant_glow',(x,y,2.844),.18,.022,'emi_windowGlow',lamp)
# Join meshes by material within each animation assembly.
for parent in [interior,door]+lamps:
    for mat in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name=parent.name+'_'+mat.name
for i,lamp in enumerate(lamps):
    anchor=empty('light:pendant_'+str(i),tuple(lamp.location),root); anchor.location.z=2.84
    anchor['ss_light']=json.dumps({'type':'point','color':'light_window_warm','intensity':1.2,'range':3,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'diner','breakable':True,'emissiveNodes':[lamp.name+'_emi_windowGlow'],'tiers':'all'})
anchor=empty('light:neon',(2,2,2),root); anchor['ss_light']=json.dumps({'type':'neon','color':'light_window_warm','intensity':1,'range':2,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'diner','breakable':True,'emissiveNodes':['interior_emi_windowGlow','interior_emi_schoolBusYellow','interior_emi_survivorRed'],'tiers':'all'})
for n,loc,size in [('floor',(0,0,.1),(10,9,.2)),('wall_left',(-4.88,0,2.02),(.24,9,3.62)),('wall_back',(0,4.38,2.02),(10,.24,3.62)),('counter',(.65,1.45,.83),(6.3,1.13,1.25))]:
    o=empty('col:'+n,loc,root); o['collider']='cuboid'; o['size']=list(size)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']; asset=list(bpy.context.scene.objects)
tri=0
for o in meshes:o.data.calc_loop_triangles(); tri+=len(o.data.loop_triangles)
report={'id':'int.diner','tier':'Hero','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','interior','door_kitchen']),'within_budget':tri<=100000 and len(meshes)<=40,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Framed artwork, window scenery, and fine kitchen details are simplified.']}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
if a.glb:
    # Deterministic vertex AO is carried as COLOR_0, without textures.
    sys.path.insert(0,str(HERE.parents[1]/'tools'/'blender'))
    from sslib.ao import bake_all
    bake_all(meshes,samples=32)
    export(Path(a.glb).resolve())
    # Collapse simplification preserves material and articulated hierarchy.
    backups={o:o.data.copy() for o in meshes}
    for suffix,ratio in [('lod1',.125),('lod2',.03)]:
        for o in meshes:
            o.data=backups[o].copy(); bpy.context.view_layer.objects.active=o
            d=o.modifiers.new('distance simplification','DECIMATE'); d.ratio=ratio; bpy.ops.object.modifier_apply(modifier=d.name)
        export(HERE/('model.'+suffix+'.glb'))
    for o in meshes:o.data=backups[o]
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True; scene.cycles.seed=23
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.13,.19,1); world.node_tree.nodes['Background'].inputs[1].default_value=.45
    for loc,power,size,color in [((2,-6,12),1900,8,(1,.83,.64)),((2,6,10),1400,7,(.82,.87,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=color; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    for lamp in lamps:
        bpy.ops.object.light_add(type='POINT',location=(lamp.location.x,lamp.location.y,2.76)); bpy.context.object.data.energy=18; bpy.context.object.data.color=(1,.6,.22); bpy.context.object.data.shadow_soft_size=.3
    bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; target=Vector((0,0,1.60))
    views={'ref':(13,-17,12),'game':(15,-15,19),'front':(18,0,9),'side':(0,-18,9),'rear':(-13,17,12)}
    cam.location=views[a.view]; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=22.2 if a.view=='game' else 19.8
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'; scene.render.filepath=str(Path(a.render).resolve())
    bpy.ops.render.render(write_still=True); print('RENDER OK')
