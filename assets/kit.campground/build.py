"""Campground kit. Deterministic bpy source; metres, +X forward, +Z up.
No textures. Applied trim clears supporting surfaces by >= 3 mm.
Static meshes batch by palette; wheel, door and lamp pivots remain independent.
"""
import argparse
import json
import math
import sys
import struct
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
for name in ('render', 'glb'): parser.add_argument('--' + name)
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
colors = {'woodWarm':'b0703f', 'picketWhite':'f2e6dc', 'schoolBusYellow':'f2b630',
          'grass':'6f8f3a', 'survivorRed':'d9363e', 'uiDark':'25222c',
          'asphalt':'5b4f5c', 'sidewalk':'b9a4a0', 'brick':'a8483a',
          'backpackTeal':'2f6e6a', 'windowGlow':'ffc773'}
materials = {}
def material(token, emissive=False):
    name = ('emi_' if emissive else 'pal_') + token
    if name in materials: return materials[name]
    c = [int(colors[token][i:i+2],16)/255 for i in (0,2,4)]
    c = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c]
    m = bpy.data.materials.new(name); m.use_nodes = True; m.diffuse_color = (*c,1)
    bs = m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value = (*c,1)
    bs.inputs['Roughness'].default_value = .72 if token != 'backpackTeal' else .23
    if emissive:
        bs.inputs['Emission Color'].default_value = (*c,1)
        bs.inputs['Emission Strength'].default_value = 1.2 if token=='schoolBusYellow' else 3.5
    materials[name] = m
    return m
root = bpy.data.objects.new('root', None); bpy.context.collection.objects.link(root)
root['asset_id'] = 'kit.campground'; root['category'] = 'building'; root['forward'] = '+X'
keep = []
def empty(name, loc=(0,0,0)):
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o); o.parent=root; o.location=loc
    return o

def finish(o, name, token, bevel=0, emit=False):
    o.name=name; o.parent=root; o.data.materials.append(material(token,emit))
    bpy.context.view_layer.objects.active=o
    if bevel:
        m=o.modifiers.new('soft bevel','BEVEL'); m.width=bevel; m.segments=2 if bevel >= .035 else 1
        bpy.ops.object.modifier_apply(modifier=m.name)
        m=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=m.name)
    return o

def mesh(name, vertices, faces, token, bevel=0, emit=False):
    d=bpy.data.meshes.new(name); d.from_pydata(vertices,[],faces); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o)
    return finish(o,name,token,bevel,emit)

def box(name,loc,size,token='woodWarm',bevel=.02,emit=False):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,token,bevel,emit)

def cyl(name,a,b,r,token='woodWarm',n=12,emit=False):
    direction=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=direction.length,location=(Vector(a)+Vector(b))/2)
    o=bpy.context.object; o.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
    return finish(o,name,token,0,emit)

def beam(name,a,b,width,token='woodWarm'):
    d=Vector(b)-Vector(a); o=box(name,(Vector(a)+Vector(b))/2,(width,width,d.length),token,.012)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o

def path(name,points,r,token='woodWarm',n=6):
    # One contiguous tube; parallel frames make tent seams and cables inexpensive.
    vertices=[]
    for i,p in enumerate(points):
        d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        d.normalize(); u=d.cross(Vector((0,0,1)) if abs(d.z)<.95 else Vector((0,1,0))).normalized(); v=d.cross(u)
        vertices.extend(Vector(p)+r*(u*math.cos(j*math.tau/n)+v*math.sin(j*math.tau/n)) for j in range(n))
    faces=[tuple(i*n+j for j in range(n-1,-1,-1))]
    faces += [(i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j) for i in range(len(points)-1) for j in range(n)]
    faces.append(tuple((len(points)-1)*n+j for j in range(n)))
    return mesh(name,vertices,faces,token)

def sphere(name,loc,scale,token,emit=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=loc)
    o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for f in o.data.polygons: f.use_smooth=True
    return finish(o,name,token,0,emit)

def pivot_group(name,objects,loc):
    p=empty(name,loc); keep.append(p)
    bpy.context.view_layer.update()
    for o in objects:
        world=o.matrix_world.copy(); o.parent=p; o.matrix_world=world; keep.append(o)
    return p

def light(name,loc,nodes,fire=False):
    o=empty('light:'+name,loc)
    o['ss_light']=json.dumps({'type':'fire' if fire else 'point','color':'light_fire' if fire else 'light_window_warm','intensity':4 if fire else 1.5,'range':4 if fire else 2.5,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'hero' if fire else 'none','heroPriority':2 if fire else 0,'flicker':'fire' if fire else 'none','animation':None,'powerGroup':'self','breakable':not fire,'emissiveNodes':nodes,'tiers':'all'})
    return o

