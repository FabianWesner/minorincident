"""Sunset Grove mid-size SUV. Metres, +X nose, Z up; deterministic, texture-free.
Reference: 4.65 x 2.16 x 2.16 m, wheelbase 2.82 m, 0.88 m tyres.
All geometry is grouped by moving assembly and material before export.
"""
import argparse
import json
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.lod0 import stabilize_ao, prune_hidden_faces, prepare_export_lod
import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def linear(h):
    return tuple((v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)])


def material(token, color, rough=.45, metal=0, emission=0, alpha=1):
    m=bpy.data.materials.new(('emi_' if emission else 'pal_')+token)
    m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    c=(*linear(color),1)
    b.inputs['Base Color'].default_value=c
    b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    b.inputs['Alpha'].default_value=alpha
    if emission:
        b.inputs['Emission Color'].default_value=c
        b.inputs['Emission Strength'].default_value=emission
    if alpha<1: m.surface_render_method='DITHERED'
    m.diffuse_color=(*linear(color),alpha)
    return m

M={
    'green':material('grass','49684e',.38),
    'rust':material('woodWarm','805844',.75),
    'black':material('uiDark','25222c',.72),
    'trim':material('asphalt','514952',.64),
    'rim':material('sidewalk','94878c',.4,.28),
    'glass':material('backpackTeal','414354',.28,.08,alpha=.58),
    'head':material('windowGlow','ffc773',.29,emission=2.2),
    'amber':material('schoolBusYellow','f2b630',.34,emission=.22),
    'brake':material('sirenRed','ff2d2d',.32,emission=.22),
    
}
# Smoked slate glazing matches the reference.
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.18


def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o)
    o.location=loc
    if parent: o.parent=parent
    bpy.context.view_layer.update()
    return o

root=empty('veh.suv-green')
root['ss_physics']=json.dumps({'class':'heavy','mass':1800,'friction':.75,'restitution':.05,'centerOfMass':[0,.55,0], 'pushable':False,'kickable':False,'flammable':True})
body=empty('body',parent=root)


def finish(o,name,mat,parent=body,bevel=.02):
    o.name=name
    o.data.materials.append(M[mat])
    if bevel >= .01:
        mod=o.modifiers.new('Soft edges','BEVEL'); mod.width=bevel; mod.segments=2 if bevel >= .04 else 1
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    o.parent=parent
    o.matrix_parent_inverse=parent.matrix_world.inverted()
    return o


def box(name,loc,size,mat,parent=body,bevel=.02,rot=None):
    verts=[(x*size[0]/2,y*size[1]/2,z*size[2]/2) for x,y,z in
           [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    faces=[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);o.location=loc
    if rot:o.rotation_euler=rot
    return finish(o,name,mat,parent,min(bevel,min(size)*.4))


def mesh(name,verts,faces,mat,parent=body,bevel=.01):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me); scene.collection.objects.link(o)
    return finish(o,name,mat,parent,bevel)


def prism(name,points,y0,y1,mat,parent=body,bevel=.02):
    n=len(points)
    verts=[(x,y,z) for y in (y0,y1) for x,z in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat,parent,bevel)


def rod(name,start,end,width,mat,parent=body):
    d=Vector(end)-Vector(start)
    o=box(name,(Vector(end)+Vector(start))/2,(width,width,d.length),mat,parent,width*.25)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return o


def cyl(name,loc,r,depth,mat,parent=body,axis='Y',vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='Y':o.rotation_euler.x=math.pi/2
    if axis=='X':o.rotation_euler.y=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,name,mat,parent,.008)


def torus(name,loc,major,minor,mat,parent=body):
    bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=8,location=loc,major_radius=major,minor_radius=minor,rotation=(math.pi/2,0,0))
    o=bpy.context.object
    for f in o.data.polygons:f.use_smooth=True
    return finish(o,name,mat,parent,0)

