"""Sunset Grove freight: deterministic geometry, +X forward, metres, Z-up.
Run via experiment/tools/blender_run.py. Static geometry joins by palette;
wheels, hinged cab doors, sliding boxcar doors and lamp assemblies retain pivots.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.distance import tier_argument, export_variant, build_native_lods
DISTANCE = tier_argument()
if '--lod-only' in sys.argv:
    build_native_lods(__file__)
    sys.exit(0)

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
p.add_argument('--glb')
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
rng = random.Random(29)
parts = []; groups = {}

def color(h):
    vals = [int(h[i:i+2], 16)/255 for i in (0,2,4)]
    return [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in vals]+[1]

def mat(token, h, rough=.5, metal=0, emission=0):
    m = bpy.data.materials.new(('emi_' if emission else 'pal_')+token)
    m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=color(h)
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    if emission:
        bs.inputs['Emission Color'].default_value=color(h)
        bs.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=color(h)
    return m
M = {'slate':mat('asphalt','5b4f5c',.51,.25), 'dark':mat('uiDark','25222c',.6,.25),
     'red':mat('survivorRed','db442f',.44), 'car':mat('brick','b9402d',.54),
     'yellow':mat('schoolBusYellow','f2b630',.37,.12), 'rust':mat('woodWarm','b0703f',.84),
     'steel':mat('sidewalk','b9a4a0',.38,.65), 'cream':mat('picketWhite','f2e6dc',.65),
     'head':mat('windowGlow','ffc773',.22,0,3), 'brake':mat('sirenRed','ff2d2d',.3,0,1.2)}

def empty(name,pos=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o)
    o.parent=parent; o.location=pos; return o
root=empty('veh.train-freight')
root['ss_physics']=json.dumps({'class':'heavy','mass':98000,'friction':.8,'restitution':.02,'pushable':False,'kickable':False,'flammable':True})
groups['body']=empty('body',parent=root)

def motion(name,pos):
    groups[name]=empty(name,pos,root); groups[name]['animated']=True
    return groups[name]

def finish(o,name,key,group='body',bevel=0):
    if DISTANCE: bevel = 0
    # Motion groups use a compact palette to keep the full consist at 40 calls.
    if group in ('doorL','doorR') and key in ('slate','steel'): key='dark'
    if group.startswith('boxcarDoor') and key=='steel': key='dark'
    o.name=name; o.data.materials.append(M[key])
    if bevel:
        mod=o.modifiers.new('soft bevel','BEVEL'); mod.width=bevel; mod.segments=2 if bevel>=.04 else 1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update()
    world=o.matrix_world.copy(); o.parent=groups[group]; o.matrix_world=world
    parts.append(o); return o

def box(name,pos,size,key='slate',bevel=.025,group='body'):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,key,group,bevel)

def mesh(name,verts,faces,key,group='body',bevel=0):
    d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update()
    bm=bmesh.new(); bm.from_mesh(d); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(d); bm.free()
    o=bpy.data.objects.new(name,d); scene.collection.objects.link(o)
    return finish(o,name,key,group,bevel)

def side(name,points,y,depth,key,group='body',bevel=.012):
    n=len(points); vs=[(x,y+off,z) for off in (-depth/2,depth/2) for x,z in points]
    fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,key,group,bevel)

def cyl(name,pos,r,depth,key='slate',axis='Y',group='body',n=32,bevel=.009):
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=pos)
    o=bpy.context.object
    o.rotation_euler=(math.pi/2,0,0) if axis=='Y' else (0,math.pi/2,0) if axis=='X' else (0,0,0)
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,name,key,group,bevel)

def rod(name,start,end,r=.03,key='yellow',group='body'):
    segments = (6 if DISTANCE == 1 else 4) if DISTANCE else 12
    start,end=Vector(start),Vector(end)
    o=cyl(name,(start+end)/2,r,(end-start).length,key,'Z',group,segments,0)
    o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler(); return o

def ring(name,pos,profile,key='slate',group='body',axis='Y',n=48):
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 6)
    x,y,z=pos; vs=[]
    for radius,off in profile:
        for i in range(n):
            t=math.tau*i/n
            vs.append((x+radius*math.sin(t),y+off,z+radius*math.cos(t)) if axis=='Y' else (x+radius*math.sin(t),y+radius*math.cos(t),z+off))
    fs=[(j*n+i,j*n+(i+1)%n,((j+1)%len(profile))*n+(i+1)%n,((j+1)%len(profile))*n+i) for j in range(len(profile)) for i in range(n)]
    o=mesh(name,vs,fs,key,group)
    for f in o.data.polygons: f.use_smooth=True
    return o

# Long locomotive at +X, one boxcar trailing at -X; no tracks baked into the asset.
box('locomotive sill',(5.95,0,1.2),(12.5,3.12,.3),'dark',.065)
box('boxcar chassis',(-6.3,0,1.15),(10.6,2.98,.32),'dark',.045)
for y in (-1.55,1.55):
    box('yellow walkway edge',(5.94,y,1.4),(12.45,.13,.25),'yellow',.025)
    box('anti-slip walkway',(5.94,y*.83,1.56),(12.4,.53,.075),'slate',.012)
    box('boxcar lower rail',(-6.3,y*.955,1.48),(10.7,.14,.2),'car',.024)
# Tank hangs between the locomotive trucks, with bands, plumbing and fill cap.
box('rounded fuel tank',(5.5,0,.72),(4.6,2.32,.85),'slate',.18)
for x in (3.62,5.5,7.35):
    for y in (-1.17,1.17): box('fuel retaining strap',(x,y,.74),(.075,.04,.67),'dark',.015)
    box('tank strap bottom',(x,0,.313),(.075,2.34,.04),'dark',.008)
for y in (-1.28,1.28):
    cyl('fuel pipe',(5.4,y,1.11),.085,4.8,'dark','X')
    cyl('filler',(6.5,y,1.18),.1,.16,'steel','Z')
# Two trucks per vehicle, each with two independently rotating wheelsets.
axles=[1.05,2.85,8.6,10.4,-10.05,-8.5,-4.1,-2.55]
for j,x in enumerate(axles):
    cyl('axle',(x,0,.58),.12,2.94,'dark')
    for s in (-1,1):
        if j==3: g='wheelFL' if s==1 else 'wheelFR'
        elif j==0: g='wheelRL' if s==1 else 'wheelRR'
        else: g=f'wheel{j}'+('L' if s==1 else 'R')
        motion(g,(x,s*1.27,.58))
        ring('rail wheel',(x,s*1.27,.58),[(.29,-.16),(.52,-.16),(.58,-.125),(.58,-.08),(.52,-.045),(.52,.12),(.48,.16),(.28,.16)],'slate',g)
        cyl('wheel dish',(x,s*1.435,.58),.36,.065,'slate',group=g,n=48)
        ring('rolled rim',(x,s*1.485,.58),[(.37,0),(.41,0),(.42,s*.02),(.38,s*.025)],'slate',g)
        cyl('hub',(x,s*1.51,.58),.145,.13,'slate',group=g,n=32)
        for k in range(6):
            t=math.tau*k/6
            cyl('hub bolts',(x+.22*math.cos(t),s*1.49,.58+.22*math.sin(t)),.025,.035,'slate',group=g,n=6,bevel=0)
for x in (1.95,9.5,-9.275,-3.325):
    box('bogie bolster',(x,0,.92),(2.72,2.42,.28),'dark',.065)
    for s in (-1,1):
        # Side frame is open below the top beam, allowing wheel silhouette to show.
        side('cast truck frame',[(x-1.31,1.07),(x+1.31,1.07),(x+1.13,.73),(x+.48,.69),(x+.28,.46),(x-.28,.46),(x-.48,.69),(x-1.13,.73)],s*1.57,.16,'slate',bevel=.04)
        box('spring pocket',(x,s*1.66,.84),(.62,.03,.3),'dark',.025)
        for dx in (-.21,0,.21):
            cyl('spring core',(x+dx,s*1.68,.83),.06,.32,'dark','Z',n=16)
            for z in (.7,.76,.82,.88,.94): cyl('spring coil',(x+dx,s*1.68,z),.084,.022,'steel','Z',n=12,bevel=0)
        for dx in (-.91,.91):
            cyl('bearing box',(x+dx,s*1.71,.75),.15,.13,'dark')
            cyl('bearing lid',(x+dx,s*1.8,.75),.1,.05,'steel',n=24)
        box('truck step',(x,s*1.75,.55),(.53,.38,.085),'steel',.018)
        rod('brake link',(x-.83,s*1.75,.48),(x+.83,s*1.75,.48),.035,'dark')
# Hood slab with individual access panels and proud horizontal bands.
box('engine hood',(4.48,0,2.82),(8.52,2.42,2.54),'slate',.085)
box('long hood roof',(4.5,0,4.13),(8.6,2.5,.16),'slate',.06)
for s in (-1,1):
    for i in range(10):
        x=.58+i*.805
        box('engine access panel',(x,s*1.23,2.61),(.78,.046,1.98),'slate',.023)
        box('lower red stripe',(x,s*1.265,2.08),(.793,.045,.58),'red',.009)
        box('gold body stripe',(x,s*1.293,2.61),(.793,.055,.5),'yellow',.009)
        box('upper red stripe',(x,s*1.265,3.07),(.793,.045,.42),'red',.009)
        box('panel handle',(x+.22,s*1.319,3.4),(.10,.04,.036),'dark',.008)
        for z in (1.77,3.64):
            cyl('panel rivet',(x-.28,s*1.299,z),.022,.02,'steel',n=8,bevel=0)
    # Raised ventilation boxes and slats, not flat texture decals.
    for x,w in [(1.35,2.6),(4.23,.9),(6.78,1.1)]:
        box('vent housing',(x,s*1.273,3.66),(w,.12,.66),'steel',.025)
        box('vent darkness',(x,s*1.348,3.66),(w-.10,.04,.56),'dark',.018)
        count=int(w/.105)
        for i in range(count): box('vent vertical fin',(x-w/2+.1+i*(w-.2)/max(1,count-1),s*1.38,3.66),(.025,.04,.54),'slate',.004)
# Four top cooling fans with raised rims, grille bars and radial blades.
for x,r in [(1.25,.62),(2.68,.62),(5.88,.58),(7.15,.58)]:
    cyl('fan base',(x,0,4.26),r+.06,.13,'slate','Z',n=48)
    cyl('fan opening',(x,0,4.34),r-.07,.025,'dark','Z',n=48,bevel=0)
    ring('fan rim',(x,0,4.32),[(r-.055,0),(r+.02,0),(r+.02,.12),(r-.055,.12)],'steel',axis='Z',n=48)
    cyl('fan hub',(x,0,4.39),.13,.045,'slate','Z')
    for k in range(8):
        t=math.tau*k/8
        rod('fan grille',(x+.15*math.cos(t),.15*math.sin(t),4.41),(x+(r-.04)*math.cos(t),(r-.04)*math.sin(t),4.41),.016,'slate')
    for off in (-.28,-.14,0,.14,.28):
        length=math.sqrt(max(.01,(r-.09)**2-off**2))
        rod('fan screen',(x-length,off,4.425),(x+length,off,4.425),.009,'dark')
box('exhaust base',(4.58,0,4.29),(.68,.53,.22),'dark',.04)
cyl('exhaust stack',(4.58,0,4.45),.19,.22,'slate','Z')
cyl('exhaust hollow',(4.58,0,4.568),.146,.018,'dark','Z',bevel=0)
# Tall full-width cab, short yellow nose, trapezoid cap.
box('cab lower',(8.55,0,2.57),(2.05,3.0,2.06),'red',.075)
box('cab yellow belt',(8.55,0,2.63),(2.066,3.032,.48),'yellow',.018)
box('cab upper',(8.55,0,3.78),(2.05,3.0,1.35),'slate',.05)
mesh('cab crowned roof',[(7.44,-1.58,4.37),(9.67,-1.58,4.37),(9.67,1.58,4.37),(7.44,1.58,4.37),(7.62,-1.20,4.62),(9.5,-1.20,4.62),(9.5,1.20,4.62),(7.62,1.20,4.62)],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'slate',bevel=.045)
box('short nose',(10.42,0,2.28),(1.68,2.25,1.37),'yellow',.105)
box('nose red cap',(10.42,0,2.91),(1.69,2.25,.16),'red',.045)
for s in (-1,1):
    g='doorL' if s==1 else 'doorR'; motion(g,(8.03,s*1.53,2.6))
    box('cab door seal',(8.4,s*1.52,3.02),(.87,.036,2.19),'dark',.034)
    box('cab door',(8.4,s*1.557,3.01),(.80,.042,2.12),'slate',.027,g)
    box('door lower paint',(8.4,s*1.59,2.52),(.80,.025,1.12),'red',.015,g)
    box('door belt',(8.4,s*1.617,2.63),(.80,.023,.47),'yellow',.005,g)
    box('door window rim',(8.4,s*1.602,3.62),(.65,.04,.89),'steel',.025,g)
    box('door glass',(8.4,s*1.635,3.62),(.53,.025,.77),'dark',.027,g)
    box('window shade',(8.4,s*1.68,4.105),(.77,.27,.06),'slate',.018)
    rod('door grab',(8.7,s*1.663,2.79),(8.7,s*1.663,3.01),.028,'steel',g)
    box('side windshield seal',(9.13,s*1.531,3.79),(.42,.03,.69),'dark',.035)
    box('side windshield',(9.13,s*1.556,3.79),(.32,.02,.57),'slate',.025)
for s in (-1,1):
    box('front windscreen rim',(9.598,s*.83,3.89),(.04,1.16,.79),'dark',.04)
    box('front windscreen',(9.632,s*.83,3.89),(.025,1.04,.67),'slate',.025)
    rod('wiper',(9.658,s*.50,3.56),(9.658,s*1.08,3.78),.016,'dark')
box('roof equipment',(8.2,0,4.7),(.85,.71,.16),'steel',.03)
for y in (-.35,.35):
    cyl('horn bell',(9.02,y,4.67),.115,.27,'slate','X')
    cyl('horn mouth',(9.165,y,4.67),.095,.014,'dark','X',bevel=0)
# Front deck handrails and side running rails. Continuous bends use connected rods.
for s in (-1,1):
    for x in (.0,1.1,2.3,3.5,4.7,5.9,7.1,9.55,11.7):
        rod('safety stanchion',(x,s*1.55,1.55),(x,s*1.55,2.67),.035,'yellow')
        box('rail foot',(x,s*1.55,1.6),(.13,.14,.12),'dark',.012)
    points=[(.0,s*1.55,2.67),(7.1,s*1.55,2.67),(7.52,s*1.55,2.99)]
    for u,v in zip(points,points[1:]): rod('side safety rail',u,v,.038)
    rod('nose rail',(9.55,s*1.55,2.67),(11.7,s*1.55,2.67),.038)
    for x in (.0,11.7):
        for y in (s*1.56,s*1.02): rod('step upright',(x,y,.20),(x,y,2.68),.035)
        for z in (.24,.57,.90,1.22): box('access tread',(x,s*1.28,z),(.48,.63,.075),'steel',.012)
        rod('end rail',(x,s*1.56,2.68),(x,s*.95,2.68),.038)
        rod('rail down',(x,s*.95,2.68),(x,s*.88,1.61),.038)
rod('front rail',(11.75,-.91,2.7),(11.75,.91,2.7),.04)
# Front plow: sloped cheeks and angular central cut for coupler.
mesh('snow plow',[(12.14,-1.63,.15),(12.14,1.63,.15),(11.90,1.52,.89),(11.90,-1.52,.89),(12.26,-1.52,.12),(12.26,1.52,.12),(12.04,1.45,.89),(12.04,-1.45,.89)],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'slate',bevel=.025)
for y in (-1.03,-.48,.48,1.03): rod('plow rib',(12.14,y,.17),(11.96,y,.83),.023,'dark')
for x in (12.11,-.4,-1.0,-11.92):
    box('coupler shaft',(x,0,.96),(.64,.20,.21),'dark',.04)
    box('coupler knuckle',(x+.25,0,.96),(.26,.42,.32),'slate',.055)
    box('knuckle slot',(x+.39,0,.96),(.016,.17,.13),'dark',.015)
rod('brake hose',(11.93,.34,.99),(12.12,.37,.52),.044,'dark')
# Front and rear light assemblies remain separately addressable.
motion('lightsFront',(11.34,0,2.65)); motion('lightsBrake',(-11.68,0,1.6))
for y,z in [(0,2.68),(0,2.30),(-1.25,1.72),(1.25,1.72)]:
    x=11.302 if y==0 else 11.85
    cyl('headlamp bezel',(x,y,z),.16,.075,'dark','X')
    cyl('headlamp lens',(x+.05,y,z),.116,.042,'head','X','lightsFront',n=40)
for y in (-.16,.16):
    cyl('cab lamp bezel',(9.66,y,4.27),.145,.1,'dark','X')
    cyl('cab lamp',(9.73,y,4.27),.105,.035,'head','X','lightsFront')
for s in (-1,1):
    cyl('ditch lamp',(11.9,s*1.31,2.06),.13,.06,'steel','X')
    cyl('ditch reflector',(11.947,s*1.31,2.06),.10,.018,'slate','X')
    box('red marker',(11.321,s*.72,2.78),(.03,.20,.095),'red',.018)
    box('rear brake',(-11.697,s*1.2,1.62),(.06,.20,.14),'brake',.018,'lightsBrake')
# Raised nose chevrons, front access panel and small service plates.
for s in (-1,1):
    mesh('nose red chevron',[(11.313,s*.10,2.66),(11.313,s*1.05,2.92),(11.313,s*1.05,2.80),(11.313,s*.10,2.57)],[(0,1,2,3)],'red')
    box('front service panel',(11.323,s*.64,2.19),(.026,.63,.72),'yellow',.025)
    for y in (s*.4,s*.88):
        for z in (1.91,2.47): cyl('nose bolt',(11.346,y,z),.024,.025,'steel','X',n=8,bevel=0)
    rod('front nose grab',(11.395,s*.87,1.91),(11.395,s*.87,2.51),.027,'yellow')
    for x in (9.95,10.78):
        box('nose service seam',(x,s*1.134,2.14),(.017,.024,.88),'rust',.003)
    for y in (s*.39,s*.88):
        rod('roof grab',(8.07,y,4.79),(8.57,y,4.79),.025,'yellow')
    box('cab sill trim',(8.56,s*1.518,1.76),(1.98,.037,.11),'yellow',.015)
    for x in (.37,7.54):
        box('maintenance plate',(x,s*1.302,1.97),(.24,.03,.26),'dark',.012)
        for z in (1.92,2.02): box('maintenance mark',(x,s*1.326,z),(.14,.012,.02),'cream',.003)
# Curved hanging coupler hoses with elbows.
for s in (-1,1):
    pts=[(12.18,s*.29,.99),(12.29,s*.35,.72),(12.19,s*.47,.47),(12.02,s*.51,.53),(11.98,s*.48,.74)]
    for u,v in zip(pts,pts[1:]): rod('coupler air hose',u,v,.045,'dark')

# Boxcar shell with chamfered roof and external ribs.
box('boxcar shell',(-6.3,0,2.92),(10.55,3.0,2.85),'car',.045)
mesh('boxcar pitched roof',[(-11.61,-1.55,4.28),(-.99,-1.55,4.28),(-.99,1.55,4.28),(-11.61,1.55,4.28),(-11.61,-1.12,4.57),(-.99,-1.12,4.57),(-.99,1.12,4.57),(-11.61,1.12,4.57)],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'car',bevel=.025)
for s in (-1,1):
    for x in (-11.56,-10.61,-9.65,-8.69,-7.75,-4.79,-3.83,-2.87,-1.91,-1.04):
        box('boxcar rib',(x,s*1.533,2.91),(.09,.105,2.78),'red',.018)
        for z in (1.6,4.25): cyl('rib rivet',(x,s*1.6,z),.023,.02,'dark',n=8,bevel=0)
    for z in (1.54,4.32): box('boxcar edge band',(-6.3,s*1.557,z),(10.64,.10,.14),'red',.018)
    # Sliding door origin at top roller; local X translates along tracks.
    g='boxcarDoor'+('L' if s==1 else 'R'); motion(g,(-7.61,s*1.65,4.13)); groups[g]['animation']='slideX'
    box('door recess',(-6.28,s*1.556,2.88),(2.77,.047,2.61),'dark',.022)
    box('boxcar sliding door',(-6.28,s*1.617,2.89),(2.55,.073,2.54),'car',.02,g)
    for z in [1.75+i*.185 for i in range(13)]: box('door corrugation',(-6.28,s*1.678,z),(2.43,.085,.074),'red',.015,g)
    for x in (-7.55,-5.01): box('door jamb',(x,s*1.705,2.89),(.11,.1,2.57),'dark',.02,g)
    for z in (1.55,4.24): box('sliding track',(-6.28,s*1.745,z),(3.03,.13,.095),'dark',.018)
    for x in (-7.35,-5.2):
        cyl('door roller',(x,s*1.753,4.23),.085,.035,'steel',group=g,n=24)
        box('door latch bracket',(x,s*1.77,2.08),(.18,.10,.24),'dark',.015,g)
    rod('door lever',(-7.18,s*1.807,2.06),(-7.18,s*1.807,2.43),.028,'steel',g)
    # Fictional abstract inspection placard; raised 13mm from skin.
    box('inspection placard',(-10.45,s*1.526,1.95),(.47,.026,.55),'cream',.012)
    box('placard inset',(-10.45,s*1.552,1.95),(.39,.02,.46),'car',.008)
    for z in (1.81,1.95,2.1): box('abstract placard marks',(-10.45,s*1.569,z),(.26,.01,.025),'cream',.003)
    for x in (-11.33,-1.26):
        for dx in (-.32,.32): rod('boxcar ladder',(x+dx,s*1.73,.7),(x+dx,s*1.73,2.93),.035)
        for z in [ .77+i*.34 for i in range(7)]: rod('ladder rung',(x-.32,s*1.73,z),(x+.32,s*1.73,z),.031)
for x in (-11.64,-.96):
    for z in (1.7,2.21,2.72,3.23,3.74,4.22): box('boxcar end rib',(x,0,z),(.08,2.98,.075),'red',.015)
    for y in (-1.39,0,1.39): box('end upright',(x,y,2.92),(.085,.085,2.86),'red',.015)
for x in [-11.48+i*.69 for i in range(16)]:
    rod('roof seam',(x,-1.52,4.315),(x,-1.1,4.6),.016,'red')
    rod('roof seam',(x,-1.1,4.6),(x,1.1,4.6),.016,'red')
    rod('roof seam',(x,1.1,4.6),(x,1.52,4.315),.016,'red')
# Small chips / streaks are closed, offset geometry. No overlapping decal planes.
wear_bounds=[]
def chip(x,z,y,r,key='rust',group='body'):
    # Reject overlapping wear patches so offset paint never has coplanar peers.
    for px,pz,py,pr,pg in wear_bounds:
        if pg==group and abs(py-y)<.035 and abs(px-x)<pr+r and abs(pz-z)<1.3*(pr+r): return
    wear_bounds.append((x,z,y,r,group))
    n=rng.randint(5,8)
    pts=[]
    for i in range(n):
        t=math.tau*i/n; rad=r*rng.uniform(.5,1)
        pts.append((x+math.cos(t)*rad,z+math.sin(t)*rad*rng.uniform(.45,1.3)))
    side('paint wear',pts,y,.007,key,group,0)
for s in (-1,1):
    # Broad lower-edge chips follow the reference's broken, vertical paint loss.
    for x in (-10.94,-9.94,-8.99,-8.04,-4.34,-3.37,-2.42,-1.52):
        height=rng.uniform(.38,.64)
        pts=[(x-.34,1.59),(x-.31,1.78),(x-.22,1.70),(x-.15,1.59+height),(x-.04,1.67+height),
             (x+.04,1.83),(x+.17,1.94),(x+.31,1.72),(x+.34,1.59)]
        side('lower paint loss',pts,s*1.514,.007,'rust',bevel=0)
        wear_bounds.append((x,1.86,s*1.514,.37,'body'))
    for i in range(8 if DISTANCE else 140):
        x=rng.uniform(-11.42,-1.18)
        if -7.72<x<-4.9: continue
        z=rng.uniform(1.62,2.24) if i<100 else rng.uniform(2.12,4.16)
        chip(x,z,s*1.513,rng.uniform(.04,.24))
    for i in range(4 if DISTANCE else 53):
        x=rng.uniform(.4,7.5); z=rng.choice([rng.uniform(1.8,2.1),rng.uniform(3.34,3.54)])
        chip(x,z,s*(1.296 if z<2.1 else 1.261),rng.uniform(.02,.085))
    for i in range(16):
        x=rng.uniform(-7.35,-5.2); z=rng.uniform(1.72,4)
        # Door wear sits above corrugation peaks.
        chip(x,z,s*1.728,rng.uniform(.018,.075),'rust','boxcarDoor'+('L' if s==1 else 'R'))
    for x in (9.83,10.37,10.98): chip(x,1.78,s*1.135,.095)
    for x in (.62,3.1,4.6,6.7,8.8,10.25): chip(x,1.40,s*1.623,.06)
for s in (-1,1):
    for x in (.6,2.2,3.8,5.4,7.0):
        chip(x,2.60,s*1.328,.065)
# Required sockets, physics hulls, and lamps. All contract data survives GLB as extras.
for name,pos in [('driverSeat',(8.35,.65,2.1)),('exitL',(8.5,2.1,0)),('exitR',(8.5,-2.1,0))]: empty(name,pos,root)
for name,pos,size in [('locomotive',(5.9,0,2.5),(12.5,3.14,4.2)),('boxcar',(-6.3,0,2.5),(10.7,3.14,4.1))]:
    c=empty('col:'+name,pos,root); c['collider']='cuboid'; c['shape']='cuboid'; c['size']=list(size)
for s in (-1,1):
    for typ,pos,g,col in [('headlight',(11.9,s*1.25,1.72),'lightsFront','light_window_warm'),('brake',(-11.75,s*1.2,1.62),'lightsBrake','light_siren_red')]:
        e=empty('light:'+typ+('L' if s==1 else 'R'),parent=groups[g]); e.location=Vector(pos)-groups[g].location
        e.rotation_euler=Vector((1 if typ=='headlight' else -1,0,-.15)).to_track_quat('-Z','Y').to_euler()
        e['ss_light']=json.dumps({'type':'spot' if typ=='headlight' else 'point','color':col,'intensity':6 if typ=='headlight' else 2,'range':22 if typ=='headlight' else 4,'angle':48,'penumbra':.35,'pool':True,'beam':'soft' if typ=='headlight' else 'none','flare':True,'reflect':True,'shadow':'hero' if typ=='headlight' else 'none','heroPriority':2,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[g+'_'+M['head' if typ=='headlight' else 'brake'].name],'tiers':'all'})
if DISTANCE:
    export_variant(Path(__file__).parent, DISTANCE, omit=('door corrugation', 'wheel dish', 'rolled rim', 'axle', 'brake link', 'step upright', 'boxcar ladder', 'engine access panel', 'roof seam', 'vent vertical fin', 'fan screen', 'lower paint loss', 'ladder rung', 'spring coil', 'tread', 'lug', 'rivet', 'bolt', 'seat', 'steering', 'sidewall', 'rim lip'), far_omit=('fan opening', 'headlamp bezel', 'rail down', 'safety stanchion', 'safety rail', 'wheel dish', 'crossmember', 'door corrugation', 'boxcar rib', 'grab', 'walkway', 'tank strap', 'wiper', 'handle', 'seam', 'badge', 'text', 'letter', 'logo', 'stripe', 'rib', 'hub', 'rim', 'gasket', 'dashboard', 'headrest', 'axle', 'differential', 'grille bar', 'vent', 'hinge', 'clamp', 'spoke'), flat_parts=('*rim*', 'rail wheel'))

# Join only static / same motion group parts by material.
joined=[]
for group,parent in groups.items():
    for m in M.values():
        batch=[o for o in parts if o.parent==parent and o.data.materials[0]==m]
        if not batch: continue
        parts[:]=[o for o in parts if o not in batch]
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch: o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]; bpy.ops.object.join()
        o=bpy.context.object; o.name=group+'_'+m.name
        tri=o.modifiers.new('triangles','TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=tri.name)
        # Collapse redundant bevel facets while retaining every purposeful part.
        mod=o.modifiers.new('hero bevel optimization','DECIMATE'); mod.ratio=.74; mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bm=bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-10],context='FACES')
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
        ao=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
        for v in ao.data: v.color=(1,1,1,1)
        joined.append(o)
bpy.context.view_layer.update()
# Center the full train on X/Y and keep rail wheel contact precisely z=0.
coords=[o.matrix_world@v.co for o in joined for v in o.data.vertices]
lo=[min(v[i] for v in coords) for i in range(3)]; hi=[max(v[i] for v in coords) for i in range(3)]
shift=Vector((-(lo[0]+hi[0])/2,-(lo[1]+hi[1])/2,-lo[2]))
for o in root.children: o.location+=shift
bpy.context.view_layer.update()
asset=list(scene.objects)
required=['body','wheelFL','wheelFR','wheelRL','wheelRR','doorL','doorR','lightsFront','lightsBrake','driverSeat','exitL','exitR']
triangles=sum(len(o.data.polygons) for o in joined)
print('BUILD OK',triangles,len(joined))
report={'id':'veh.train-freight','tier':'Hero','triangles':triangles,'draw_calls':len(joined),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) for n in required),'within_budget':triangles<=80000 and len(joined)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps({'triangles':triangles,'draw_calls':len(joined)},indent=2)+'\n')
def make_lod(level):
    """Explicit closed forms preserve silhouettes better than extreme collapse."""
    smooth={'engine hood','cab','cab roof','short nose','fuel tank','boxcar closed body'}
    def B(name,pos,size,key='slate',group='body'):
        return box(name,Vector(pos)+shift,size,key,.025 if level==1 and name in smooth else 0,group)
    def C(name,pos,r,depth,key='slate',axis='Y',group='body',n=12):
        return cyl(name,Vector(pos)+shift,r,depth,key,axis,group,n,0)
    def R(name,u,v,r=.03,key='yellow'):
        start,end=Vector(u)+shift,Vector(v)+shift
        o=C(name,(start+end)/2-shift,r,(end-start).length,key,'Z',n=6)
        o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
    B('locomotive sill',(5.95,0,1.23),(12.5,3.12,.35),'dark')
    B('boxcar chassis',(-6.3,0,1.23),(10.6,2.98,.35),'dark')
    B('engine hood',(4.48,0,2.82),(8.52,2.42,2.54))
    B('long hood roof',(4.5,0,4.13),(8.6,2.5,.16))
    B('cab',(8.55,0,3.1),(2.05,3.0,2.86))
    B('cab roof',(8.55,0,4.47),(2.23,3.16,.26))
    B('short nose',(10.42,0,2.20),(1.68,2.25,1.24),'yellow')
    B('nose cap',(10.42,0,2.92),(1.69,2.25,.16),'red')
    B('fuel tank',(5.5,0,.72),(4.6,2.32,.85))
    B('boxcar closed body',(-6.3,0,2.92),(10.55,3.,2.85),'car')
    # Pitched boxcar roof, closed at the underside.
    vs=[(-11.61,-1.55,4.28),(-.99,-1.55,4.28),(-.99,1.55,4.28),(-11.61,1.55,4.28),(-11.61,-1.12,4.57),(-.99,-1.12,4.57),(-.99,1.12,4.57),(-11.61,1.12,4.57)]
    mesh('boxcar roof',[Vector(v)+shift for v in vs],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'car')
    for s in (-1,1):
        for z,h,key in [(2.08,.58,'red'),(2.61,.50,'yellow'),(3.07,.42,'red')]:
            B('hood band',(4.48,s*1.24,z),(8.54,.04,h),key)
            B('cab band',(8.55,s*1.517,z),(2.07,.026,h),key)
        B('walkway trim',(5.95,s*1.56,1.45),(12.5,.14,.22),'yellow')
        B('cab side glass',(9.1,s*1.518,3.83),(.46,.026,.66),'dark')
        g='doorL' if s==1 else 'doorR'
        B('cab door',(8.4,s*1.54,3.04),(.80,.035,2.10),'dark',g)
        B('door lower',(8.4,s*1.57,2.52),(.80,.028,1.10),'red',g)
        B('door band',(8.4,s*1.596,2.61),(.80,.02,.50),'yellow',g)
        B('front glass',(9.596,s*.83,3.9),(.026,1.14,.76),'dark')
        for x in ((-11.56,-10.61,-9.65,-8.69,-7.75,-4.79,-3.83,-2.87,-1.91,-1.04) if level==1 else (-11.56,-7.75,-4.79,-1.04)):
            B('car rib',(x,s*1.545,2.91),(.09,.095,2.79),'red')
        for z in (1.54,4.32): B('car band',(-6.3,s*1.56,z),(10.64,.11,.14),'red')
        g='boxcarDoor'+('L' if s==1 else 'R')
        B('door seal',(-6.28,s*1.546,2.89),(2.76,.043,2.64),'dark')
        B('sliding door',(-6.28,s*1.602,2.89),(2.55,.07,2.54),'car',g)
        for z in [1.76+i*.28 for i in range(9 if level==1 else 5)]:
            if level==2: z=1.79+(z-1.76)*2
            B('door rib',(-6.28,s*1.665,z),(2.44,.065,.065),'red',g)
        # Big rails and end ladders remain as silhouette cues at distance.
        for x in (0,7.2,9.55,11.7): R('rail post',(x,s*1.56,1.55),(x,s*1.56,2.7))
        R('long rail',(0,s*1.56,2.7),(7.2,s*1.56,2.7))
        R('nose rail',(9.55,s*1.56,2.7),(11.7,s*1.56,2.7))
        for x in (-11.33,-1.26):
            for dx in (-.32,.32): R('ladder upright',(x+dx,s*1.73,.7),(x+dx,s*1.73,2.93))
            for z in ((.78,1.22,1.66,2.10,2.54) if level==1 else (.78,1.66,2.54)): R('ladder rung',(x-.32,s*1.73,z),(x+.32,s*1.73,z))
        for x in (1.35,4.23,6.78):
            B('vent shadow',(x,s*1.277,3.68),(1.5 if x==1.35 else .85,.09,.57),'dark')
            if level==1:
                for dx in (-.5,-.25,0,.25,.5): B('vent fin',(x+dx,s*1.333,3.68),(.04,.035,.55))
    for x in (1.95,9.5,-9.275,-3.325):
        B('truck bolster',(x,0,.98),(2.72,2.42,.24),'dark')
        for s in (-1,1): B('truck frame',(x,s*1.58,.88),(2.65,.18,.30))
    for j,x in enumerate(axles):
        for s in (-1,1):
            if j==3: g='wheelFL' if s==1 else 'wheelFR'
            elif j==0: g='wheelRL' if s==1 else 'wheelRR'
            else: g=f'wheel{j}'+('L' if s==1 else 'R')
            pos=Vector((x,s*1.27,.58))+shift
            if level==1:
                ring('flanged rail wheel',pos,[(.2,-.15),(.53,-.15),(.58,-.10),(.52,-.03),(.52,.15),(.2,.15)],'slate',g,n=20)
                C('wheel dish',(x,s*1.43,.58),.36,.06,group=g,n=20)
                C('wheel hub',(x,s*1.49,.58),.14,.12,group=g,n=8)
            else:
                C('closed rail wheel',(x,s*1.27,.58),.58,.30,group=g,n=8)
    for x in (1.25,2.68,5.88,7.15):
        C('roof fan',(x,0,4.29),.62,.18,axis='Z',n=16 if level==1 else 6)
        if level==1: C('fan grille',(x,0,4.387),.49,.02,'dark','Z',n=16)
    B('exhaust',(4.58,0,4.34),(.50,.48,.34),'dark')
    B('plow',(12.06,0,.5),(.23,3.2,.73))
    for x in (12.11,-.5,-11.92): B('coupler',(x,0,.96),(.68,.36,.28),'dark')
    for y,z in [(0,2.68),(0,2.30),(-1.25,1.72),(1.25,1.72)]:
        C('headlamp',(11.36 if y==0 else 11.9,y,z),.13,.05,'head','X','lightsFront',n=12 if level==1 else 6)
    for y in (-.16,.16): C('cab lamp',(9.73,y,4.27),.105,.04,'head','X','lightsFront',n=12 if level==1 else 6)
    for s in (-1,1): B('brake',(-11.7,s*1.2,1.62),(.06,.2,.14),'brake','lightsBrake')
    if level==1:
        for s in (-1,1):
            for x in (0,11.7):
                for z in (.26,.60,.94,1.28): B('end step',(x,s*1.28,z),(.48,.63,.075),'steel')
            for x in (-10.94,-9.94,-8.99,-8.04,-4.34,-3.37,-2.42,-1.52):
                side('low wear',[(x-.30,1.6),(x-.25,1.8),(x-.1,2.1),(x+.08,1.85),(x+.3,1.6)],s*1.516+shift.y,.008,'rust',bevel=0)
                # Shift vertices authored by side(), which accepts X/Z coordinates.
                o=parts[-1]
                for v in o.data.vertices: v.co.x+=shift.x; v.co.z+=shift.z
    lows=[]
    for group,parent in groups.items():
        for m in M.values():
            batch=[o for o in parts if o.parent==parent and o.data.materials[0]==m]
            if not batch: continue
            parts[:]=[o for o in parts if o not in batch]
            bpy.ops.object.select_all(action='DESELECT')
            for o in batch: o.select_set(True)
            bpy.context.view_layer.objects.active=batch[0]; bpy.ops.object.join(); o=bpy.context.object
            o.name=group+'_'+m.name
            mod=o.modifiers.new('triangulate','TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=mod.name)
            ao=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
            for c in ao.data: c.color=(.9,.9,.9,1)
            lows.append(o)
    return lows

if a.glb:
    assert report['within_budget'], 'Hero geometry exceeds triangle/draw-call budget'
    target=Path(a.glb).resolve(); target.parent.mkdir(parents=True,exist_ok=True)
    def export(path):
        bpy.ops.object.select_all(action='DESELECT')
        for o in asset: o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=False,export_vertex_color='NAME',export_vertex_color_name='ao')
        blob=path.read_bytes(); size=int.from_bytes(blob[12:16],'little')
        gltf=json.loads(blob[20:20+size])
        return sum(gltf['accessors'][primitive['indices']]['count']//3 for mesh in gltf['meshes'] for primitive in mesh['primitives'])
    scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=29
    scene.render.bake.target='VERTEX_COLORS'; scene.render.bake.use_clear=True
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:
        o.select_set(True); o.data.color_attributes.active_color_index=o.data.color_attributes.find('ao')
    bpy.context.view_layer.objects.active=joined[0]; bpy.ops.object.bake(type='AO')
    # Broad panels have corner samples underneath trim. Keep baked contact AO
    # soft enough that interpolation cannot turn the entire painted wall black.
    for o in joined:
        for c in o.data.color_attributes['ao'].data:
            c.color=tuple(.65+.35*max(0,min(1,v)) for v in c.color[:3])+(1,)
    report['triangles']=export(target)
    lods=[]
    full_asset=asset
    high_names={o:o.name for o in joined}
    for o in joined: o.name='high_'+o.name
    for level in (1,2):
        lows=make_lod(level)
        asset=[o for o in full_asset if o.type=='EMPTY']+lows
        lods.append(export(target.with_name(target.stem+f'.lod{level}.glb')))
        for o in lows: bpy.data.objects.remove(o,do_unlink=True)
    asset=full_asset
    for o,name in high_names.items(): o.name=name
    report['within_budget'] &= target.stat().st_size<=6000*1024
    (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    (HERE/'metrics.json').write_text(json.dumps({'dimensions':[hi[i]-lo[i] for i in range(3)],'lod_triangles':lods,'file_bytes':target.stat().st_size},indent=2)+'\n')
    print('EXPORT OK',triangles,len(joined),'LOD',lods)
if a.render:
    stage=mat('studio','2a2730',.85)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.022)); bpy.context.object.data.materials.append(stage)
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.17,.23,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.65
    for name,pos,power,tint,size in [('key',(8,-12,18),6500,(1,.79,.60),12),('fill',(3,9,13),5500,(.68,.78,1),12),('rim',(-10,2,13),7000,(1,.65,.39),10)]:
        d=bpy.data.lights.new(name,'AREA'); o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=pos; d.energy=power; d.color=tint; d.size=size; o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); scene.collection.objects.link(cam); scene.camera=cam
    views={'ref':(16,29,14),'game':(20,-25,30),'front':(32,0,10),'side':(0,-34,11),'rear':(-32,-3,11)}
    aim=Vector((0,0,2.2))
    def view(v):
        cam.location=views[v]; cam.rotation_euler=(aim-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=29 if v=='game' else 27
    view(a.view)
    scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    out=Path(a.render).resolve(); out.parent.mkdir(parents=True,exist_ok=True); scene.render.filepath=str(out)
    bpy.ops.render.render(write_still=True); print('RENDER OK',out)
    if a.view=='ref' and (out.stem.startswith('round') or out.stem=='hero'):
        view('game')
        if out.stem=='hero':
            scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        scene.render.filepath=str(out.with_name('game.png' if out.stem=='hero' else out.stem.replace('-ref','-game')+'.png'))
        bpy.ops.render.render(write_still=True); print('RENDER OK',scene.render.filepath)

# Every full source export refreshes the native distance tiers.
if "--glb" in sys.argv and not DISTANCE:
    build_native_lods(__file__)