def tent(cx,cy,color,index):
    # Rectangular domed fly: low skirt, broad shoulder and rounded crown.
    rings=[(1.38,1.28,.08),(1.27,1.17,.35),(.88,.83,1.55),(.69,.65,1.80),(.49,.46,1.97),(.28,.26,2.09),(.13,.13,2.14)]
    corners=[(1,-1),(1,1),(-1,1),(-1,-1)]
    for j in range(len(rings)-1):
        xa,ya,za=rings[j]; xb,yb,zb=rings[j+1]
        for side in (1,2,3):
            s,t=corners[side],corners[(side+1)%4]
            verts=[(cx+xa*s[0],cy+ya*s[1],za),(cx+xa*t[0],cy+ya*t[1],za),(cx+xb*t[0],cy+yb*t[1],zb),(cx+xb*s[0],cy+yb*s[1],zb)]
            token='asphalt' if j==0 else color
            if index==2 and j==1: token='picketWhite'
            mesh('tent fly',verts,[(0,1,2,3)],token)
    if index==2:
        for side in (1,2,3):
            a,b=corners[side],corners[(side+1)%4]
            verts=[(cx+1.278*a[0],cy+1.178*a[1],.357),(cx+1.278*b[0],cy+1.178*b[1],.357),(cx+1.238*b[0],cy+1.143*b[1],.48),(cx+1.238*a[0],cy+1.143*a[1],.48)]
            mesh('red fly hem',verts,[(0,1,2,3)],'survivorRed')
    def profile(z):
        for i in range(len(rings)-1):
            a,b=rings[i:i+2]
            if a[2] <= z <= b[2]:
                t=(z-a[2])/(b[2]-a[2]); return a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t
        return .13,.13
    levels=[(.08,.54),(.35,.54),(.9,.52),(1.15,.46),(1.35,.33),(1.46,.17),(1.50,0),(1.55,0),(1.97,0),(2.14,0)]
    for sign in (-1,1):
        for i in range(len(levels)-1):
            z0,w0=levels[i];z1,w1=levels[i+1]; x0,y0=profile(z0);x1,y1=profile(z1)
            token='asphalt' if i==0 else ('asphalt' if index==2 and z0<1.55 else color)
            mesh('arched entrance panel',[(cx+x0,cy+sign*w0,z0),(cx+x0,cy+sign*y0,z0),(cx+x1,cy+sign*y1,z1),(cx+x1,cy+sign*w1,z1)],[(0,1,2,3)],token)
        arc=[(cx+profile(z)[0]+.012,cy+sign*w,z) for z,w in levels[:7]]
        path('zippered doorway',arc,.029,'sidewalk',8)
        path('zipper seam',[(x+.013,y,z) for x,y,z in arc],.007,'uiDark',5)
        for z in (.4,.94,1.20):
            w=min(levels,key=lambda p:abs(p[0]-z))[1];x=profile(z)[0]
            box('zipper buckle',(cx+x+.043,cy+sign*w,z),(.032,.043,.075),'sidewalk',.006)
    box('waterproof floor',(cx,cy,.075),(2.67,2.48,.07),'uiDark',.014)
    # Interior lining is open at the entrance; camping mat readable through the aperture.
    box('sleeping mat',(cx-.35,cy+.1,.135),(1.65,.72,.05),'backpackTeal',.02)
    sphere('rolled blanket',(cx-.94,cy+.1,.23),(.18,.35,.13),'asphalt')
    for sx,sy in corners:
        line=[(cx+sx*x,cy+sy*y,z+.018) for x,y,z in rings]
        path('flexible tent pole',line,.033,'woodWarm',8)
        for j in (1,2):
            x,y,z=line[j];sphere('pole ferrule',(x,y,z),(.044,.044,.055),'uiDark')
        foot=(cx+sx*1.65,cy+sy*1.5,.05)
        attachment=(cx+sx*.92,cy+sy*.86,1.5)
        path('guy line',[attachment,(foot[0],foot[1],.23)],.011,'schoolBusYellow',5)
        cyl('tent peg',(foot[0],foot[1],0),(foot[0],foot[1],.28),.022,'woodWarm',8)
        cyl('peg hook',(foot[0],foot[1],.22),(foot[0]+.09,foot[1],.22),.025,'woodWarm',8)
    box('peak vent',(cx,cy,2.15),(.36,.33,.075),color,.035)
    box('vent cap',(cx+.03,cy,2.19),(.22,.26,.045),'asphalt',.015)
    for sx in (-1,1):
        path('fly stitched seam',[(cx+sx*.07,cy-1.185,.36),(cx+sx*.07,cy-.843,1.56),(cx+sx*.07,cy-.473,1.98),(cx+sx*.07,cy-.15,2.15)],.006,'woodWarm',4)
    col=empty('col:tent'+str(index),(cx,cy,.75));col['collider']='cuboid';col['size']=[2.7,2.5,1.5]