# Chassis shell with real wheel and door apertures.
shell=prism('Coachwork',[(-2.23,.40),(2.22,.40),(2.24,1.19),(1.28,1.32),(-2.19,1.32)],-.96,.96,'green',bevel=.055)
def subtract(obj,cutter):
    bpy.context.view_layer.objects.active=obj
    m=obj.modifiers.new('Aperture','BOOLEAN');m.operation='DIFFERENCE';m.object=cutter
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
for x in (-1.43,1.39):
    points=[(x-.525,-.15),(x+.525,-.15)]+[(x+.525*math.cos(i*math.pi/32),.44+.525*math.sin(i*math.pi/32)**.55) for i in range(33)]
    cutter=prism('cut',points,-1.25,1.25,'black',bevel=0)
    for m in list(cutter.modifiers):cutter.modifiers.remove(m)
    subtract(shell,cutter)
for s in (-1,1):
    for lo,hi in [(-.92,.10),(.13,1.21)]:
        subtract(shell,box('cut',((lo+hi)/2,s*.94,.91),(hi-lo,.3,1.02),'green',bevel=0))
for f in shell.data.polygons:f.material_index=0
while len(shell.data.materials)>1:shell.data.materials.pop(index=1)
box('Chassis',(0,0,.37),(4.1,1.55,.16),'black',bevel=.035)
box('Cabin floor',(-.45,0,.62),(2.7,1.75,.10),'black')
# A shallow crowned hood with lowered outer facets and a real panel thickness.
xs=[1.25,1.45,1.93,2.17];ys=[-.9,-.70,.70,.9]
vs=[(x,y,1.38-(x-1.25)*.12/.92+.025*(1-(y/.9)**2)) for x in xs for y in ys]
fs=[(i*4+j,(i+1)*4+j,(i+1)*4+j+1,i*4+j+1) for i in range(3) for j in range(3)]
hood=mesh('Hood',vs,fs,'green',bevel=0)
m=hood.modifiers.new('Panel thickness','SOLIDIFY');m.thickness=.038
m=hood.modifiers.new('Panel edge','BEVEL');m.width=.014;m.segments=2
m=hood.modifiers.new('Panel normals','WEIGHTED_NORMAL')
box('Roof',(-.53,0,1.972),(2.97,1.65,.095),'green',bevel=.06)
for y in (-.34,0,.34):
    box('Roof rib',(-.55,y,2.028),(2.30,.028,.017),'green',bevel=.006)
# Window planes are separated from framing; no solid cabin block behind glass.
def glasspanel(name,vs,parent=body):
    o=mesh(name,vs,[tuple(range(len(vs)))],'glass',parent,0)
    m=o.modifiers.new('Pane thickness','SOLIDIFY');m.thickness=.012
    for i in range(len(vs)):rod('Rubber seal',vs[i],vs[(i+1)%len(vs)],.034,'black',parent)
