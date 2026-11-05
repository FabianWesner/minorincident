"""Sunset Grove Community Hospital. Deterministic geometry-only hero asset.
Metres; +X is the entrance, Z up. Raised lettering and trim have >3mm clearance.
Static meshes merge per material; roof and hinged doors retain their assemblies.
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view',default='ref')
p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng=random.Random(2403)
COLORS={'picketWhite':'f2e6dc','backpackTeal':'2f6e6a','uiDark':'25222c','sidewalk':'b9a4a0','asphalt':'5b4f5c','survivorRed':'d9363e','woodWarm':'b0703f','grass':'6f8f3a','foliage':'7da23c','schoolBusYellow':'f2b630','windowGlow':'ffc773','brick':'a8483a'}
M={}
for token,h in COLORS.items():
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    rgba=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    m=bpy.data.materials.new('pal_'+token); m.use_nodes=True; m.use_backface_culling=True
    bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=rgba; bs.inputs['Roughness'].default_value=.65
    if token=='backpackTeal':bs.inputs['Roughness'].default_value=.38
    M[token]=m
m=M['windowGlow'].copy(); m.name='emi_windowGlow'
bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Emission Color'].default_value=bs.inputs['Base Color'].default_value; bs.inputs['Emission Strength'].default_value=1.8
M['emi_windowGlow']=m

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
    if parent:
        bpy.context.view_layer.update(); world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world
    return o
root=empty('root'); root['asset_id']='bld.hospital-exterior'; root['forward']='+X'
body=empty('body',parent=root); roof=empty('roof',parent=root)
parts=[]
def finish(o,name,mat,parent=body,bevel=0):
    o.name=name; o.data.materials.append(M[mat])
    if bevel:
        mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=3 if bevel>=.07 else (2 if bevel>=.03 else 1)
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update(); world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world
    parts.append(o); return o

def box(name,loc,size,mat,parent=body,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,min(bevel,min(size)*.3))

def sphere(name,loc,scale,mat,sub=1,parent=body):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent)

def rod(name,start,end,r,mat,parent=body,n=10):
    d=Vector(end)-Vector(start); mid=(Vector(start)+Vector(end))/2
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d.length,location=mid); o=bpy.context.object
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return finish(o,name,mat,parent)
font_path='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font=bpy.data.fonts.load(font_path)
def text(word,loc,width,height,mat='backpackTeal',parent=body,flat=False):
    bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,math.pi/2)); o=bpy.context.object
    o.data.body=word; o.data.font=font; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.extrude=0 if flat else .055; o.data.resolution_u=2
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object
    coords=[v.co for v in o.data.vertices]; sx=width/(max(v.x for v in coords)-min(v.x for v in coords)); sy=height/(max(v.y for v in coords)-min(v.y for v in coords))
    for v in o.data.vertices:v.co.x*=sx; v.co.y*=sy
    return finish(o,'lettering_'+word,mat,parent)

# Forecourt: a single grounded slab, raised walk, discrete pavers and curbs.
box('site slab',(2,0,.12),(20,22,.24),'asphalt',bevel=.12)
box('entrance sidewalk',(4.5,0,.24),(5.7,18,.32),'sidewalk',bevel=.08)
for x in [2.3,3.7,5.1,6.5]:
    for y in range(-8,9,2):box('walk paving',(x,y,.524),(1.36,1.96,.06),'picketWhite' if (int(y+x)%4==0) else 'sidewalk',bevel=.025)
for y in [-10,10]:
    box('plant bed',(1,y,.37),(16,1.75,.40),'grass',bevel=.10)
    for x in range(-7,10):box('border block',(x,y+(-1 if y<0 else 1)*.88,.38),(.96,.35,.52),'picketWhite',bevel=.07)
for y in [-8.9,8.9]:
    for x in range(-7,10):box('inner curb',(x,y,.36),(.96,.32,.46),'picketWhite',bevel=.05)
for y in [-4,4]:box('ambulance bay line',(9.2,y,.39),(5.5,.13,.028),'schoolBusYellow',bevel=.008)
box('bay end line',(11.8,0,.39),(.13,8,.028),'schoolBusYellow',bevel=.008)
for i in range(7):
    o=box('keep clear hatch',(8.3+i*.48,-5.9,.39),(.11,2.1,.028),'schoolBusYellow',bevel=.006); o.rotation_euler.z=-.5

# Three-storey white masonry mass with teal ribbon band and individual facade panels.
box('main building',(-.25,0,5.03),(7.5,17,9.50),'picketWhite',bevel=.10)
box('foundation',(-.25,0,.75),(7.64,17.14,.62),'sidewalk',bevel=.06)
for z in [3.45,6.25,9.70]:
    box('front course',(3.535,0,z),(.14,17.1,.22),'picketWhite')
    for y in [-8.54,8.54]:box('side course',(-.25,y,z),(7.58,.14,.22),'picketWhite')
box('teal ribbon',(3.58,0,5.14),(.16,17,2.05),'backpackTeal')
for y in [-8.58,8.58]:box('side ribbon',(-.25,y,5.14),(7.45,.16,2.05),'backpackTeal')
# Large name panel left; central risalit carries the unmistakable raised red cross.
box('name panel',(3.64,-3.4,7.90),(.20,10.10,2.84),'picketWhite',bevel=.05)
text('SUNSET GROVE',(3.97,-3.4,8.57),8.4,.59)
text('COMMUNITY HOSPITAL',(3.97,-3.4,7.66),9.1,.57)
box('cross tower',(3.89,3.05,7.02),(.78,3.55,8.29),'picketWhite',bevel=.08)
# Continuous extruded cross outline: no overlapping or coplanar bars.
def cross(name,x,y,z,span,stem,depth,mat):
    h=span/2; t=stem/2
    outline=[(-t,-h),(t,-h),(t,-t),(h,-t),(h,t),(t,t),(t,h),(-t,h),(-t,t),(-h,t),(-h,-t),(-t,-t)]
    verts=[(xx,y+yy,z+zz) for xx in [x-depth/2,x+depth/2] for yy,zz in outline]
    faces=[tuple(reversed(range(12))),tuple(range(12,24))]
    faces += [(i,(i+1)%12,(i+1)%12+12,i+12) for i in range(12)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    return finish(o,name,mat,body,.025)
cross('cross shadow rim',4.42,3.05,8.70,2.64,1.04,.075,'uiDark')
cross('red cross',4.59,3.05,8.70,2.50,.91,.13,'survivorRed')
# Panel joints are inset-color narrow raised beads, >3mm away from underlying wall.
for y in [-7,-5,-3,-1,1,5,7]:
    for z in [1.95,7.84]:box('facade joint',(3.759 if z>7 else 3.516,y,z),(.012,.025,2.35),'sidewalk',bevel=.003)
for z in [4.35,6.55,9.25]:box('tower seam',(4.291,3.05,z),(.014,3.38,.025),'sidewalk',bevel=.003)

# Glazing assemblies: dark recess, teal casing, amber panes and proud mullions.
def window_front(x,y,z,w=1.35,h=1.68,lit=True,parent=body):
    x+=.16
    # Hollow recess rim and separate panes avoid hidden coplanar backing layers.
    for side in [-1,1]:
        box('recess side',(x,y+side*(w/2+.08),z),(.08,.10,h+.20),'uiDark',parent,0)
        box('recess edge',(x,y,z+side*(h/2+.065)),(.08,w+.25,.07),'uiDark',parent,0)
    for lo,hi in [(-w/2+.045,-.045),(.045,w/2-.045)]:
        for bottom,top in [(-h/2+.045,.085),(.175,h/2-.045)]:
            box('glazing pane',(x+.052,y+(lo+hi)/2,z+(bottom+top)/2),(.035,hi-lo,top-bottom),'emi_windowGlow' if lit else 'backpackTeal',parent,.009)
    for yy in [-1,1]:box('window jamb',(x+.090,y+yy*(w+.10)/2,z),(.12,.11,h-.02),'backpackTeal',parent,.018)
    for zz in [-1,1]:box('window rail',(x+.090,y,z+zz*(h+.10)/2),(.12,w+.12,.11),'backpackTeal',parent,.018)
    box('window vertical mullion',(x+.118,y,z),(.11,.065,h),'backpackTeal',parent,.012)
    box('window transom',(x+.118,y,z+.13),(.11,w,.065),'woodWarm',parent,.012)
    box('window sill',(x+.13,y,z-h/2-.14),(.29,w+.35,.13),'sidewalk',parent,.028)
for y in [-7,-3.5,-1.75,0]:window_front(3.70,y,5.14,lit=y!=-1.75)
for y in [6.2,7.65]:
    for z in [5.14,7.84]:window_front(3.56,y,z,w=1.10,h=1.60)
window_front(4.31,3.05,5.30,w=1.68,h=2.78,lit=False)
for y in [-6.7,-4.2,5.8,7.6]:window_front(3.55,y,1.94,w=1.28,h=2.10)
# Side and rear windows use the same finished assembly rotated about each facade point.
for side in [-1,1]:
    for z in [1.95,5.14,7.85]:
        for x in [-2.15,.85]:
            before=len(parts); window_front(0,0,0,1.75,1.72,lit=(x<0 or z<7))
            pivot=Vector((x,side*8.56,z)); angle=side*math.pi/2
            for o in parts[before:]:
                o.location=Vector((math.cos(angle)*o.location.x-math.sin(angle)*o.location.y,math.sin(angle)*o.location.x+math.cos(angle)*o.location.y,o.location.z))+pivot
                o.rotation_euler.z+=angle
for y in [-6,-3,0,3,6]:
    for z in [1.95,5.14,7.85]:
        before=len(parts); window_front(0,0,0,1.35,1.68,lit=z<7)
        for o in parts[before:]:o.location=Vector((-o.location.x-4,-o.location.y+y,o.location.z+z)); o.rotation_euler.z+=math.pi

# Coarse masonry edge scuffs, sparse enough to read as wear rather than noise.
for j in range(32):
    yy=rng.choice([-8.20,-6.9,-4.9,-2.9,1.48,5.05,8.20])+rng.uniform(-.10,.10)
    zz=rng.choice([.91,3.30,6.39,9.12])+rng.uniform(-.15,.15)
    xx=3.91 if zz>7 and yy<1.5 else 3.67
    mesh=bpy.data.meshes.new('masonry scuff')
    w=rng.uniform(.04,.12);h=rng.uniform(.07,.16)
    mesh.from_pydata([(xx,yy-w,zz),(xx,yy+w,zz+.035),(xx,yy,zz+h)],[],[(0,1,2)]);mesh.update()
    o=bpy.data.objects.new('masonry scuff',mesh);bpy.context.collection.objects.link(o);finish(o,'masonry scuff','woodWarm')

# Entrance doors: complete leaves grouped under hinge origin nodes.
box('entry recess',(3.59,-.7,1.9),(.15,3.35,2.72),'uiDark')
for i,y in enumerate([-1.5,.1]):
    hinge=empty('door_'+('L' if i==0 else 'R'),(3.73,y+(-.76 if i==0 else .76),.60),root)
    box('door glass',(3.77,y,1.88),(.10,1.45,2.38),'emi_windowGlow',hinge,.012)
    for yy in [-.74,.74]:box('door stile',(3.85,y+yy,1.88),(.13,.09,2.48),'backpackTeal',hinge,.015)
    for zz in [.67,1.47,2.24,3.09]:box('door rail',(3.85,y,zz),(.13,1.49,.10),'backpackTeal',hinge,.015)
    rod('pull handle',(3.966,y+(.55 if i==0 else -.55),1.33),(3.966,y+(.55 if i==0 else -.55),1.91),.034,'woodWarm',hinge)
box('entry header',(3.81,-.70,3.22),(.22,3.3,.22),'backpackTeal')
# Canopy overhang, tiled rooftop, lip and two substantial square columns.
box('canopy slab',(6,-.70,3.74),(5.15,11.5,.55),'backpackTeal',roof,.08)
for x in [4.1,5.25,6.4,7.55]:
    for y in [-5.6,-4.2,-2.8,-1.4,0,1.4,2.8,4.2]:box('canopy paver',(x,y,4.18),(1.10,1.35,.05),'sidewalk' if int(y*10)%3==0 else 'asphalt',roof,.016)
for y in [-6.42,5.02]:box('canopy side coping',(6,y,4.13),(5.2,.14,.18),'picketWhite',roof)
box('canopy front coping',(8.58,-.70,4.13),(.14,11.58,.18),'picketWhite',roof)
for y in [-5.0,3.65]:
    box('column footing',(8.05,y,.52),(1.43,1.43,.32),'picketWhite',bevel=.065)
    box('column plinth',(8.05,y,.84),(1.10,1.10,.34),'sidewalk',bevel=.045)
    box('canopy pillar',(8.05,y,2.20),(.83,.83,2.50),'picketWhite',bevel=.05)
    box('column capital',(8.05,y,3.39),(1.10,1.10,.30),'picketWhite',bevel=.045)
    for z in [1.41,2.2,2.98]:box('pillar joint',(8.474,y,z),(.012,.75,.025),'sidewalk',bevel=.003)
box('emergency sign backing',(8.66,-.70,3.73),(.12,7.1,.95),'uiDark',roof)
box('emergency sign',(8.91,-.70,3.73),(.12,6.93,.85),'survivorRed',roof,.035)
text('EMERGENCY',(9.15,-.70,3.75),6.45,.62,'picketWhite',roof)
for y in [-4,-.7,2.7]:
    box('downlight casing',(6.9,y,3.42),(.46,.32,.12),'uiDark',roof)
    box('downlight lens',(6.9,y,3.348),(.34,.24,.035),'emi_windowGlow',roof,.014)

# Main roof parapets and purposefully detailed rooftop mechanical plant.
box('roof deck',(-.25,0,9.86),(7.6,17.1,.28),'asphalt',roof,.05)
for x in [-4.04,3.54]:box('parapet',(x,0,10.1),(.24,17.2,.48),'picketWhite',roof,.055)
for y in [-8.55,8.55]:box('parapet',(-.25,y,10.1),(7.6,.24,.48),'picketWhite',roof,.055)
for x,y,w,d,h in [(-1.9,-4.8,2.2,2.6,1.9),(-1.8,4,2.5,2.4,2.3),(.3,5.8,1.8,1.5,3.0),(.7,-1.7,1.9,2.2,1.6)]:
    box('HVAC curb',(x,y,10.1),(w+.25,d+.25,.26),'sidewalk',roof)
    box('HVAC housing',(x,y,10.28+h/2),(w,d,h),'picketWhite',roof,.09)
    box('HVAC grille',(x+w/2+.032,y,10.28+h/2),(.07,d*.76,h*.72),'uiDark',roof,.02)
    for j in range(9):box('HVAC louver',(x+w/2+.08,y,10.28+h*.19+j*h*.07),(.08,d*.70,.055),'backpackTeal',roof,.01)
    box('HVAC cap',(x,y,10.30+h),(w+.14,d+.14,.15),'sidewalk',roof)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=min(w,d)*.32,depth=.06,location=(x,y,10.41+h)); finish(bpy.context.object,'fan well','uiDark',roof)
    for j in range(6):
        o=box('fan blade',(x,y,10.45+h),(min(w,d)*.52,.12,.04),'sidewalk',roof,.015); o.rotation_euler.z=j*math.pi/3
    for yy in [-d*.33,d*.33]:box('service latch',(x+w/2+.10,y+yy,10.28+h*.25),(.04,.08,.14),'woodWarm',roof,.01)
for y in [-6.5,-2.5,1.0,6.5]:
    rod('roof pipe',(-.3,y,10.05),(-.3,y,10.60),.10,'sidewalk',roof)
    rod('pipe bend',(-.3,y,10.60),(.2,y,10.60),.10,'sidewalk',roof)
box('rear service door',(-4.08,0,1.67),(.13,1.50,2.23),'backpackTeal')
for z in [1.4,1.6,1.8,2]:box('service door vent',(-4.155,0,z),(.02,1.08,.045),'uiDark',bevel=.008)

# Freestanding wayfinding sign, its row plates and lettering separated in depth.
for y in [5.8,10.2]:
    box('sign footing',(10.2,y,.38),(.85,.85,.35),'sidewalk')
    box('sign post',(10.2,y,1.60),(.19,.19,2.35),'uiDark')
box('directory frame',(10.20,8,2.25),(.24,5.15,2.75),'sidewalk',bevel=.065)
for z,word,mat in [(3.09,'Main Entrance','backpackTeal'),(2.25,'Emergency','survivorRed'),(1.41,'Patient Services','backpackTeal')]:
    box('directory row',(10.52,8,z),(.055,4.80,.78),mat)
    text(word,(10.75,8.32,z),3.78,.40,'picketWhite')
    box('arrow shaft',(10.75,5.95,z),(.026,.38,.06),'picketWhite',bevel=.003)
    for s in [-1,1]:
        o=box('arrow head',(10.75,5.82,z+s*.075),(.026,.24,.06),'picketWhite',bevel=.003);o.rotation_euler.x=s*.68
for y in [5.6,10.4]:
    for z in [1.02,3.48]:sphere('directory bolt',(10.53,y,z),(.055,.055,.055),'uiDark')

# Landscaping: branched miniature trees, individual clumps, flowers and entry planters.
def plant(x,y,z,scale=1,flower=False):
    for j in range(6):
        ang=j*math.tau/6; px=x+math.cos(ang)*.28*scale; py=y+math.sin(ang)*.28*scale
        sphere('plant leaves',(px,py,z+.25*scale),(.22*scale,.13*scale,.35*scale),'foliage')
        if flower:
            rod('flower stalk',(px,py,z),(px,py,z+.60*scale),.012*scale,'grass',n=6)
            for k in range(5):sphere('flower petal',(px+.075*scale*math.cos(k*math.tau/5),py+.075*scale*math.sin(k*math.tau/5),z+.60*scale),(.07*scale,.07*scale,.065*scale),'survivorRed' if j%2 else 'schoolBusYellow')
            sphere('flower center',(px,py,z+.62*scale),(.05*scale,)*3,'windowGlow')
for x,y in [(1.2,-9.7),(-4,-9.7),(1.0,9.7),(-4.5,9.7)]:
    rod('tree trunk',(x,y,.55),(x,y,4.05),.13,'woodWarm')
    for j in range(7):
        ang=j*2.4; end=(x+math.cos(ang)*.8,y+math.sin(ang)*.8,2.9+j*.32)
        rod('tree branch',(x,y,1.8+j*.22),end,.065,'woodWarm')
        for k in range(6):
            loc=(end[0]+rng.uniform(-.64,.64),end[1]+rng.uniform(-.64,.64),end[2]+rng.uniform(-.40,.65))
            sphere('tree foliage',loc,(.40,.32,.48),'foliage' if k%3 else 'schoolBusYellow',sub=2)
for y in [-10,10]:
    for x in [-6.5,-3,-1,3,5,7,8.7]:plant(x,y,.6,.75,flower=x in [-6.5,3,7])
# Raised landscaped directory island with coarse shrubs and bright flowers.
box('directory garden',(10.45,8,.39),(2.55,5.75,.34),'grass',bevel=.07)
for y in [5.2,6.2,7.2,8.2,9.2,10.2]:box('directory curb',(11.82,y,.40),(.30,.96,.48),'picketWhite',bevel=.06)
for x in [9.5,10.5,11.5]:box('directory garden end',(x,5.02,.40),(.96,.30,.48),'picketWhite',bevel=.06)
for y in [5.55,6.65,7.75,8.85,9.95]:plant(11.25,y,.59,.65,flower=True)
for y in [6.4,8.3,10.0]:plant(9.50,y,.59,.62)
for y in [-3,1.9]:
    box('entry planter',(4.18,y,.79),(.65,.65,.52),'woodWarm',bevel=.06); plant(4.18,y,1.05,.82)
box('garden equipment',(3,-9.7,.99),(1.1,.95,.85),'picketWhite',bevel=.08)
for z in [.76,.88,1.0,1.12,1.24]:box('garden equipment vent',(3.57,-9.7,z),(.04,.66,.05),'uiDark',bevel=.007)

# Merge by material within motion/hide assemblies, preserving required node names.
assemblies=[body,roof,bpy.data.objects['door_L'],bpy.data.objects['door_R']]
def merge_materials():
    for parent in assemblies:
        for mat in M.values():
            obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
            if not obs:continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in obs:o.select_set(True)
            bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=parent.name+'_'+mat.name
            obs[0].data.materials.clear();obs[0].data.materials.append(mat)
            for face in obs[0].data.polygons:face.material_index=0
merge_materials()
for name,loc,parent in [('windows',(3.8,0,5.2),body),('entrance',(6.9,-.7,3.35),roof),('doorL',(3.8,-1.5,1.9),bpy.data.objects['door_L']),('doorR',(3.8,.1,1.9),bpy.data.objects['door_R'])]:
    o=empty('light:'+name,loc,parent);o.rotation_euler=(0,-math.pi/2,0)
    o['ss_light']=json.dumps({'type':'window' if name!='entrance' else 'area','color':'light_window_warm','intensity':2,'range':5,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'hospital','breakable':True,'emissiveNodes':[parent.name+'_emi_windowGlow'],'tiers':'all'})
col=empty('col:building',(-.25,0,5),root); col['collider']='cuboid';col['size']=[7.5,17,9.5]
asset=list(bpy.context.scene.objects); meshes=[o for o in asset if o.type=='MESH']
scene=bpy.context.scene; scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=2403
scene.render.bake.target='VERTEX_COLORS';scene.render.bake.use_clear=True
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr;o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.bake(type='AO')

def triangle_count():
    total=0
    for o in meshes:o.data.calc_loop_triangles();total+=len(o.data.loop_triangles)
    return total
tri=triangle_count()
report={'id':'bld.hospital-exterior','tier':'Hero','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ['root','roof','door_L','door_R','col:building']),'within_budget':tri<=90000 and len(meshes)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Fine weathering and planting density are simplified.','Small directory lettering is not legible in the distant game view.']}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
def build_lod(level):
    """Explicit closed architecture and broad foliage clumps; never collapse walls."""
    b=.014 if level==1 else 0
    def B(name,loc,size,mat,parent=body):return box(name,loc,size,mat,parent,b)
    def Q(name,x,y,z,w,h,mat,parent=body):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,y-w/2,z-h/2),(x,y+w/2,z-h/2),(x,y+w/2,z+h/2),(x,y-w/2,z+h/2)],[],[(0,1,2,3)]);mesh.update()
        o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return finish(o,name,mat,parent)
    B('site',(2,0,.12),(20,22,.24),'asphalt')
    B('walk',(4.5,0,.32),(5.7,18,.36),'sidewalk')
    B('hospital',(-.25,0,5.03),(7.5,17,9.50),'picketWhite')
    B('foundation',(-.25,0,.75),(7.64,17.14,.62),'sidewalk')
    B('teal front',(3.59,0,5.14),(.18,17,2.05),'backpackTeal')
    for y in [-8.6,8.6]:B('teal side',(-.25,y,5.14),(7.45,.20,2.05),'backpackTeal')
    B('name panel',(3.70,-3.4,7.90),(.25,10.10,2.84),'picketWhite')
    B('cross tower',(3.89,3.05,7.02),(.78,3.55,8.29),'picketWhite')
    cross('red cross',4.59,3.05,8.70,2.50,.91,.13,'survivorRed')
    if level==1:
        text('SUNSET GROVE',(3.97,-3.4,8.57),8.4,.59,flat=True)
        text('COMMUNITY HOSPITAL',(3.97,-3.4,7.66),9.1,.57,flat=True)
    def W(x,y,z,w=1.35,h=1.68,lit=True):
        start=len(parts);x+=.16
        # Four independent panes and surrounding frames have no overlapping faces.
        for lo,hi in [(-w/2+.05,-.05),(.05,w/2-.05)]:
            for bottom,top in [(-h/2+.05,.08),(.18,h/2-.05)]:Q('pane',x+.06,y+(lo+hi)/2,z+(bottom+top)/2,hi-lo,top-bottom,'emi_windowGlow' if lit else 'backpackTeal')
        for sign in [-1,1]:
            if level==1:
                box('window jamb',(x+.09,y+sign*(w+.10)/2,z),(.12,.11,h-.02),'backpackTeal',bevel=0)
                box('window rail',(x+.09,y,z+sign*(h+.10)/2),(.12,w+.12,.11),'backpackTeal',bevel=0)
            else:
                Q('window jamb',x+.15,y+sign*(w+.10)/2,z,.11,h-.02,'backpackTeal')
                Q('window rail',x+.15,y,z+sign*(h+.10)/2,w+.12,.11,'backpackTeal')
        Q('window mullion',x+.18,y,z,.06,h,'backpackTeal')
        Q('window transom',x+.18,y,z+.13,w,.06,'woodWarm')
        return parts[start:]
    for y in [-7,-3.5,-1.75,0]:W(3.70,y,5.14,lit=y!=-1.75)
    for y in [6.2,7.65]:
        for z in [5.14,7.84]:W(3.56,y,z,1.1,1.6)
    W(4.31,3.05,5.30,1.68,2.78,False)
    for y in [-6.7,-4.2,5.8,7.6]:W(3.55,y,1.94,1.28,2.1)
    for side in [-1,1]:
        for z in [1.95,5.14,7.85]:
            for x in [-2.15,.85]:
                for o in W(0,0,0,1.75,1.72,lit=x<0 or z<7):
                    transform=Matrix.Translation(Vector((x,side*8.56,z))) @ Matrix.Rotation(side*math.pi/2,4,'Z')
                    o.matrix_world=transform @ o.matrix_world
    for y in [-6,-3,0,3,6]:
        for z in [1.95,5.14,7.85]:
            for o in W(0,0,0,1.35,1.68,lit=z<7):
                transform=Matrix.Translation(Vector((-4,y,z))) @ Matrix.Rotation(math.pi,4,'Z')
                o.matrix_world=transform @ o.matrix_world
    B('canopy',(6,-.70,3.74),(5.15,11.5,.55),'backpackTeal',roof)
    B('canopy top',(6,-.70,4.09),(5.05,11.40,.12),'asphalt',roof)
    for y in [-5,3.65]:
        B('column',(8.05,y,2.18),(.83,.83,2.62),'picketWhite')
        B('column footing',(8.05,y,.59),(1.43,1.43,.40),'picketWhite')
        B('column capital',(8.05,y,3.40),(1.10,1.10,.30),'picketWhite')
    B('emergency panel',(8.91,-.7,3.73),(.12,6.93,.85),'survivorRed',roof)
    if level==1:text('EMERGENCY',(9.15,-.7,3.75),6.45,.62,'picketWhite',roof,flat=True)
    for y in [-4,-.7,2.7]:B('canopy downlight',(6.9,y,3.35),(.34,.24,.05),'emi_windowGlow',roof)
    for y in [-1.5,.1]:
        parent=bpy.data.objects['door_L' if y<0 else 'door_R']
        B('door frame',(3.80,y,1.88),(.12,1.55,2.48),'backpackTeal',parent)
        Q('door pane',4.01,y,1.90,1.33,2.2,'emi_windowGlow',parent)
    B('roof deck',(-.25,0,9.86),(7.6,17.1,.28),'asphalt',roof)
    for x in [-4.04,3.54]:B('parapet',(x,0,10.1),(.24,17.2,.48),'picketWhite',roof)
    for y in [-8.55,8.55]:B('parapet',(-.25,y,10.1),(7.6,.24,.48),'picketWhite',roof)
    for x,y,w,d,h in [(-1.9,-4.8,2.2,2.6,1.9),(-1.8,4,2.5,2.4,2.3),(.3,5.8,1.8,1.5,3),(.7,-1.7,1.9,2.2,1.6)]:
        B('HVAC',(x,y,10.28+h/2),(w,d,h),'picketWhite',roof)
        Q('HVAC grille',x+w/2+.16,y,10.28+h/2,d*.76,h*.72,'uiDark',roof)
        if level==1:
            for j in range(7):B('HVAC louver',(x+w/2+.20,y,10.28+h*.20+j*h*.08),(.08,d*.70,.05),'backpackTeal',roof)
        B('HVAC cap',(x,y,10.30+h),(w+.14,d+.14,.15),'sidewalk',roof)
    for y in [-10,10]:
        B('garden',(1,y,.37),(16,1.75,.4),'grass')
        if level==1:
            for x in range(-7,10):B('curb',(x,y+(-.88 if y<0 else .88),.38),(.96,.35,.52),'picketWhite')
        else:B('curb',(1,y+(-.88 if y<0 else .88),.38),(16.96,.35,.52),'picketWhite')
        for x in [-6,-3,3,6]:sphere('shrub',(x,y,.85),(.5,.4,.5),'foliage')
    B('directory garden',(10.45,8,.39),(2.55,5.75,.34),'grass')
    B('directory curb',(11.82,8,.40),(.3,5.9,.48),'picketWhite')
    B('directory',(10.20,8,2.25),(.24,5.15,2.75),'sidewalk')
    for y in [5.8,10.2]:B('directory post',(10.20,y,1.6),(.19,.19,2.35),'uiDark')
    for z,mat in [(3.09,'backpackTeal'),(2.25,'survivorRed'),(1.41,'backpackTeal')]:
        Q('directory row',10.53,8,z,4.8,.78,mat)
        if level==1:Q('directory text indication',10.75,8.3,z,3.3,.12,'picketWhite')
    for y in [-4,4]:B('bay marking',(9.2,y,.39),(5.5,.13,.028),'schoolBusYellow')
    B('bay end',(11.8,0,.39),(.13,8,.028),'schoolBusYellow')
    local_rng=random.Random(2403)
    for x,y in [(1.2,-9.7),(-4,-9.7),(1,9.7),(-4.5,9.7)]:
        rod('trunk',(x,y,.55),(x,y,4.1),.13,'woodWarm',n=8)
        for j in range(20 if level==1 else 10):
            ang=j*2.4;rr=.6+local_rng.random()*.65
            sphere('foliage clump',(x+math.cos(ang)*rr,y+math.sin(ang)*rr,3.7+local_rng.uniform(-.85,.85)),(.55,.45,.60),'foliage' if j%3 else 'schoolBusYellow')
    merge_materials()

def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type in {'MESH','EMPTY'}:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
if a.glb:
    export(a.glb)
    # Preserve full-resolution assemblies while deriving both LODs independently.
    originals=[(o.name,o.data.copy(),o.parent,o.matrix_world.copy()) for o in meshes]
    lod_stats={}
    for level in [1,2]:
        for o in meshes:bpy.data.objects.remove(o,do_unlink=True)
        parts.clear();build_lod(level);meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        if level==2:
            swaps={'sidewalk':'picketWhite','asphalt':'uiDark','woodWarm':'uiDark','grass':'foliage','windowGlow':'schoolBusYellow'}
            remap={M[k]:M[v] for k,v in swaps.items()}
            for o in meshes:
                mat=o.data.materials[0];o.data.materials[0]=remap.get(mat,mat)
            merge_materials();meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        export(Path(a.glb).with_name('model.lod'+str(level)+'.glb'))
        lod_stats[str(level)]={'triangles':triangle_count(),'draw_calls':len(meshes),'static_draw_calls':sum(o.parent in [body,roof] for o in meshes)}
    # Restore the hero geometry for previews after writing the final LOD.
    for o in meshes:bpy.data.objects.remove(o,do_unlink=True)
    meshes=[]
    for name,data,parent,matrix in originals:
        o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.parent=parent;o.matrix_world=matrix;meshes.append(o)
    (HERE/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2)+'\n')
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.21,.18,.26,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));o=bpy.context.object
    stage=bpy.data.materials.new('stage');stage.diffuse_color=(.075,.065,.085,1);o.data.materials.append(stage)
    for loc,power,size,color in [((14,-13,23),5500,10,(1,.70,.42)),((-7,7,19),3000,12,(.64,.73,1)),((5,12,16),1700,9,(1,.82,.65))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((1,0,4))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;target=Vector((1.5,0,5.5))
    views={'ref':(42,-27,29),'game':(35,-35,43),'front':(45,0,15),'side':(0,-45,17),'rear':(-35,28,25)}
    cam.location=views[a.view];cam.data.type='ORTHO';cam.data.ortho_scale=40 if a.view!='game' else 40
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.render.resolution_x=a.width;scene.render.resolution_y=a.height
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if Path(a.render).name=='hero.png':
        cam.location=views['game'];cam.data.ortho_scale=40
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(HERE/'renders/game.png');bpy.ops.render.render(write_still=True)
    print('RENDER OK')