tent(-1.65,-2.45,'schoolBusYellow',1)
tent(-1.65,1.45,'survivorRed',2)
# String lights stand behind the tents and sag in a single low-cost tube.
for y in (-4.4,3.4):
    box('light post',(-3.8,y,1.70),(.19,.19,3.40),'woodWarm',.025)
    box('post cap',(-3.8,y,3.44),(.235,.235,.09),'woodWarm',.018)
    for z in (3.12,3.21):
        box('rope tie',(-3.8,y,z),(.215,.215,.033),'uiDark',.005)
    for z in (.6,1.4,2.2):
        box('post grain',(-3.697,y+.026,z),(.012,.017,.43),'brick',.003)
points=[(-3.8,-4.4+7.8*i/32,3.2-.60*math.sin(math.pi*i/32)) for i in range(33)]
path('sagging string cable',points,.019,'woodWarm',6)
for i in range(5):
    y=-3.8+i*1.65;t=(y+4.4)/7.8;z=3.2-.6*math.sin(math.pi*t)
    socket=cyl('bulb socket',(-3.8,y,z-.03),(-3.8,y,z-.16),.045,'woodWarm')
    bulb=sphere('bulb_'+str(i),(-3.8,y,z-.25),(.095,.095,.12),'windowGlow',True)
    pivot_group('lamp_'+str(i),[bulb],(-3.8,y,z))
    light('string_'+str(i),(-3.8,y,z-.25),[bulb.name])
# Picnic table: individually bevelled planks, braces, bolts and A-frame legs.
tx,ty=2.0,-.4
for i in range(5):
    box('tabletop plank',(tx,ty+(i-2)*.195,.89),(2.15,.185,.12),'woodWarm',.022)
    for x in (tx-.72,tx+.72):
        cyl('table fixing',(x,ty+(i-2)*.195,.952),(x,ty+(i-2)*.195,.961),.018,'sidewalk',8)
for s in (-1,1):
    for j in (-1,1): box('bench plank',(tx,ty+s*.83+j*.105,.48),(2.30,.20,.105),'woodWarm',.018)
for x in (tx-.75,tx+.75):
    box('table crossbeam',(x,ty,.76),(.14,1.08,.14),'woodWarm',.016)
    box('bench crossbeam',(x,ty,.37),(.16,2.07,.13),'woodWarm',.015)
    for s in (-1,1):
        beam('A frame leg',(x,ty+s*.85,.06),(x,ty+s*.35,.81),.15)
        cyl('carriage bolt',(x+.082,ty+s*.56,.43),(x+.098,ty+s*.56,.43),.031,'asphalt',10)
beam('table diagonal',(tx-.7,ty,.42),(tx+.15,ty,.77),.085)
beam('table diagonal',(tx+.7,ty,.42),(tx-.15,ty,.77),.085)
# Fire ring, inset dark bed, split logs and several tapered flame tongues.
fx,fy=2.2,-3.25
cyl('charcoal bed',(fx,fy,.035),(fx,fy,.09),.72,'uiDark',24)
for i in range(14):
    a=i*math.tau/14
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(fx+.82*math.cos(a),fy+.82*math.sin(a),.20))
    o=bpy.context.object;o.scale=(.26,.22,.22);o.rotation_euler=(.1,.1,a);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,'rounded ring stone','sidewalk' if i%3 else 'asphalt',.035)
for i in range(7):
    a=i*math.tau/7;start=(fx+.56*math.cos(a),fy+.56*math.sin(a),.14);end=(fx+.12*math.cos(a),fy+.12*math.sin(a),.63)
    cyl('split firewood',start,end,.095,'woodWarm',9)
    d=(Vector(end)-Vector(start)).normalized()
    cyl('log endgrain',Vector(start)-d*.006,Vector(start)-d*.014,.077,'schoolBusYellow',9)
    cyl('log dark heart',Vector(start)-d*.015,Vector(start)-d*.018,.042,'woodWarm',7)