for s in (-1,1):
    rod('A pillar',(1.26,s*.92,1.32),(.91,s*.81,1.95),.086,'green')
    rod('D pillar',(-2.17,s*.92,1.32),(-1.97,s*.81,1.95),.10,'green')
    rod('Cant rail',(-1.96,s*.82,1.954),(.90,s*.82,1.954),.072,'green')
    prism('Rear quarter pillar',[(-1.15,1.31),(-.98,1.31),(-.98,1.94),(-1.15,1.94)],min(s*.82,s*.94),max(s*.82,s*.94),'green')
    vs=[(-2.10,s*.934,1.37),(-1.19,s*.934,1.37),(-1.19,s*.827,1.895),(-1.94,s*.827,1.895)]
    glasspanel('Quarter glass',vs)
    box('Rock slider',(-.10,s*.99,.43),(2.00,.10,.10),'rim',bevel=.025)
    # Thick polygonal arch flare and dark inner fender.
    for x in (-1.43,1.39):
        angles=[math.pi*i/32 for i in range(33)]
        vs=[(x+r*math.cos(t),s*y,.44+r*math.sin(t)**.55) for y in (.958,1.018) for r in (.525,.612) for t in angles]
        fs=[]
        for j in range(32):fs.extend([(j,j+1,j+34,j+33),(j+66,j+99,j+100,j+67),(j,j+66,j+67,j+1),(j+33,j+34,j+100,j+99)])
        fs.extend([(0,33,99,66),(32,98,131,65)])
        mesh('Wheel arch cladding',vs,fs,'rim',bevel=.009)
        box('Mud flap',(x-.44,s*.965,.43),(.055,.25,.35),'black',bevel=.015)
    for front in (True,False):
        lo,hi=(.13,1.21) if front else (-.92,.10)
        g=empty(('door' if front else 'doorRear')+('L' if s<0 else 'R'),(hi,s*.945,1.15),root)
        points=[(lo,.49),(hi,.49),(hi,1.31),(lo,1.31)]
        if front:
            # Door corner follows the front arch instead of covering the wheel.
            t0=math.acos((hi-1.39)/.532)
            points=[(lo,.49),(.861,.49)]+[(1.39+.532*math.cos(math.pi+(t0-math.pi)*j/12),.44+.532*max(0,math.sin(math.pi+(t0-math.pi)*j/12))**.55) for j in range(13)]+[(hi,1.31),(lo,1.31)]
        prism('Door skin',points,min(s*.962,s*.978),max(s*.962,s*.978),'green',g,.018)
        coords=[(lo+.04,1.365),(hi-.035,1.365),(.865 if front else hi-.035,1.90),(lo+.04,1.90)]
        vs=[(x,s*(.941-(z-1.365)*.21),z) for x,z in coords]
        glasspanel('Door glazing',vs,g)
        for x in (lo+.015,):rod('Door pillar',(x,s*.95,1.32),(x,s*.823,1.937),.063,'green',g)
        if not front:rod('Quarter divider',(-.68,s*.94,1.366),(-.68,s*.829,1.90),.028,'black',g)
        moldhi=.89 if front else hi
        box('Side moulding',((lo+moldhi)/2,s*1.001,.71),(moldhi-lo-.025,.043,.072),'rim',g,.012)
        box('Handle recess',(lo+.22,s*.994,1.18),(.225,.015,.090),'black',g,.025)
        box('Handle',(lo+.22,s*1.017,1.19),(.17,.041,.044),'rim',g,.011)
        if front:
            box('Mirror stalk',(1.09,s*1.004,1.38),(.15,.21,.11),'black',g,.025)
            box('Mirror housing',(1.08,s*1.135,1.44),(.26,.15,.20),'rim',g,.035)
            box('Mirror glass',(.942,s*1.136,1.44),(.015,.12,.147),'glass',g,.018)
# Windscreen and rear liftgate.
glasspanel('Windshield',[(1.25,-.87,1.355),(1.25,.87,1.355),(.90,.78,1.916),(.90,-.78,1.916)])
hatch=empty('doorHatch',(-1.98,0,1.95),root)
prism('Tailgate',[(-2.213,.83),(-2.213,1.32),(-2.19,1.365),(-2.245,1.365),(-2.25,.83)],-.86,.86,'green',hatch,.018)
for s in (-1,1):
    rod('Hatch side frame',(-2.217,s*.835,1.36),(-2.046,s*.79,1.94),.075,'green',hatch)
