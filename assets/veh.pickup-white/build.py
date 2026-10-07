"""Deterministic, texture-free single-cab pickup. Blender +X forward, Z up, metres.
Static parts merge per palette; motion groups retain wheel/door/tailgate pivots.
Run only through experiment/tools/blender_run.py.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.lod0 import stabilize_ao, prune_hidden_faces, prepare_export_lod
import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--glb')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1
rng = random.Random(29)
parts = []
groups = {}

def linear(hexcolor):
    c = [int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    return [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]

def material(token, color, rough=.5, metal=0, emission=0):
    m = bpy.data.materials.new(('emi_' if emission else 'pal_')+token)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = linear(color)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if emission:
        bs.inputs['Emission Color'].default_value = linear(color)
        bs.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = linear(color)
    return m

M = {'white':material('picketWhite','f2e6dc',.34),
     'dark':material('uiDark','25222c',.7),
     'glass':material('asphalt','5b4f5c',.24,0),
     'metal':material('sidewalk','b9a4a0',.3,.7),
     'rust':material('woodWarm','b0703f',.86),
     'head':material('windowGlow','ffc773',.22,0,2.2),
     'red':material('sirenRed','ff2d2d',.25,0,.8),
     'amber':material('schoolBusYellow','f2b630',.3)}
# Dark glass remains opaque, avoiding alpha-sorting artifacts in either backend.
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.08

def empty(name, pos=(0,0,0), parent=None):
    o = bpy.data.objects.new(name,None)
    scene.collection.objects.link(o)
    o.location = pos
    o.parent = parent
    return o

root = empty('veh.pickup-white')
root['ss_physics'] = json.dumps({'class':'heavy','mass':1680,'friction':.7,'restitution':.05,'centerOfMass':[0,.8,0],'pushable':False,'kickable':False,'flammable':True})
groups['body'] = empty('body',parent=root)
for name,pos in [('wheelFL',(1.65,.98,.51)),('wheelFR',(1.65,-.98,.51)),('wheelRL',(-1.65,.98,.51)),('wheelRR',(-1.65,-.98,.51)),('doorL',(.86,1.006,1.25)),('doorR',(.86,-1.006,1.25)),('tailgate',(-2.48,0,.84)),('lightsFront',(2.53,0,1.19)),('lightsBrake',(-2.53,0,1.19))]:
    groups[name] = empty(name,pos,root)
    groups[name]['animated'] = True

for s in (-1,1):
    suffix='L' if s==1 else 'R'
    for name,pos in [('lampHead'+suffix,(2.609,s*.76,1.26)),('lampBrake'+suffix,(-2.558,s*.965,1.31))]:
        groups[name]=empty(name,pos,root)
        groups[name]['animated']=True

def finish(o,name,mat,group='body',bevel=0):
    o.name = name
    o.data.materials.append(M[mat])
    if bevel and (bevel >= .01 or 'headlamp' in name):
        mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=3 if 'headlamp' in name else 2 if bevel >= .04 else 1
        if name in ('crowned dented hood','dented door skin'): mod.limit_method='ANGLE'; mod.angle_limit=.6
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    detail=o.data.attributes.new(name='detail',type='INT',domain='FACE')
    distant_omit={'tread block','lug','rim ventilation','plate bolt','fuel lock','cowl vent',
                  'headlamp prism','bed floor rib','bed stake rib','paint chip','hood rust',
                  'hood edge chip','roof rust','roof edge chip','tailgate rust','dent scratch','leaf spring','shock'}
    level=3 if name in {'door glass','window gasket','windshield','windshield gasket','rear glass','rear glass seal'} else 2 if name in distant_omit else 0
    for value in detail.data: value.value=level
    parent=groups[group]
    world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world
    parts.append(o)
    return o

def box(name,pos,size,mat,bevel=.02,group='body',rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object; o.dimensions=size
    if rot: o.rotation_euler=rot
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,group,bevel)

def mesh(name,verts,faces,mat,group='body',bevel=0):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    bm=bmesh.new(); bm.from_mesh(data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(data); bm.free()
    o=bpy.data.objects.new(name,data); scene.collection.objects.link(o)
    return finish(o,name,mat,group,bevel)

def panel(name,points,y,depth,mat='white',group='body',bevel=.014):
    n=len(points); verts=[(x,y+d,z) for d in (-depth/2,depth/2) for x,z in points]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat,group,bevel)

def beam(name,a,b,width,mat,group='body',depth=None):
    a,b=Vector(a),Vector(b)
    o=box(name,(a+b)/2,(width,depth or width,(b-a).length),mat,.008,group)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

def cylinder(name,pos,r,depth,mat,group='body',axis='Y',vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=pos)
    o=bpy.context.object
    o.rotation_euler=(math.pi/2,0,0) if axis=='Y' else (0,math.pi/2,0) if axis=='X' else (0,0,0)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,group,0 if name=='rim ventilation' else .008)

def ring(name,cx,cy,cz,profile,mat,group,n=32):
    verts=[]
    for r,y in profile:
        verts += [(cx+r*math.sin(2*math.pi*i/n),cy+y,cz+r*math.cos(2*math.pi*i/n)) for i in range(n)]
    faces=[]
    for j in range(len(profile)):
        for i in range(n):
            faces.append((j*n+i,j*n+(i+1)%n,((j+1)%len(profile))*n+(i+1)%n,((j+1)%len(profile))*n+i))
    o=mesh(name,verts,faces,mat,group)
    for p in o.data.polygons: p.use_smooth=True
    return o

def hood_z(x,y):
    return 1.472-.033*(x-.925)/1.61+.019*(1-(y/.955)**2)-.014*math.exp(-((x-1.88)/.25)**2-((y+.37)/.19)**2)

def grid_shell(name,n,m,point,group='body',bevel=.025):
    """Close a two-sided surface grid with a bevelled perimeter."""
    verts=[point(i,j,outer) for outer in (False,True) for j in range(m+1) for i in range(n+1)]
    count=(n+1)*(m+1); faces=[]
    for level in (0,1):
        for j in range(m):
            for i in range(n):
                a=level*count+j*(n+1)+i; faces.append((a,a+1,a+n+2,a+n+1))
    boundary=list(range(n+1))+[j*(n+1)+n for j in range(1,m+1)]+[m*(n+1)+i for i in range(n-1,-1,-1)]+[j*(n+1) for j in range(m-1,0,-1)]
    for i,a in enumerate(boundary):
        b=boundary[(i+1)%len(boundary)]; faces.append((a,b,b+count,a+count))
    mesh(name,verts,faces,'white',group,bevel)

def shaped_hood():
    def point(i,j,outer):
        x=.925+1.61*i/20; y=-.955+1.91*j/20
        return (x,y,hood_z(x,y) if outer else 1.30)
    grid_shell('crowned dented hood',20,20,point)

def dented_door(s,group):
    def point(i,j,outer):
        v=j/10; z=.83+.62*v; lo=-.46-.02*v; hi=.83+.09*v; x=lo+(hi-lo)*i/14
        dent=.017*math.exp(-((x-.12)/.18)**2-((z-1.18)/.09)**2)
        return (x,s*(1.0235-dent if outer else .9525),z)
    grid_shell('dented door skin',14,10,point,group)

# Chassis, axles, visible suspension and exhaust.
box('frame',(0,0,.65),(4.9,1.48,.22),'dark',.04)
for y in (-.57,.57): box('frame rail',(0,y,.49),(4.55,.11,.15),'dark')
for x in (-1.65,1.65):
    cylinder('axle',(x,0,.51),.07,1.97,'dark')
    cylinder('differential',(x,0,.5),.14,.3,'dark')
    for y in (-.65,.65):
        box('leaf spring',(x,y,.39),(.85,.08,.045),'metal',.014)
        beam('shock',(x-.15,y,.5),(x+.06,y,.86),.055,'metal')
cylinder('exhaust',(-2.13,.73,.58),.042,.57,'metal',axis='X')
# Front hood and rear open bed.
shaped_hood()
box('hood seam',(1.07,0,1.475),(.022,1.77,.018),'dark',.005)
box('bed floor',(-1.53,0,.91),(1.98,1.8,.12),'dark',.025)
for y in [i*.17 for i in range(-4,5)]:
    box('bed floor rib',(-1.52,y,.984),(1.79,.035,.023),'metal',.008)
box('bed bulkhead',(-.55,0,1.2),(.12,1.89,.58),'white',.025)
box('bulkhead liner',(-.63,0,1.2),(.017,1.68,.43),'dark',.01)
for s in (-1,1): box('bed side liner',(-1.53,s*.865,1.21),(1.83,.018,.43),'dark',.012)
for y in (-.89,.89):
    box('inner wheel tub',(-1.65,y*.85,1.01),(1.05,.29,.4),'dark',.07)
    for x in (-2.2,-1.45,-.75): box('bed stake rib',(x,y,1.21),(.055,.065,.42),'dark',.01)
# Side panels have genuine wheel arch cutouts (no hidden filled body).
for s in (-1,1):
    y=s*.956
    for label,lo,hi,ax in [('front',.91,2.51,1.65),('rear',-2.49,-.57,-1.65)]:
        outline=[(lo,1.46),(hi,1.46),(hi,.77),(ax+.63,.77),(ax+.6,1.05),(ax+.43,1.23),(ax-.43,1.23),(ax-.6,1.05),(ax-.63,.77),(lo,.77)]
        panel(label+' fender',outline,y,.13)
        outer=[(ax-.66,.76),(ax-.63,1.06),(ax-.46,1.28),(ax+.46,1.28),(ax+.63,1.06),(ax+.66,.76)]
        inner=[(ax-.6,.76),(ax-.57,1.04),(ax-.4,1.20),(ax+.4,1.20),(ax+.57,1.04),(ax+.6,.76)]
        for i in range(5): panel('rolled arch lip',[outer[i],outer[i+1],inner[i+1],inner[i]],s*1.046,.055,bevel=.018)
    box('bed top rail',(-1.54,s*.964,1.48),(1.94,.12,.065),'white',.02)
    box('rocker',(.17,s*.935,.77),(1.43,.14,.14),'white',.027)
    box('mudflap',(-2.26,s*.96,.55),(.055,.35,.35),'dark',.016)
    box('mudflap front',(1.02,s*.96,.57),(.055,.35,.30),'dark',.016)
    # Front marker and rear fuel flap stand proud of the skin.
    box('side marker',(2.21,s*1.029,1.29),(.15,.03,.065),'amber',.01)
    if s==-1:
        box('fuel recess',(-.98,-1.035,1.19),(.26,.016,.27),'dark',.025)
        box('fuel door',(-.98,-1.062,1.19),(.23,.021,.24),'white',.022)
        cylinder('fuel lock',(-1.054,-1.08,1.19),.016,.011,'metal',vertices=16)
# Cab and its thick pillars, trapezoidal side windows.
box('cab back',(-.54,0,1.5),(.13,1.88,1.05),'white',.035)
box('rear glass seal',(-.612,0,1.84),(.026,1.5,.49),'dark',.027)
box('rear glass',(-.632,0,1.84),(.013,1.39,.4),'glass',.016)
box('roof',(-.04,0,2.15),(1.14,1.94,.15),'white',.075)
for s in (-1,1):
    beam('A pillar',(.95,s*.925,1.46),(.43,s*.884,2.13),.098,'white')
    beam('B pillar',(-.55,s*.924,1.4),(-.49,s*.886,2.12),.12,'white')
    g='doorL' if s==1 else 'doorR'
    dented_door(s,g)
    panel('window gasket',[(-.46,1.47),(.86,1.47),(.39,2.079),(-.46,2.079)],s*.965,.038,'dark',g,.017)
    panel('door glass',[(-.39,1.54),(.73,1.54),(.335,2.009),(-.39,2.009)],s*.988,.015,'glass',g,.009)
    box('window sill',(.12,s*1.014,1.477),(1.33,.055,.035),'white',.013,g)
    box('door handle recess',(-.245,s*1.032,1.38),(.26,.022,.09),'dark',.013,g)
    box('door handle',(-.245,s*1.054,1.392),(.21,.035,.036),'metal',.01,g)
    beam('mirror stalk',(.76,s*1.03,1.53),(.72,s*1.13,1.58),.05,'dark',g)
    box('mirror housing',(.73,s*1.18,1.66),(.23,.14,.22),'dark',.025,g)
    box('mirror glass',(.609,s*1.185,1.66),(.012,.136,.166),'metal',.012,g)
# Windshield: physical bevelled gasket with inset pane.
verts=[(.967,-.882,1.5),(.967,.882,1.5),(.429,.845,2.081),(.429,-.845,2.081)]
mesh('windshield gasket',verts,[(0,1,2,3)],'dark')
mesh('windshield',[(.957,-.802,1.554),(.957,.802,1.554),(.478,.782,2.021),(.478,-.782,2.021)],[(0,1,2,3)],'glass')
for y in (-.46,.43):
    beam('wiper arm',(1.005,y-.2,1.503),(.935,y+.10,1.57),.025,'dark')
    beam('wiper blade',(.94,y-.18,1.568),(.94,y+.31,1.568),.026,'dark')
box('cowl',(1.015,0,1.46),(.12,1.75,.05),'white')
for y in [i*.062 for i in range(-10,11)]: box('cowl vent',(1.04,y,1.492),(.043,.022,.009),'dark',.002)
# Cabin furnishings are useful when doors swing open.
box('cab floor',(.14,0,.88),(1.4,1.75,.13),'dark')
box('dashboard',(.7,0,1.41),(.35,1.73,.16),'dark',.05)
for y in (-.45,.45):
    box('seat cushion',(.0,y,1.08),(.48,.54,.18),'dark',.06)
    box('seat back',(-.3,y,1.44),(.18,.53,.68),'dark',.065)
    box('headrest',(-.26,y,1.84),(.17,.3,.24),'dark',.045)
ring('steering wheel',.49,.48,1.55,[(.19,-.018),(.21,-.014),(.21,.014),(.19,.018)],'dark','body',48)
# Grille, twin headlamps, bumpers and licence brackets. Fictional blank oval badge.
box('front fascia',(2.51,0,1.2),(.11,1.92,.47),'white',.04)
box('grille recess',(2.576,0,1.21),(.033,1.21,.38),'dark',.018)
for z in (1.095,1.21,1.325): box('grille bar',(2.609,0,z),(.035,1.18,.033),'metal',.008)
for y in (-.48,-.24,0,.24,.48): box('grille upright',(2.602,y,1.21),(.029,.038,.33),'dark',.006)
o=cylinder('fictional oval badge',(2.633,0,1.22),.079,.027,'metal',axis='X',vertices=32); o.scale.y=1.45
for s in (-1,1):
    box('headlamp surround',(2.576,s*.76,1.24),(.053,.29,.34),'metal',.03)
    box('headlamp',(2.609,s*.76,1.26),(.035,.231,.25),'amber',.043,'lampHead'+('L' if s==1 else 'R'))
    box('turn indicator',(2.607,s*.951,1.25),(.044,.08,.28),'amber',.015,'lightsFront')
    box('indicator lower',(2.609,s*.76,1.046),(.038,.23,.065),'amber',.012,'lightsFront')
    cylinder('headlamp lens',(2.647,s*.76,1.26),.105,.024,'head','lampHead'+('L' if s==1 else 'R'),axis='X',vertices=40)
box('front bumper',(2.60,0,.83),(.25,2.13,.26),'metal',.047)
box('bumper inset',(2.734,0,.844),(.017,1.13,.098),'dark',.015)
for y in (-.85,.85): box('bumper amber',(2.733,y,.865),(.022,.18,.09),'amber',.013)
box('front plate',(2.766,0,.842),(.022,.4,.21),'metal',.012)
for y in (-.165,.165): cylinder('plate bolt',(2.786,y,.901),.011,.008,'dark',axis='X',vertices=12)
box('rear bumper',(-2.6,0,.8),(.23,2.10,.23),'metal',.037)
box('rear step',(-2.62,0,.927),(.21,1.35,.022),'dark',.014)
box('rear plate',(-2.728,0,.8),(.021,.4,.18),'metal',.014)
box('tailgate',(-2.478,0,1.2),(.11,1.80,.56),'white',.026,'tailgate')
box('tailgate pressing',(-2.541,0,1.23),(.015,1.58,.32),'white',.037,'tailgate')
box('tailgate handle',(-2.56,0,1.43),(.034,.25,.076),'dark',.014,'tailgate')
for s in (-1,1):
    box('tail lamp bezel',(-2.507,s*.966,1.23),(.085,.15,.42),'dark',.019)
    box('brake lamp',(-2.558,s*.965,1.31),(.034,.128,.24),'red',.013,'lampBrake'+('L' if s==1 else 'R'))
    box('reverse lamp',(-2.56,s*.965,1.131),(.033,.127,.087),'head',.01,'lightsBrake')
    box('rear indicator',(-2.56,s*.965,1.051),(.033,.127,.057),'amber',.009,'lightsBrake')
    cylinder('tailgate hinge',(-2.505,s*.68,.909),.035,.18,'metal','tailgate')
def tread(pos,angle,skew,group):
    # Drop the tread block's sub-centimetre corner chamfers at game zoom.
    x,y,h=.031,.0405,.017
    outline=[(-x,-y),(x,-y),(x,y),(-x,y)]
    rot=Euler((0,angle,skew)).to_matrix(); centre=Vector(pos)
    verts=[centre+rot@Vector((u,v,z)) for z in (-h,h) for u,v in outline]
    faces=[tuple(reversed(range(4))),tuple(range(4,8))]+[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)]
    mesh('tread block',verts,faces,'dark',group)

# Four rich wheels: rounded profile, three staggered rows of tread, inset steel rims,
# dark ventilation pockets, raised hubs and six lug nuts. All rotate at axle centres.
for g in ('wheelFL','wheelFR','wheelRL','wheelRR'):
    x,y,z=groups[g].location; s=1 if y>0 else -1
    ring('tire',x,y,z,[(.28,-.18),(.39,-.18),(.465,-.145),(.495,-.10),(.499,.10),(.465,.145),(.39,.18),(.28,.18)],'dark',g)
    for row in (-1,0,1):
        for i in range(40):
            a=2*math.pi*(i+.32*(row%2))/40
            tread((x+.498*math.sin(a),y+row*.095,z+.498*math.cos(a)),a,-.13 if row==1 else .13,g)
    outer=y+s*.178
    ring('steel rim',x,outer,z,[(.15,-.009*s),(.26,-.015*s),(.293,.009*s),(.304,.02*s),(.302,.038*s),(.273,.046*s),(.247,.021*s),(.15,.017*s)],'metal',g)
    cylinder('rim dish',(x,outer+s*.008,z),.254,.025,'metal',g)
    for i in range(6):
        a=2*math.pi*i/6
        cylinder('rim ventilation',(x+.195*math.sin(a),outer+s*.025,z+.195*math.cos(a)),.042,.011,'dark',g,vertices=24)
        cylinder('lug',(x+.112*math.sin(a),outer+s*.058,z+.112*math.cos(a)),.018,.029,'metal',g,vertices=6)
    cylinder('hub backing',(x,outer+s*.042,z),.11,.07,'dark',g)
    cylinder('hub cap',(x,outer+s*.084,z),.077,.045,'metal',g,vertices=32)
    ring('sidewall bead',x,y+s*.174,z,[(.335,0),(.34,s*.007),(.352,s*.007),(.357,0)],'dark',g)
# Raised irregular rust chips: minimum 5 mm clear of panel skin. Small wear, not a wreck.
def chip_side(x,z,y,scale,group='body'):
    n=rng.randint(5,8)
    pts=[]
    for i in range(n):
        a=2*math.pi*i/n; r=scale*rng.uniform(.55,1)
        pts.append((x+math.cos(a)*r,z+math.sin(a)*r*.6))
    panel('paint chip',pts,y,.006,'rust',group,0)
for s in (-1,1):
    for x in (-2.41,-2.33,-.75,-.63,.96,2.35):
        chip_side(x,.84,s*1.035,.080)
    for _ in range(19):
        x=rng.uniform(-2.35,-.64); z=rng.uniform(1.33,1.44)
        chip_side(x,z,s*1.031,rng.uniform(.013,.042))
    g='doorL' if s==1 else 'doorR'
    for x,z,r in [(-.33,.91,.105),(.59,.96,.047),(.63,1.26,.020),(-.1,.875,.085),(.35,.88,.053)]: chip_side(x,z,s*1.039,r,g)
    # An offset paint scratch accents the actual deformed door skin.
    panel('dent scratch',[(.05,1.18),(.09,1.23),(.11,1.22),(.066,1.175)],s*1.033,.006,'rust',g,0)
for _ in range(26):
    x=rng.uniform(1.10,2.40); y=rng.uniform(-.85,.85); r=rng.uniform(.012,.06)
    n=6; verts=[(x+math.cos(i*math.tau/n)*r*rng.uniform(.6,1),y+math.sin(i*math.tau/n)*r*.6,hood_z(x+math.cos(i*math.tau/n)*r,y+math.sin(i*math.tau/n)*r*.6)+.008) for i in range(n)]
    mesh('hood rust',verts,[tuple(range(n))],'rust')
for x,y,r in [(2.38,-.55,.10),(2.15,.73,.075),(1.08,-.75,.07),(1.70,-.72,.11)]:
    points=[(x+math.cos(i*math.tau/8)*r*rng.uniform(.65,1),y+math.sin(i*math.tau/8)*r*.55) for i in range(8)]
    mesh('hood edge chip',[(a,b,hood_z(a,b)+.008) for a,b in points],[tuple(range(8))],'rust')
for x,y,r in [(-.40,-.72,.10),(.32,.64,.08),(.26,-.71,.055),(-.37,.61,.065)]:
    mesh('roof edge chip',[(x+math.cos(i*math.tau/7)*r*rng.uniform(.7,1),y+math.sin(i*math.tau/7)*r*.5,2.233) for i in range(7)],[tuple(range(7))],'rust')
for _ in range(17):
    x=rng.uniform(-.45,.33); y=rng.uniform(-.81,.81); r=rng.uniform(.015,.05)
    mesh('roof rust',[(x+math.cos(i*math.tau/6)*r,y+math.sin(i*math.tau/6)*r*.6,2.233) for i in range(6)],[tuple(range(6))],'rust')
for y,z,r in [(-.66,1.07,.095),(-.37,1.03,.055),(.49,1.13,.063),(.70,1.30,.04),(.16,1.10,.025)]:
    points=[(-2.561,y+math.cos(i*math.tau/7)*r*rng.uniform(.6,1),z+math.sin(i*math.tau/7)*r*.6) for i in range(7)]
    mesh('tailgate rust',points,[tuple(reversed(range(7)))],'rust','tailgate')
# Sockets, collider and contract light anchors. Local -Z points ahead/down.
for name,pos in [('driverSeat',(.0,.45,1.08)),('exitL',(.12,1.48,0)),('exitR',(.12,-1.48,0))]: empty(name,pos,root)
col=empty('col:chassis',(0,0,1.04),root); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[5.3,1.95,1.48]
for s in (-1,1):
    suffix='L' if s==1 else 'R'
    for typ,x,z,parent,color,intensity in [('headlight',2.62,1.25,'lightsFront','light_led_white',6),('brake',-2.57,1.31,'lightsBrake','light_siren_red',2)]:
        e=empty('light:'+typ+suffix,parent=groups[parent]); e.location=Vector((x,s*(.76 if typ=='headlight' else .965),z))-groups[parent].location
        e.rotation_euler=Vector((1,0,-.12)).to_track_quat('-Z','Y').to_euler()
        e['ss_light']=json.dumps({'type':'spot' if typ=='headlight' else 'point','color':color,'intensity':intensity,'range':18 if typ=='headlight' else 3,'angle':48,'penumbra':.35,'pool':True,'beam':'soft' if typ=='headlight' else 'none','flare':True,'reflect':True,'shadow':'hero' if typ=='headlight' else 'none','heroPriority':2,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':['lampHead'+suffix] if typ=='headlight' else ['lampBrake'+suffix,'lightsBrake'],'tiers':'all'})
prune_hidden_faces(parts, occlusion=True, defer=True)
# Merge each motion/static group by material: few draw calls, correct preserved pivots.
joined=[]
for group,parent in groups.items():
    for mat in M.values():
        batch=[o for o in parts if o.parent==parent and o.data.materials[0]==mat]
        if not batch: continue
        parts[:]=[o for o in parts if o not in batch]
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch: o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]
        bpy.ops.object.join(); o=bpy.context.object; o.name=group+'_'+mat.name
        joined.append(o)
        tri=o.modifiers.new('triangulate','TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=tri.name)
        # Bevels on very thin parts can leave collapsed centre faces.
        bm=bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-10],context='FACES')
        bm.to_mesh(o.data); bm.free()
        # Allocate the corner-colour AO attribute; Cycles bakes it before GLB export.
        o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')

# Fit the production manifest dimensions, including mirrors, while keeping ground contact.
bpy.context.view_layer.update()
worlds={o:o.matrix_world.copy() for o in joined}
coords=[o.matrix_world @ v.co for o in joined for v in o.data.vertices]
low=[min(v[i] for v in coords) for i in range(3)]
high=[max(v[i] for v in coords) for i in range(3)]
scale=Vector((4.4/(high[0]-low[0]),1.8/(high[1]-low[1]),1.9/(high[2]-low[2])))
S=Matrix.Diagonal((*scale,1))
S.translation=Vector((-(high[0]+low[0])*.5*scale.x,-(high[1]+low[1])*.5*scale.y,-low[2]*scale.z))
for o in groups.values(): o.location=S @ o.location
bpy.context.view_layer.update()
for o,world in worlds.items():
    o.matrix_world=S @ world
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
for o in scene.objects:
    if o.type=='EMPTY' and o not in groups.values() and o!=root:
        if o.parent==root: o.location=S @ o.location
        else: o.location=Vector(tuple(o.location[i]*scale[i] for i in range(3)))
# Recheck after scale application, where float32 rounding can collapse tiny bevel faces.
for o in joined:
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-8],context='FACES')
    bm.to_mesh(o.data); bm.free()
col['size']=[4.25,1.75,1.55]
col.location=(0,0,.95)
bpy.context.view_layer.update()
asset_objects=[o for o in scene.objects]
triangles=sum(len(o.data.polygons) for o in joined)
draws=len(joined)
required=['body','wheelFL','wheelFR','wheelRL','wheelRR','lightsFront','lightsBrake','driverSeat','exitL','exitR','doorL','doorR']
report={'id':'veh.pickup-white','tier':'Hero','triangles':triangles,'draw_calls':draws,'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) for n in required),'within_budget':triangles<=80000 and draws<=40,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
def lod_glazing(o,bm):
    """Thin glazed layers keep explicit separation instead of collapsing together."""
    group=o.parent.name; mat=o.data.materials[0]; specs=[]
    if group in ('doorL','doorR'):
        side=1 if group=='doorL' else -1
        if mat==M['dark']:
            points=[(-.46,1.47),(.86,1.47),(.39,2.079),(-.46,2.079)]; y=side*.980
        elif mat==M['glass']:
            points=[(-.39,1.54),(.73,1.54),(.335,2.009),(-.39,2.009)]; y=side*.9955
        else: points=[]
        if points:
            vertices=[(x,y,z) for x,z in points]
            specs.append(vertices if side==-1 else list(reversed(vertices)))
    elif group=='body' and mat in (M['dark'],M['glass']):
        if mat==M['dark']:
            specs.append([(.967,-.882,1.5),(.967,.882,1.5),(.429,.845,2.081),(.429,-.845,2.081)])
            x,y,z0,z1=-.625,.75,1.595,2.085
        else:
            specs.append([(.957,-.802,1.554),(.957,.802,1.554),(.478,.782,2.021),(.478,-.782,2.021)])
            x,y,z0,z1=-.6385,.695,1.64,2.04
        specs.append([(x,-y,z1),(x,y,z1),(x,y,z0),(x,-y,z0)])
    inverse=o.matrix_world.inverted()
    color=bm.loops.layers.color.get('ao') or bm.loops.layers.color.new('ao')
    for points in specs:
        face=bm.faces.new([bm.verts.new(inverse @ (S @ Vector(point))) for point in points])
        for loop in face.loops: loop[color]=(1,1,1,1)

if args.glb:
    target=Path(args.glb).resolve(); target.parent.mkdir(parents=True,exist_ok=True)
    def export(path):
        bpy.ops.object.select_all(action='DESELECT')
        for o in asset_objects: o.select_set(True)
        stabilize_ao(list(bpy.context.scene.objects)); prepare_export_lod(list(bpy.context.scene.objects), str(path)); bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=False,export_vertex_color='NAME',export_vertex_color_name='ao',export_all_vertex_colors=False)
    scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=29
    scene.render.bake.target='VERTEX_COLORS'; scene.render.bake.use_clear=True
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:
        o.select_set(True)
        o.data.color_attributes.active_color_index=o.data.color_attributes.find('ao')
    bpy.context.view_layer.objects.active=joined[0]
    bpy.ops.object.bake(type='AO')
    export(target)
    # Work on copies: preserve pivots and restore the full-resolution meshes afterwards.
    for level,ratio in [(1,.125),(2,.045)]:
        originals={o:o.data for o in joined}
        for o in joined:
            o.data=o.data.copy()
            bm=bmesh.new(); bm.from_mesh(o.data); layer=bm.faces.layers.int.get('detail')
            if layer:
                bmesh.ops.delete(bm,geom=[f for f in bm.faces if f[layer]==3 or (level==2 and f[layer]==2)],context='FACES')
            bm.to_mesh(o.data); bm.free()
            if o.data.polygons:
                mod=o.modifiers.new('distance simplification','DECIMATE'); mod.ratio=ratio; mod.use_collapse_triangulate=True
                bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
            # Collapse can extrapolate vertices. Keep every LOD inside the measured hull.
            inverse=o.matrix_world.inverted()
            for v in o.data.vertices:
                world=o.matrix_world @ v.co
                world.x=max(-2.2,min(2.2,world.x)); world.y=max(-.9,min(.9,world.y)); world.z=max(0,min(1.9,world.z))
                v.co=inverse @ world
            bm=bmesh.new(); bm.from_mesh(o.data)
            bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-12],context='FACES')
            lod_glazing(o,bm)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
        export(target.with_name(target.stem+f'.lod{level}.glb'))
        for o,data in originals.items():
            temporary=o.data; o.data=data; bpy.data.meshes.remove(temporary)
    report['within_budget']=report['within_budget'] and target.stat().st_size<=6000*1024
    (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('EXPORT OK',triangles,'triangles',draws,'draw calls')

if args.render:
    # Neutral studio, warm key and broad cool fill. Stage never enters export.
    stage=material('studio','2a2730',.86)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.018)); bpy.context.object.data.materials.append(stage)
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.17,.23,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.65
    for name,pos,power,color,size in [('key',(3,-4,7),1000,(1,.79,.60),5),('fill',(1,5,4),850,(.68,.78,1),5),('rim',(-5,-1,5),1100,(1,.65,.39),4)]:
        d=bpy.data.lights.new(name,'AREA'); o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=pos; d.energy=power; d.color=color; d.shape='DISK'; d.size=size; o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
    views={'ref':(8,-10,6),'game':(9,-9,12),'front':(10,0,3.1),'rear':(-10,-1,3.7),'side':(0,-12,3.2)}
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); scene.collection.objects.link(cam); scene.camera=cam
    cam.location=views[args.view]; target=Vector((0,0,1.0)); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=7.9 if args.view=='game' else 6.7
    scene.render.engine='CYCLES'; scene.cycles.samples=args.samples; scene.cycles.use_denoising=True
    scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(Path(args.render).resolve()); Path(args.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',args.render)
    # Pair review angles in one shared render-slot invocation.
    render_path=Path(args.render)
    if args.view=='ref' and render_path.stem.startswith('round') and render_path.stem.endswith('-ref'):
        cam.data.ortho_scale=7.9
        cam.location=views['game']; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(render_path.with_name(render_path.stem[:-4]+'-game.png').resolve())
        bpy.ops.render.render(write_still=True)
        print('RENDER OK',scene.render.filepath)