def flame(name,cx,cy,height,radius,token):
    vs=[];n=7
    for z,r,dx in [(0,radius,0),(.35*height,radius*.80,.04),(.70*height,radius*.42,-.035)]:
        vs.extend((cx+dx+r*math.cos(j*math.tau/n),cy+r*math.sin(j*math.tau/n),.20+z) for j in range(n))
    fs=[(k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(2) for j in range(n)]
    vs.append((cx+.10,cy,.20+height))
    fs.extend((2*n+j,2*n+(j+1)%n,3*n) for j in range(n))
    return mesh(name,vs,fs,token,emit=True)
fire=[]
for i in range(5):
    a=i*2.4;fire.append(flame('fire tongue',fx+.18*math.cos(a),fy+.18*math.sin(a),.83+.12*(i%3),.14,'schoolBusYellow'))
fire.append(flame('fire heart',fx+.16,fy,1.06,.14,'windowGlow'))
pivot_group('campfire_flames',fire,(fx,fy,.20));light('campfire',(fx,fy,.65),[o.name for o in fire],True)
# Camper van: +X front. Side panels bridge wheel arch cutouts, rather than burying tyres.
vx,vy=2.1,3.2
v=lambda x,y,z:(vx+x,vy+y,z)
box('van chassis',v(0,0,.48),(4.45,1.65,.19),'uiDark',.045)
box('camper upper body',v(-.32,0,1.69),(3.9,1.84,1.24),'picketWhite',.065)
# Sloped cab and windshield form a readable older box camper silhouette.
mesh('cab body',[v(x,y,z) for x,y,z in [(1.43,-.92,.72),(2.28,-.92,.72),(2.28,-.92,1.05),(1.64,-.92,2.25),(1.43,-.92,2.25),(1.43,.92,.72),(2.28,.92,.72),(2.28,.92,1.05),(1.64,.92,2.25),(1.43,.92,2.25)]],[(0,1,2,3,4),(5,9,8,7,6),(0,5,6,1),(1,6,7,2),(2,7,8,3),(3,8,9,4),(4,9,5,0)],'picketWhite',.025)
box('raised camper roof',v(-.23,0,2.31),(4.25,1.96,.23),'picketWhite',.07)
for x in (-1.05,.36):
    box('roof vent base',v(x,0,2.46),(.72,.71,.075),'woodWarm',.035)
    box('roof vent hood',v(x,0,2.54),(.64,.63,.13),'asphalt',.04)
    for i in range(4):box('vent grille',v(x-.20+i*.13,-.323,2.54),(.025,.015,.08),'uiDark',.003)
for s in (-1,1):
    # Lower cladding made from polygon strips with an open semicircular wheel cutout.
    xs=[-2.26,-1.94,-1.83,-1.60,-1.40,-1.20,-.97,-.86,.87,.98,1.20,1.4,1.6,1.82,1.93,2.27]
    zs=[.48,.48,.67,.91,.98,.91,.67,.48,.48,.67,.91,.98,.91,.67,.48,.48]
    verts=[v(x,s*.923,z) for x,z in zip(xs,zs)]+[v(x,s*.923,1.16) for x in xs]
    n=len(xs);mesh('wheel arch side panel',verts,[(i,i+1,n+i+1,n+i) for i in range(n-1)],'picketWhite')
    for wx in (-1.4,1.4):
        pts=[v(wx+.55*math.cos(math.pi*i/14),s*.951,.43+.55*math.sin(math.pi*i/14)) for i in range(15)]
        path('wheel arch lip',pts,.037,'picketWhite',8)
    box('orange camper stripe',v(-.35,s*.946,1.18),(3.78,.031,.20),'woodWarm',.008)
    box('lower sill',v(-.1,s*.946,.50),(1.59,.05,.075),'asphalt',.01)
    box('window outer frame',v(-.67,s*.95,1.83),(1.58,.055,.67),'uiDark',.045)
    box('window inner gasket',v(-.67,s*.985,1.83),(1.46,.021,.56),'woodWarm',.028)
    box('camper side glass',v(-.67,s*1.005,1.83),(1.38,.017,.49),'asphalt',.028)
    box('window divider',v(-.53,s*1.022,1.83),(.045,.018,.54),'uiDark',.006)
    box('rear side window frame',v(-1.83,s*.952,1.82),(.47,.055,.68),'uiDark',.03)
    box('rear side glass',v(-1.83,s*.987,1.82),(.37,.025,.55),'asphalt',.025)
    # Cab door lives outside body, independently pivoted at the forward hinge.
    before=set(bpy.data.objects)
    box('camper cab door',v(.98,s*.969,1.30),(.87,.05,1.36),'picketWhite',.02)
    box('door stripe',v(.98,s*1.002,1.18),(.82,.020,.20),'woodWarm',.006)
    box('door window gasket',v(1.02,s*1.005,1.80),(.65,.03,.57),'uiDark',.025)
    box('door window glass',v(1.02,s*1.025,1.80),(.53,.016,.46),'uiDark',.018)
    box('door handle',v(.71,s*1.041,1.42),(.15,.027,.042),'uiDark',.008)
    parts=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    # Material batches within each animated door retain one hinge parent.
    pivot_group('door_L' if s==1 else 'door_R',parts,v(1.43,s*.95,1.30))
    cyl('mirror stalk',v(1.46,s*.97,1.55),v(1.52,s*1.17,1.65),.024,'uiDark',8)
    box('wing mirror',v(1.52,s*1.23,1.67),(.17,.12,.27),'uiDark',.025)
    box('mirror face',v(1.617,s*1.23,1.67),(.014,.084,.20),'sidewalk',.012)
    for wx,tag in ((1.4,'F'),(-1.4,'R')):
        before=set(bpy.data.objects)
        center=v(wx,s*.88,.43)
        cyl('tyre',v(wx,s*.77,.43),v(wx,s*1.03,.43),.43,'uiDark',24)
        cyl('tyre sidewall',v(wx,s*1.032,.43),v(wx,s*1.052,.43),.35,'asphalt',24)
        cyl('wheel rim',v(wx,s*1.055,.43),v(wx,s*1.069,.43),.25,'sidewalk',20)
        cyl('wheel dish',v(wx,s*1.075,.43),v(wx,s*1.084,.43),.17,'sidewalk',16)
        cyl('hub cap',v(wx,s*1.085,.43),v(wx,s*1.102,.43),.10,'asphalt',16)
        for j in range(12):
            a=j*math.tau/12;o=box('tread block',v(wx+.424*math.sin(a),s*.90,.43+.424*math.cos(a)),(.08,.245,.025),'uiDark',.005);o.rotation_euler.y=a
        for j in range(5):
            a=j*math.tau/5;cyl('wheel stud',v(wx+.13*math.cos(a),s*1.09,.43+.13*math.sin(a)),v(wx+.13*math.cos(a),s*1.102,.43+.13*math.sin(a)),.019,'uiDark',8)
        pivot_group('wheel'+tag+('L' if s==1 else 'R'),[o for o in bpy.data.objects if o not in before and o.type=='MESH'],center)
# Front windscreen sits 12 mm above sloping cab skin.
wind=box('windscreen gasket',v(1.995,0,1.71),(.066,1.64,.99),'uiDark',.045);wind.rotation_euler.y=-.49
wind=box('windscreen glass',v(2.034,0,1.726),(.022,1.49,.86),'backpackTeal',.045);wind.rotation_euler.y=-.49
for y in (-.46,.36):
    cyl('wiper',v(2.225,y,1.32),v(2.233,y+.29,1.39),.018,'uiDark',8)
box('front fascia',v(2.29,0,.92),(.10,1.76,.48),'woodWarm',.025)
box('grille recess',v(2.352,0,.93),(.026,1.03,.32),'uiDark',.014)
for z in (.83,.91,.99,1.07):box('grille bar',v(2.377,0,z),(.025,1.03,.025),'sidewalk',.006)
for s in (-1,1):
    housing=box('headlamp bezel',v(2.358,s*.66,.94),(.073,.29,.31),'schoolBusYellow',.025)
    lamp=box('headlamp_'+str(s),v(2.407,s*.66,.94),(.030,.21,.23),'windowGlow',.033,True)
    keep.append(lamp);light('camper_head_'+str(s),v(2.42,s*.66,.94),[lamp.name])
    box('rear lamp gasket',v(-2.285,s*.76,1.15),(.045,.19,.40),'uiDark',.018)
    box('rear brake lamp',v(-2.315,s*.76,1.22),(.020,.14,.20),'survivorRed',.012)
    box('rear indicator',v(-2.316,s*.76,1.04),(.020,.14,.10),'schoolBusYellow',.008)
for x in (2.37,-2.33):
    box('bumper',v(x,0,.50),(.21,2.0,.20),'sidewalk',.045)
    for y in (-.73,.73):box('bumper inset',v(x+(.111 if x>0 else -.111),y,.50),(.024,.21,.10),'uiDark',.013)
box('fictional blank plate',v(2.489,0,.48),(.026,.40,.15),'picketWhite',.012)
# A small, unbranded raised badge instead of texture lettering.
box('camper badge',v(2.354,0,1.18),(.020,.18,.035),'sidewalk',.006)
col=empty('col:camper',v(0,0,1.15));col['collider']='cuboid';col['size']=[4.6,1.9,2.3]
empty('driverSeat',v(1.15,.48,1.2));empty('exitL',v(1.1,1.6,0));empty('exitR',v(1.1,-1.6,0))

# Join per material and per animated parent. This keeps the entire kit <40 draws.
parents=[root]+[o for o in keep if o.type=='EMPTY']
for parent in parents:
    for m in list(materials.values()):
        obs=[o for o in list(bpy.data.objects) if o.type=='MESH' and o.parent==parent and o.data.materials[0]==m and (parent!=root or o not in keep)]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join()
        obs[0].name=('static_' if parent==root else parent.name+'_')+m.name
        # Animation pivots are on the parent; all static origins sit on the root.
        bpy.context.scene.cursor.location=parent.matrix_world.translation
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
# Lamp anchor references follow the final material batch names.
for o in bpy.data.objects:
    if 'ss_light' not in o:continue
    data=json.loads(o['ss_light'])
    if o.name.startswith('light:string_'):
        i=o.name.rsplit('_',1)[1];data['emissiveNodes']=['lamp_'+i+'_emi_windowGlow']
    elif o.name=='light:campfire':data['emissiveNodes']=['campfire_flames_emi_schoolBusYellow','campfire_flames_emi_windowGlow']
    o['ss_light']=json.dumps(data)
def clean_mesh(o, weld=False):
    bm=bmesh.new();bm.from_mesh(o.data)
    if weld:bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-10],context='FACES')
    bm.to_mesh(o.data);bm.free()