rod('Hatch header',(-2.046,-.79,1.935),(-2.046,.79,1.935),.075,'green',hatch)
glasspanel('Rear glass',[(-2.195,-.79,1.40),(-2.195,.79,1.40),(-2.036,.76,1.894),(-2.036,-.76,1.894)],hatch)
box('Tailgate handle',(-2.267,0,1.17),(.04,.36,.065),'black',hatch,.012)
box('Rear plate recess',(-2.268,0,.98),(.024,.58,.25),'black',hatch,.015)
box('Rear plate',(-2.291,0,.98),(.016,.42,.18),'rim',hatch,.008)
rod('Rear wiper',(-2.215,.40,1.426),(-2.177,-.18,1.47),.025,'black',hatch)
# Readable seats, dashboard, steering wheel and rear-view mirror.
box('Dashboard',(1.08,0,1.30),(.32,1.69,.16),'black',bevel=.04)
for x in (.23,-.89):
    for y in (-.43,.43):
        box('Seat cushion',(x,y,.94),(.51,.47,.16),'trim',bevel=.055)
        box('Seat back',(x-.24,y,1.26),(.17,.47,.54),'trim',bevel=.05,rot=(0,-.12,0))
        box('Headrest',(x-.28,y,1.60),(.15,.29,.22),'trim',bevel=.04)
box('Center console',(.27,0,1.00),(.68,.18,.20),'black',bevel=.035)
steer=torus('Steering wheel',(.81,-.43,1.39),.165,.021,'black');steer.rotation_euler=(0,math.pi/2,.10)
rod('Steering spoke',(.81,-.59,1.39),(.81,-.27,1.39),.026,'black')
box('Rearview mirror',(.95,0,1.78),(.055,.26,.105),'black',bevel=.018)
for y in (-.48,.33):
    rod('Wiper arm',(1.269,y,1.383),(1.216,y+.18,1.48),.017,'black')
    rod('Wiper blade',(1.21,y+.01,1.489),(1.21,y+.44,1.489),.023,'black')
for s in (-1,1):
    rod('Hood crease',(1.29,s*.60,1.39),(2.11,s*.60,1.28),.016,'green')
    # Long roof rails with sloped raised ends and transverse load bars.
    for x in (-1.79,.62):box('Rail foot',(x,s*.68,2.033),(.24,.18,.07),'black',bevel=.018)
    rod('Rack rise',(-1.92,s*.68,2.043),(-1.74,s*.68,2.19),.070,'rim')
    rod('Rack rail',(-1.74,s*.68,2.19),(.61,s*.68,2.19),.070,'rim')
    rod('Rack drop',(.61,s*.68,2.19),(.76,s*.68,2.043),.070,'rim')
for x in (-1.45,.31):
    box('Crossbar',(x,0,2.175),(.092,1.45,.065),'black',bevel=.018)
    for s in (-1,1):box('Rack clamp',(x,s*.67,2.185),(.15,.16,.08),'black',bevel=.014)
for x,ax in [(1.39,'F'),(-1.43,'R')]:
    for s,side in [(-1,'L'),(1,'R')]:
        g=empty('wheel'+ax+side,(x,s*.96,.44),root)
        torus('Tyre',(x,s*.96,.44),.335,.105,'black',g)
        cyl('Tyre barrel',(x,s*.96,.44),.348,.28,'black',g)
        torus('Sidewall',(x,s*1.106,.44),.347,.014,'black',g)
        cyl('Rim shadow',(x,s*1.11,.44),.267,.018,'black',g)
        torus('Rim lip',(x,s*1.126,.44),.251,.017,'rim',g)
        cyl('Rim disc',(x,s*1.125,.44),.227,.024,'rim',g)
        for j in range(5):
            t=2*math.pi*j/5
            cyl('Dark vent',(x+.171*math.sin(t),s*1.144,.44+.171*math.cos(t)),.052,.011,'black',g,vertices=20)
            cyl('Lug nut',(x+.083*math.sin(t),s*1.167,.44+.083*math.cos(t)),.015,.019,'rim',g,vertices=6)
        cyl('Hub',(x,s*1.156,.44),.087,.046,'rim',g,vertices=12)
        for j in range(56):
            t=2*math.pi*j/56
            for k in (-1,0,1):
                o=box('Tread block',(x+.429*math.sin(t),s*.96+k*.085,.44+.429*math.cos(t)),(.040,.068,.022),'black',g,0)
                o.rotation_euler.y=t