meshes=[o for o in bpy.data.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
for o in meshes:clean_mesh(o,weld=True)
bpy.context.view_layer.update()
pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
shift=Vector((-(min(p.x for p in pts)+max(p.x for p in pts))/2,-(min(p.y for p in pts)+max(p.y for p in pts))/2,-min(p.z for p in pts)))
for o in root.children:o.location+=shift
bpy.context.view_layer.update()
def bake_ao(meshes):
    # 32 deterministic hemisphere visibility rays per vertex: runtime AO color attribute.
    vs=[];fs=[]
    for o in meshes:
        offset=len(vs);vs.extend(o.matrix_world@v.co for v in o.data.vertices)
        fs.extend(tuple(offset+i for i in p.vertices) for p in o.data.polygons)
    bvh=BVHTree.FromPolygons(vs,fs)
    for o in meshes:
        ao=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER');values=[]
        for vtx in o.data.vertices:
            normal=(o.matrix_world.to_3x3()@vtx.normal).normalized()
            u=normal.cross(Vector((0,0,1)) if abs(normal.z)<.95 else Vector((1,0,0))).normalized();v=normal.cross(u)
            origin=o.matrix_world@vtx.co+normal*.008;blocked=0
            for j in range(32):
                z=(j+.5)/32;r=math.sqrt(1-z*z);t=j*2.39996323
                blocked+=bvh.ray_cast(origin,u*(r*math.cos(t))+v*(r*math.sin(t))+normal*z,.55)[0] is not None
            values.append(1-.55*blocked/32)
        for loop in o.data.loops:
            shade=values[loop.vertex_index];ao.data[loop.index].color=(shade,shade,shade,1)

bake_ao(meshes)

def counts():
    return sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),sum(len(o.data.materials) for o in meshes)
triangles,draws=counts()
report={'id':'kit.campground','tier':'Hero','triangles':triangles,'draw_calls':draws,'materials':sorted(materials),'nodes_ok':all(bpy.data.objects.get(n) for n in ('root','wheelFL','wheelFR','wheelRL','wheelRR','door_L','door_R')),'within_budget':triangles<=25000 and draws<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
def export(path, selected_meshes=None):
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in bpy.data.objects:
        if o.type=='EMPTY' or (o.type=='MESH' and o in (selected_meshes if selected_meshes is not None else meshes)):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_lights=False,export_cameras=False,export_vertex_color='NAME',export_vertex_color_name='ao')
def build_distant():
    original=[o for o in bpy.data.objects if o.type=='MESH']
    names={o:o.name for o in original}
    for o in original:o.name='archive_'+o.name
    before=set(bpy.data.objects)
    attached={}
    def attach(o,parent):attached[o]=bpy.data.objects[parent];return o
    def octa(name,loc,size,token,emit=False):
        x,y,z=loc;a,b,c=size
        return mesh(name,[(x+a,y,z),(x-a,y,z),(x,y+b,z),(x,y-b,z),(x,y,z+c),(x,y,z-c)],[(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)],token,emit=emit)
    # Fabric needs very few faces; explicit open entrances survive at every distance.
    for cx,cy,color,index in [(-1.65,-2.45,'schoolBusYellow',1),(-1.65,1.45,'survivorRed',2)]:
        rings=[(1.38,1.28,.08),(.88,.83,1.55),(.13,.13,2.14)]
        corners=[(1,-1),(1,1),(-1,1),(-1,-1)]
        for j in range(2):
            xa,ya,za=rings[j];xb,yb,zb=rings[j+1]
            for k in (1,2,3):
                a,b=corners[k],corners[(k+1)%4]
                verts=[(cx+xa*a[0],cy+ya*a[1],za),(cx+xa*b[0],cy+ya*b[1],za),(cx+xb*b[0],cy+yb*b[1],zb),(cx+xb*a[0],cy+yb*a[1],zb)]
                mesh('distant tent fly',verts,[(0,1,2,3)],'picketWhite' if index==2 and j==0 else color)
        levels=[(.08,.54),(1.10,.50),(1.40,.30),(1.50,0),(1.55,0),(2.14,0)]
        def profile(z):
            a,b=rings[:2] if z<=1.55 else rings[1:]
            t=(z-a[2])/(b[2]-a[2]);return a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t
        for sign in (-1,1):
            arc=[]
            for z,w in levels[:4]:arc.append((cx+profile(z)[0]+.012,cy+sign*w,z))
            path('distant entrance trim',arc,.026,'sidewalk',3)
            for i in range(len(levels)-1):
                za,wa=levels[i];zb,wb=levels[i+1];xa,ya=profile(za);xb,yb=profile(zb)
                mesh('distant entrance',[(cx+xa,cy+sign*wa,za),(cx+xa,cy+sign*ya,za),(cx+xb,cy+sign*yb,zb),(cx+xb,cy+sign*wb,zb)],[(0,1,2,3)],'asphalt' if index==2 and za<1.55 else color)
        box('distant tent floor',(cx,cy,.05),(2.70,2.48,.10),'uiDark',0)
        mesh('distant tent peak',[(cx+x,cy+y,2.168) for x,y in [(-.15,-.14),(.15,-.14),(.15,.14),(-.15,.14)]],[(0,1,2,3)],color)
    # Solid camper hull with a sloping front, bold windows and independent wheels.
    profile=[(-2.26,.55),(2.28,.55),(2.28,1.05),(1.64,2.31),(-2.26,2.31)]
    vertices=[v(x,y,z) for y in (-.92,.92) for x,z in profile]
    mesh('distant camper hull',vertices,[tuple(range(4,-1,-1)),tuple(range(5,10))]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)],'picketWhite')
    box('distant roof',v(-.23,0,2.32),(4.25,1.96,.20),'picketWhite',0)
    for x in (-1.05,.36):box('distant roof vent',v(x,0,2.48),(.65,.62,.12),'asphalt',0)
    for s in (-1,1):
        for x,width in [(-.8575,2.765),(1.8275,.785)]:
            box('distant orange stripe',v(x,s*.96,1.17),(width,.035,.20),'woodWarm',0)
        for x,width in [(-.67,1.50),(-1.83,.40)]:
            box('distant side glass',v(x,s*.976,1.815),(width,.045,.57),'asphalt',0)
        leaf=box('distant door',v(.98,s*.958,1.32),(.87,.04,1.31),'picketWhite',0)
        attach(leaf,'door_L' if s==1 else 'door_R')
        glass=box('distant door glass',v(1.015,s*1.016,1.805),(.63,.035,.49),'uiDark',0)
        attach(glass,'door_L' if s==1 else 'door_R')
        attach(box('distant door stripe',v(.98,s*1.014,1.17),(.83,.035,.20),'woodWarm',0),'door_L' if s==1 else 'door_R')
        for x,tag in [(1.4,'F'),(-1.4,'R')]:
            parent='wheel'+tag+('L' if s==1 else 'R')
            attach(cyl('distant tyre',v(x,s*.77,.43),v(x,s*1.03,.43),.43,'uiDark',6),parent)
            rim=mesh('distant rim',[v(x+.23*math.cos(j*math.tau/6),s*1.039,.43+.23*math.sin(j*math.tau/6)) for j in range(6)],[tuple(range(6))],'sidewalk')
            attach(rim,parent)
        head=mesh('headlamp_'+str(s),[v(2.409,y,z) for y,z in [(s*.66-.105,.825),(s*.66+.105,.825),(s*.66+.105,1.055),(s*.66-.105,1.055)]],[(0,1,2,3)],'windowGlow',emit=True)
    mesh('distant windscreen',[v(x,y,z) for x,y,z in [(2.252,-.76,1.32),(2.252,.76,1.32),(1.824,.76,2.11),(1.824,-.76,2.11)]],[(0,1,2,3)],'backpackTeal')
    box('distant bumper',v(2.38,0,.5),(.19,2.0,.19),'sidewalk',0)
    box('distant grille',v(2.386,0,.94),(.025,1.00,.30),'uiDark',0)
    # Table uses broad continuous surfaces and full A-frame legs, never decimated shards.
    tx,ty=2.0,-.4
    box('distant tabletop',(tx,ty,.89),(2.15,.96,.12),'woodWarm',0)
    for s in (-1,1):box('distant bench',(tx,ty+s*.83,.48),(2.30,.40,.105),'woodWarm',0)
    for x in (tx-.75,tx+.75):
        box('distant bench beam',(x,ty,.37),(.16,2.07,.13),'woodWarm',0)
        for s in (-1,1):
            a=Vector((x,ty+s*.85,.06));b=Vector((x,ty+s*.35,.81));d=b-a
            leg=box('distant table leg',(a+b)/2,(.15,.15,d.length),'woodWarm',0);leg.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    fx,fy=2.2,-3.25
    mesh('distant ash',[(fx+.73*math.cos(i*math.tau/8),fy+.73*math.sin(i*math.tau/8),.085) for i in range(8)],[tuple(range(8))],'uiDark')
    for i in range(8):
        a=i*math.tau/8;octa('distant ring stone',(fx+.82*math.cos(a),fy+.82*math.sin(a),.20),(.25,.24,.21),'sidewalk')
    for i in range(3):
        a=i*math.tau/3;cyl('distant fire log',(fx+.52*math.cos(a),fy+.52*math.sin(a),.14),(fx,fy,.64),.095,'woodWarm',5)
    attach(flame('campfire_flames_emi_schoolBusYellow',fx,fy,.96,.25,'schoolBusYellow'),'campfire_flames')
    attach(octa('campfire_flames_emi_windowGlow',(fx+.12,fy,.64),(.13,.13,.43),'windowGlow',True),'campfire_flames')
    for y in (-4.4,3.4):box('distant light post',(-3.8,y,1.7),(.19,.19,3.4),'woodWarm',0)
    path('distant sagging cable',[(-3.8,-4.4+7.8*i/4,3.2-.6*math.sin(math.pi*i/4)) for i in range(5)],.019,'woodWarm',3)
    for i in range(5):
        y=-3.8+i*1.65;t=(y+4.4)/7.8;z=3.2-.6*math.sin(math.pi*t)
        attach(octa('lamp_'+str(i)+'_emi_windowGlow',(-3.8,y,z-.25),(.095,.095,.12),'windowGlow',True),'lamp_'+str(i))
    low=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    for o in low:o.location+=shift
    bpy.context.view_layer.update()
    for o,parent in attached.items():
        world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
    preserved=[o for o in low if o.data.materials[0].name.startswith('emi_')]
    for parent in {o.parent for o in low}:
        for mat in materials.values():
            objects=[o for o in low if o.parent==parent and o not in preserved and o.data.materials[0]==mat]
            if not objects:continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects:o.select_set(True)
            bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
            objects[0].name=('static_' if parent==root else parent.name+'_')+mat.name
            low=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    low=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in low:o.select_set(True)
    bpy.context.view_layer.objects.active=low[0];bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    for o in low:clean_mesh(o,weld=True)
    bake_ao(low)
    export(HERE/'model.lod2.glb',low)
    for o in low:bpy.data.objects.remove(o,do_unlink=True)
    for o,name in names.items():o.name=name