# Broad bumpers and front grille, all inserts offset from supporting surfaces.
for x in (-2.255,2.255):
    box('Bumper',(x,0,.65),(.24,2.03,.30),'rim',bevel=.065)
    box('Bumper top',(x,0,.812),(.22,1.97,.027),'black',bevel=.009)
    for y in (-.62,.62):box('Bumper guard',(x+(.14 if x>0 else -.14),y,.65),(.075,.15,.33),'rim',bevel=.021)
box('Grille surround',(2.24,0,1.054),(.10,1.11,.38),'rim',bevel=.042)
box('Grille recess',(2.298,0,1.054),(.026,1.014,.31),'black',bevel=.027)
for z in (.946,1.025,1.105,1.184):box('Grille slat',(2.325,0,z),(.03,.96,.029),'rim',bevel=.008)
for y in (-.33,0,.33):box('Grille brace',(2.313,y,1.06),(.018,.028,.29),'rim',bevel=.005)
box('Lower intake',(2.387,0,.62),(.025,.96,.14),'black',bevel=.015)
box('Front plate',(2.410,0,.62),(.022,.38,.19),'rim',bevel=.012)
lf=empty('lightsFront',(2.27,0,1.05),root);lb=empty('lightsBrake',(-2.22,0,1.20),root)
for s,side in [(-1,'L'),(1,'R')]:
    box('Headlamp bezel',(2.26,s*.737,1.077),(.085,.36,.36),'black',bevel=.028)
    box('Headlamp lens',(2.315,s*.705,1.079),(.047,.268,.28),'head',lf,.032)
    cyl('Headlamp reflector',(2.348,s*.705,1.079),.109,.017,'head',lf,axis='X',vertices=32)
    box('Front turn lens',(2.30,s*.915,1.07),(.052,.122,.31),'amber',lf,.015)
    box('Fog recess',(2.39,s*.83,.66),(.024,.23,.15),'black',bevel=.016)
    box('Fog lens',(2.41,s*.83,.66),(.016,.15,.09),'rim',bevel=.012)
    box('Side marker',(1.38,s*.978,1.22),(.105,.018,.050),'amber',lf,.01)
    box('Rear lamp bezel',(-2.241,s*.94,1.23),(.08,.18,.61),'black',bevel=.021)
    box('Brake lamp',(-2.291,s*.94,1.23),(.044,.133,.53),'brake',lb,.018)
    for z in (1.10,1.36):box('Rear amber strip',(-2.319,s*.94,z),(.014,.12,.073),'amber',lb,.006)
    box('Reversing lens',(-2.323,s*.94,1.19),(.013,.12,.060),'head',lb,.007)
    for front,group,pos in [(True,lf,(2.36,s*.705,1.08)),(False,lb,(-2.34,s*.94,1.23))]:
        anchor=empty('light:'+('headlight' if front else 'brake')+side,parent=group);anchor.matrix_world.translation=pos
        if front:anchor.rotation_euler=(0,-math.pi/2+.07,0)
        anchor['ss_light']=json.dumps({'type':'spot' if front else 'point','color':'light_led_white' if front else 'light_siren_red','intensity':3 if front else .7,'range':18 if front else 2,'angle':48,'penumbra':.35,'pool':True,'beam':'soft' if front else 'none','flare':True,'reflect':True,'shadow':'hero' if front else 'none','powerGroup':'self','breakable':True,'emissiveNodes':[group.name+'_emi_'+('windowGlow' if front else 'sirenRed')],'tiers':'all'})