if args.glb:
    export(args.glb)
    originals={o:o.data for o in meshes}
    level,ratio=1,.15
    for o in meshes:
        o.data=originals[o].copy();bpy.context.view_layer.objects.active=o
        bm=bmesh.new();bm.from_mesh(o.data)
        visited=set();discard=[]
        for start in bm.verts:
            if start in visited: continue
            island=[];stack=[start];visited.add(start)
            while stack:
                vtx=stack.pop();island.append(vtx)
                for edge in vtx.link_edges:
                    other=edge.other_vert(vtx)
                    if other not in visited:visited.add(other);stack.append(other)
            size=[max(v.co[k] for v in island)-min(v.co[k] for v in island) for k in range(3)]
            tiny=max(size)<.13
            thin=min(size)<.009
            if not o.data.materials[0].name.startswith('emi_') and (tiny or thin):discard.extend(island)
        bmesh.ops.delete(bm,geom=discard,context='VERTS');bm.to_mesh(o.data);bm.free()
        # Canvas is already sparse; retaining its palette batch prevents holes in the dome.
        m=o.modifiers.new('LOD silhouette reduction','DECIMATE')
        m.ratio=1.0 if o.name=='static_pal_schoolBusYellow' else ratio
        bpy.ops.object.modifier_apply(modifier=m.name)
        clean_mesh(o)
    export(HERE/f'model.lod{level}.glb')
    for o,d in originals.items():o.data=d
    build_distant()
    data=Path(args.glb).read_bytes();length=struct.unpack_from('<I',data,12)[0]
    gltf=json.loads(data[20:20+length])
    report['triangles']=sum(gltf['accessors'][p['indices']]['count']//3 for mesh in gltf['meshes'] for p in mesh['primitives'])
    report['draw_calls']=sum(len(mesh['primitives']) for mesh in gltf['meshes'])
    report['within_budget']=report['triangles']<=25000 and report['draw_calls']<=40
HERE.joinpath('report.json').write_text(json.dumps(report,indent=2)+'\n')
if args.render:
    stage=bpy.data.materials.new('stage');stage.use_nodes=True
    stage.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.025,.023,.032,1)
    stage.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));bpy.context.object.data.materials.append(stage)
    scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.seed=26;scene.cycles.use_denoising=True
    scene.world.color=(.22,.22,.22)
    target=Vector((0,0,1.15))
    for loc,power,color,size in [((3,-4,9),2000,(1,.77,.51),7),((-5,3,7),1500,(.60,.68,1),6),((0,6,8),1700,(1,.66,.37),5)]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    for anchor in [o for o in bpy.data.objects if 'ss_light' in o]:
        data=json.loads(anchor['ss_light'])
        bpy.ops.object.light_add(type='POINT',location=anchor.matrix_world.translation)
        lamp=bpy.context.object;lamp.data.energy=75 if data['type']=='fire' else 15
        lamp.data.color=(1,.48,.12);lamp.data.shadow_soft_size=.35
    bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';scene.camera=camera
    def set_view(view):
        direction=Vector({'ref':(12,-16,12),'game':(12,-12,17),'front':(18,0,7),'side':(0,-18,7),'rear':(-18,0,7)}.get(view,(12,-16,12)))
        camera.location=target+direction;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=20.2 if view=='game' else 17.5
    set_view(args.view)
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(Path(args.render).resolve());Path(args.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    if Path(args.render).name=='hero.png':
        set_view('game');scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(HERE/'renders/game.png');bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