box('High brake bezel',(-2.052,0,1.928),(.045,.39,.075),'black',bevel=.012)
box('High brake lamp',(-2.079,0,1.928),(.017,.34,.045),'brake',lb,.009)
box('Fuel flap shadow',(-1.92,-.979,1.14),(.235,.014,.237),'black',bevel=.025)
box('Fuel flap',(-1.92,-.993,1.14),(.208,.013,.21),'green',bevel=.02)
cyl('Exhaust',(-2.24,.62,.38),.060,.28,'rim',axis='X')
cyl('Exhaust bore',(-2.39,.62,.38),.044,.017,'black',axis='X')
# Restrained raised chips, deterministic and deliberately above panel faces.
for s in (-1,1):
    for x,z,w in [(-2.08,.89,.06),(-1.78,1.03,.04),(-.78,.57,.09),(-.53,1.29,.045),(.17,.53,.055),(.46,.76,.035),(1.79,1.23,.04),(2.03,1.07,.045)]:
        parent=body
        if -.92<x<.1:parent=bpy.data.objects['doorRear'+('L' if s<0 else 'R')]
        elif .13<x<1.21:parent=bpy.data.objects['door'+('L' if s<0 else 'R')]
        prism('Paint chip',[(x-w/2,z),(x+w*.45,z+.008),(x+w*.25,z+.044),(x-w*.24,z+.028)],min(s*.982,s*.989),max(s*.982,s*.989),'rust' if parent==body else 'rim',parent,.002)
for name,loc in [('driverSeat',(.23,-.43,.94)),('exitL',(.35,-1.45,0)),('exitR',(.35,1.45,0))]:empty(name,loc,root)
col=empty('col:chassis',(0,0,1.03),root);col['collider']='cuboid';col['shape']='cuboid';col['size']=[4.4,1.9,1.7]

def clean_mesh(o):
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bad=[f for f in bm.faces if f.calc_area()<1e-9]
    if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
    bm.to_mesh(o.data);bm.free();o.data.update()

prune_hidden_faces([o for o in scene.objects if o.type == "MESH"], defer=True)
# Apply modifiers then join only within each joint/material partition.
for o in list(scene.objects):
    if o.type!='MESH':continue
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    clean_mesh(o)
partitions={}
for o in list(scene.objects):
    if o.type=='MESH':partitions.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
for (parent,mat),objects in partitions.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    o=bpy.context.object;o.name=parent+'_'+mat
    # Every assembly's mesh origin sits at the same motion joint as its parent.
    scene.cursor.location=o.parent.matrix_world.translation
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    if mat.startswith('emi_') and 'schoolBusYellow' in mat:o['decorativeEmissive']=True
scene.cursor.location=(0,0,0)
for anchor in scene.objects:
    if anchor.type=='EMPTY' and 'ss_light' in anchor:
        data=json.loads(anchor['ss_light'])
        data['emissiveNodes']=[o.name for o in anchor.parent.children if o.type=='MESH' and o.data.materials[0].name.startswith('emi_')]
        anchor['ss_light']=json.dumps(data)
# Scale the complete hierarchy once, preserving joints and metric world transforms.
from mathutils import Matrix
scale = Matrix.Diagonal((4.4/4.842, 1.9/2.42, 1.8/2.225, 1))
worlds = {}
for o in scene.objects:
    original=o.matrix_world.copy()
    worlds[o]=scale @ original
    if o.type=='EMPTY':
        worlds[o]=original
        worlds[o].translation=scale @ original.translation
def depth(o):
    return 1 + depth(o.parent) if o.parent else 0
for o in sorted(scene.objects, key=depth):
    o.matrix_world = worlds[o]
    bpy.context.view_layer.update()
for o in scene.objects:
    if o.type == 'MESH':
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
col['size']=[4.3,1.65,1.65]

# Deterministic 32-sample Cycles AO bake, stored as the active vertex colour.
if a.glb:
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0
    scene.render.bake.target='VERTEX_COLORS'
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type=='MESH':
            attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
            o.data.color_attributes.active_color=attr
            o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.bake(type='AO',target='VERTEX_COLORS',use_clear=True)
    # Keep baked contact shading gentle in the warm miniature palette.
    for o in scene.objects:
        if o.type=='MESH':
            for color in o.data.color_attributes['ao'].data:
                color.color=tuple(.9+.1*max(0,min(1,c)) for c in color.color[:3])+(1,)
    # Transparent panes do not receive solid-surface occlusion.
    for o in scene.objects:
        if o.type=='MESH' and o.data.materials[0]==M['glass']:
            for color in o.data.color_attributes['ao'].data:color.color=(1,1,1,1)
    print('AO OK')

for o in scene.objects:
    if o.type=='MESH':o.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in scene.objects if o.type=='MESH')
report={'id':'veh.suv-green','tier':'Hero','triangles':triangles,'draw_calls':len(partitions),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) for n in ['body','wheelFL','wheelFR','wheelRL','wheelRR','doorL','lightsFront','lightsBrake','driverSeat','exitL','exitR']),'within_budget':triangles<=80000 and len(partitions)<=40,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    def export_glb(path):
        stabilize_ao(list(bpy.context.scene.objects)); prepare_export_lod(list(bpy.context.scene.objects), str(Path(path).resolve())); bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False,export_vertex_color='NAME',export_vertex_color_name='ao',export_all_vertex_colors=False)
    export_glb(a.glb)
    # Independently exported LODs preserve all node names and joint transforms.
    meshes=[o for o in scene.objects if o.type=='MESH']
    originals={o:o.data for o in meshes}
    for suffix,ratio in [('lod1',.15),('lod2',.03)]:
        for o in meshes:
            o.data=originals[o].copy()
        for o in scene.objects:
            if o.type=='MESH':
                d=o.modifiers.new('LOD','DECIMATE');d.ratio=ratio
                bpy.context.view_layer.objects.active=o
                bpy.ops.object.modifier_apply(modifier=d.name)
                clean_mesh(o)
        export_glb(HERE/('model.'+suffix+'.glb'))
        for o in meshes:
            reduced=o.data;o.data=originals[o];bpy.data.meshes.remove(reduced)
    print('GLB OK',report)
if a.render:
    world=bpy.data.worlds.new('Studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.105,.14,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
    def light(loc,energy,size,color):
        ld=bpy.data.lights.new('Studio softbox','AREA');ld.energy=energy;ld.shape='DISK';ld.size=size;ld.color=color
        o=bpy.data.objects.new('Studio softbox',ld);scene.collection.objects.link(o);o.location=loc
        o.rotation_euler=(Vector((0,0,.95))-o.location).to_track_quat('-Z','Y').to_euler()
    light((1,-4,7),1100,5,(1,.87,.75));light((-3,-1,4),650,5,(.75,.81,1));light((1,4,5),1300,4,(1,.72,.48))
    ground=box('Studio floor',(0,0,-.07),(200,200,.1),'black',parent=root,bevel=0)
    ground.data.materials.clear();gm=material('studio','302c36',.85);ground.data.materials.append(gm)
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(cam);scene.camera=cam
    views={'ref':(6,-8,4.9),'game':(7,-7,8.4),'front':(9,0,2.8),'rear':(-8,-5,3.8),'side':(0,-10,2.3)}
    cam.data.type='ORTHO'
    scene.render.engine='CYCLES';scene.cycles.use_denoising=True
    scene.cycles.device='CPU'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.30
    requests=[(a.view,Path(a.render).resolve(),a.width,a.height,a.samples)]
    # Produce both final deliverables while holding one shared render lease.
    if Path(a.render).name.startswith('round') and Path(a.render).name.endswith('-ref.png'):
        requests.append(('game',Path(a.render).resolve().with_name(Path(a.render).name.replace('-ref','-game')),960,540,24))
    if Path(a.render).name=='round4-ref.png':
        requests.append(('rear',HERE/'renders/round4-rear.png',960,540,24))
    if Path(a.render).name=='hero.png':
        requests.append(('game',HERE/'renders/game.png',960,540,24))
    for view,path,width,height,samples in requests:
        cam.location=views[view]
        cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=6.7 if view=='game' else 6.3
        scene.cycles.samples=samples
        scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
        scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        print('RENDER OK',path)
