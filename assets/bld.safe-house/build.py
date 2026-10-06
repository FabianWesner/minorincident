"""Barricaded Sunset Grove bungalow. Deterministic, texture-free, +X front, metres."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ('render','glb'): p.add_argument('--'+k)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
rng=random.Random(240)
M={}
for token,h in {'asphalt':'695359','sidewalk':'b9a4a0','grass':'6f8f3a','foliage':'7da23c','woodWarm':'99613f','picketWhite':'f2e6dc','brick':'a8483a','survivorRed':'d9363e','schoolBusYellow':'f2b630','uiDark':'25222c','windowGlow':'ffc773'}.items():
    m=bpy.data.materials.new(('emi_' if token=='windowGlow' else 'pal_')+token);m.use_nodes=True
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    rgb=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)
    bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=rgb+(1,);bs.inputs['Roughness'].default_value=.76
    if token=='windowGlow':bs.inputs['Emission Color'].default_value=rgb+(1,);bs.inputs['Emission Strength'].default_value=2.5
    M[token]=m

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc
    if parent:
        bpy.context.view_layer.update();w=o.matrix_world.copy();o.parent=parent;o.matrix_world=w
    return o
root=empty('root');root['asset_id']='bld.safe-house'
body=empty('body',parent=root);roof=empty('roof',parent=root);interior=empty('interior',parent=root)
door=empty('door_front',(2.29,-1.21,.675),root)
def finish(o,name,mat,parent=body,bevel=0):
    o.name=name;o.data.materials.append(M[mat]);bpy.context.view_layer.objects.active=o
    if bevel:
        mod=o.modifiers.new('rounded edges','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update();w=o.matrix_world.copy();o.parent=parent;o.matrix_world=w
    return o

def box(name,loc,size,mat='woodWarm',parent=body,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,min(bevel,min(size)*.38))

def mesh(name,verts,faces,mat,parent=body,bevel=.015):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,mat,parent,bevel)

def beam(name,start,end,width,depth,mat='woodWarm',parent=body):
    v=Vector(end)-Vector(start);o=box(name,(Vector(start)+Vector(end))/2,(width,depth,v.length),mat,parent,.016);o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return o

def blob(name,loc,scale,mat,parent=body,segments=10,rings=5):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat,parent)

def bolt(loc,parent=body):blob('iron nail',loc,(.023,.023,.023),'uiDark',parent,8,4)
# Compact garden kit and stepped stone border.
box('plot',(0,0,.13),(7.9,7,.26),'grass',bevel=.12)
for y in (-3.43,3.43):
    for i in range(13):box('edging',(-3.65+i*.61,y,.20),(.59,.23,.4),'sidewalk',bevel=.045)
for x in (-3.83,3.83):
    for i in range(11):box('edging',(x,-3.12+i*.61,.20),(.23,.59,.4),'sidewalk',bevel=.045)
# Foundation, siding and floor: separated wall slabs leave a functional front door opening.
box('foundation',(-.25,0,.42),(4.85,5.4,.55),'asphalt',bevel=.07)
box('floor',(-.25,0,.69),(4.75,5.25,.12),'woodWarm',interior)
for y in (-2.6,2.6):box('wall',(-.25,y,1.98),(4.8,.14,2.56),'sidewalk')
box('rear wall',(-2.6,0,1.98),(.15,5.25,2.56),'sidewalk')
for cy,sy in ((1.14,3.0),(-1.94,1.45)):
    box('front wall',(2.13,cy,1.98),(.14,sy,2.56),'sidewalk')
box('door lintel',(2.13,-.64,3.12),(.14,1.05,.32),'sidewalk')
for z in [ .82+i*.255 for i in range(10) ]:
    for y in (-2.69,2.69):box('lap siding',(-.25,y,z),(4.8,.045,.236),'sidewalk',bevel=.012)
    for cy,sy in ((1.14,3.0),(-1.94,1.45)):box('lap siding',(2.22,cy,z),(.045,sy,.236),'sidewalk',bevel=.012)
for x in (-2.61,2.2):
    for y in (-2.7,2.7):box('corner trim',(x,y,1.99),(.12,.12,2.65),'picketWhite')
# Gable-end infill and the broad pitched roof; every tile has thickness and distinct proud surface.
for x in (-2.62,2.22):
    verts=[(x-.04,-2.7,3.25),(x-.04,2.7,3.25),(x-.04,0,4.68),(x+.04,-2.7,3.25),(x+.04,2.7,3.25),(x+.04,0,4.68)]
    mesh('gable',verts,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'sidewalk')
angle=math.atan2(1.53,2.95)
for side in (-1,1):
    o=box('roof decking',(-.2,side*1.47,3.91),(5.65,3.33,.13),'asphalt',roof);o.rotation_euler.x=-side*angle
    for row in range(8):
        y=side*(.19+row*.382);z=4.84-abs(y)*math.tan(angle)
        for col in range(12):
            x=-2.78+col*.477+(row%2)*.12
            o=box('shingle',(x,y,z),(.463,.438,.058),'woodWarm' if (row*3+col)%7==0 else 'asphalt',roof,.022);o.rotation_euler.x=-side*angle
    box('eave trim',(-.2,side*3.02,3.21),(5.77,.14,.17),'picketWhite',roof)
for x in (-3.03,2.65):
    for s in (-1,1):beam('gable fascia',(x,0,4.78),(x,s*3.06,3.19),.13,.16,'picketWhite',roof)
for i in range(12):box('ridge cap',(-2.79+i*.47,0,4.8),(.45,.28,.13),'asphalt',roof,.045)
# Lower projecting porch gable is the reference's distinctive second roof plane.
porch_angle=math.atan2(.98,1.63)
for side in (-1,1):
    o=box('porch roof decking',(2.12,-.40+side*.815,3.86),(2.10,1.90,.09),'asphalt',roof);o.rotation_euler.x=-side*porch_angle
    for row in range(5):
        yy=-.40+side*(.16+row*.315);zz=4.41-abs(yy+.40)*math.tan(porch_angle)
        for col in range(5):
            o=box('porch shingle',(1.20+col*.415,yy,zz),(.40,.37,.055),'asphalt' if (row+col)%7 else 'woodWarm',roof,.018);o.rotation_euler.x=-side*porch_angle
    beam('porch rake fascia',(3.20,-.4,4.42),(3.20,-.4+side*1.68,3.40),.13,.16,'picketWhite',roof)
    box('porch eave',(2.12,-.40+side*1.70,3.35),(2.22,.13,.14),'picketWhite',roof)
verts=[(3.12,-2.08,3.37),(3.12,1.28,3.37),(3.12,-.40,4.37),(3.18,-2.08,3.37),(3.18,1.28,3.37),(3.18,-.4,4.37)]
mesh('porch gable',verts,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'sidewalk')
for side in (-1,1):
    box('porch support',(3.03,-.40+side*1.58,2.07),(.13,.13,2.57),'picketWhite')
# Vent and safe-house marker live on the projecting gable, above the entry.
# Brick chimney, bounded purposeful masonry (not a per-brick wall).
box('chimney core',(-1.48,-1.28,4.62),(.7,.74,1.9),'brick',roof)
for row in range(7):
    z=3.86+row*.25
    for side in (-1,1):
        for i in range(2):box('chimney brick',(-1.67+i*.36,-1.28+side*.385,z),(.345,.04,.225),'brick',roof,.018)
        for i in range(2):box('chimney brick',(-1.48+side*.365,-1.48+i*.37,z),(.04,.35,.225),'brick',roof,.018)
box('chimney crown',(-1.48,-1.28,5.51),(.88,.92,.19),'brick',roof,.045)
box('flue',(-1.48,-1.28,5.64),(.44,.48,.10),'asphalt',roof)
# Front windows, boarded aperture, warm adjacent window.
def front_window(y,lit=False):
    box('window inset',(2.26,y,1.96),(.075,1.05,1.38),'uiDark')
    if lit:box('window_front',(2.31,y,1.96),(.035,.87,1.2),'windowGlow')
    for yy in (y-.55,y+.55):box('window stile',(2.37,yy,1.96),(.16,.11,1.55),'picketWhite')
    for z in (1.22,2.71):box('window rail',(2.38,y,z),(.17,1.2,.11),'picketWhite')
    box('window sill',(2.4,y,1.19),(.3,1.27,.12),'picketWhite')
    if lit:
        box('mullion',(2.4,y,1.96),(.10,.065,1.39),'woodWarm')
        box('mullion',(2.4,y,1.96),(.10,1.03,.065),'woodWarm')
    else:
        for z in (1.42,2.50):box('board',(2.49,y,z),(.14,1.25,.23))
        beam('cross board',(2.57,y-.58,1.46),(2.57,y+.58,2.48),.13,.24)
        beam('cross board',(2.73,y-.58,2.44),(2.73,y+.58,1.48),.13,.24)
        for yy in (y-.50,y+.50):
            for z in (1.42,2.5):bolt((2.575,yy,z))
front_window(1.8);front_window(.35,True)
box('entry shadow',(2.22,-.7,1.73),(.08,1.11,2.15),'uiDark')
box('door slab',(2.29,-.7,1.73),(.11,1.02,2.11),'woodWarm',door)
for yy in (-1.25,-.14):box('door frame',(2.38,yy,1.76),(.16,.12,2.25),'picketWhite')
box('door frame',(2.38,-.70,2.86),(.16,1.25,.13),'picketWhite')
for yy in (-1.02,-.72,-.42):box('door plank',(2.37,yy,1.75),(.055,.265,2.01),'woodWarm',door,.012)
for z in (1.02,1.67,2.43):
    box('door barricade',(2.48,-.69,z),(.17,1.26,.23),'woodWarm',door)
    for yy in (-1.19,-.19):bolt((2.58,yy,z),door)
beam('door diagonal',(2.43,-1.1,.92),(2.43,-.22,2.63),.13,.21,'asphalt',door)
blob('door handle',(2.51,-.21,1.83),(.045,.065,.065),'uiDark',door)
# Front gable vent, safe-house plaque.
box('vent backing',(3.22,-.4,3.94),(.07,.46,.50),'uiDark')
for yy in (-.66,-.14):box('vent border',(3.29,yy,3.94),(.12,.07,.56),'picketWhite')
for z in (3.66,4.22):box('vent border',(3.29,-.4,z),(.12,.60,.07),'picketWhite')
for z in (3.76,3.86,3.96,4.06,4.16):box('vent louver',(3.31,-.4,z),(.11,.44,.04),'picketWhite')
mesh('house plaque',[(3.24,-1.15,2.90),(3.24,-.30,2.90),(3.24,-.30,3.20),(3.24,-.72,3.40),(3.24,-1.15,3.20)],[(0,1,2,3,4)],'woodWarm',bevel=0)
mesh('house icon',[(3.27,-.99,3.02),(3.27,-.45,3.02),(3.27,-.45,3.21),(3.27,-.37,3.21),(3.27,-.72,3.36),(3.27,-1.06,3.21),(3.27,-.99,3.21)],[(0,1,2,3,4,5,6)],'uiDark',bevel=0)
# Side boarded windows and proud painted survivor sign.
for x in (-1.25,1.13):
    box('side aperture',(x,-2.75,1.94),(1.10,.06,1.38),'uiDark')
    for xx in (x-.58,x+.58):box('side frame',(xx,-2.80,1.94),(.10,.13,1.56),'picketWhite')
    for z in (1.21,2.71):box('side frame',(x,-2.8,z),(1.23,.13,.1),'picketWhite')
    for z in (1.39,2.48):box('side board',(x,-2.91,z),(1.32,.15,.23))
    beam('side cross',(x-.59,-2.96,1.43),(x+.59,-2.96,2.49),.23,.13)
    beam('side cross',(x+.59,-3.11,1.43),(x-.59,-3.11,2.49),.23,.13)
box('survivor sign',(.15,-3.21,2.0),(2.69,.085,1.53),'picketWhite',bevel=.04)
sign_font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf')
for z,txt in ((2.29,'SURVIVORS'),(1.70,'INSIDE')):
    cu=bpy.data.curves.new('painted letters','FONT');cu.body=txt;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=.46;cu.extrude=.004;cu.resolution_u=2;cu.font=sign_font;cu.size=.76 if txt=='INSIDE' else .57
    o=bpy.data.objects.new('painted '+txt,cu);bpy.context.collection.objects.link(o);o.location=(.15,-3.261,z);o.rotation_euler=(math.pi/2,0,0)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');finish(bpy.context.object,'painted '+txt,'uiDark',bevel=0)
    bpy.context.object.scale.x=(2.37 if txt=='SURVIVORS' else 1.65)/bpy.context.object.dimensions.x
for x in (-1.11,1.41):
    for z in (1.34,2.66):bolt((x,-3.265,z))
# Deck, three steps and rail with joint-like post detail.
box('porch',(2.70,0,.68),(1.04,4.75,.22),'woodWarm')
for y in [-2.2+i*.24 for i in range(19)]:box('deck plank',(2.7,y,.806),(1.05,.22,.045),'woodWarm',bevel=.009)
for i in range(3):box('stair',(3.05+i*.25,-.65,.59-i*.17),(.55,1.46,.20),'sidewalk',bevel=.035)
for y in (-1.46,.17):
    for x,z in ((2.87,1.43),(3.59,.90)):
        box('rail post',(x,y,z-.30),(.115,.115,.72),'picketWhite');box('post cap',(x,y,z+.09),(.17,.17,.10),'picketWhite')
    beam('handrail',(2.84,y,1.56),(3.63,y,1.01),.13,.13,'picketWhite')
    for t in (.25,.5,.75):
        x=2.87+.72*t;top=1.48-.53*t;box('baluster',(x,y,(top+.57)/2),(.07,.07,top-.57),'picketWhite')
# Sandbag stacks: flattened rounded sack forms, tied seams and dark knots.
for region in ('front','side'):
    for row in range(3):
        for col in range(3):
            if region=='front':loc=(2.91, .79+col*.61+(row%2)*.12,.96+row*.27)
            else:loc=(-.91+col*.68+(row%2)*.10,-3.02,.55+row*.27)
            bag=blob('sandbag',loc,(.38,.32,.17),'picketWhite',segments=12,rings=6)
            bag.rotation_euler.z=.10*(col-row)
            for f in bag.data.polygons:f.use_smooth=True
            # Single raised seam rather than a dense wire loop.
            if region=='front':beam('sack seam',(loc[0]+.31,loc[1]-.21,loc[2]-.015),(loc[0]+.31,loc[1]+.21,loc[2]-.015),.014,.014,'sidewalk')
            else:beam('sack seam',(loc[0]-.27,loc[1]-.27,loc[2]-.015),(loc[0]+.27,loc[1]-.27,loc[2]-.015),.014,.014,'sidewalk')
            bolt((loc[0]+.32,loc[1],loc[2]))
# Fence fragments, sparse garden beds and path.
def picket(x,y,h,along='y'):
    w=.19;d=.10;z=.3
    v=[(x+sx*w,y+sy*d,z+zz) for zz in (0,h-.16) for sx,sy in ((-1,-1),(1,-1),(1,1),(-1,1))]+[(x,y-d,z+h),(x,y+d,z+h)]
    mesh('picket',v,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,8),(7,9,6),(4,8,9,7),(5,6,9,8)],'picketWhite')
    bolt((x+w+.006,y,z+h*.5))
for x,ys in ((2.0,[2.76,3.17]),(3.19,[1.55,1.99,2.43]),(2.52,[-3.25,-2.82]),(-1.8,[-3.2,-2.77])):
    for y in ys:picket(x,y,.91+rng.random()*.3)
    for z in (.62,.99):box('fence rail',(x-.06,sum(ys)/len(ys),z),(.10,max(ys)-min(ys)+.36,.09),'picketWhite')
for x in (3.32,3.70):
    for y in (-.99,-.30):box('path paver',(x,y,.30),(.34,.64,.10),'sidewalk',bevel=.035)
# Foliage is deliberately clustered, no dense per-leaf geometry.
for x,y,s in [(-2.7,2.8,.8),(-2.7,-2.75,.75),(-2.1,3.0,.8),(-.5,2.96,.7),(1.0,3.03,.68),(2.0,2.99,.65),(1.85,-2.78,.52),(2.7,-2.1,.5),(-1.8,-3.0,.49),(.3,-3.1,.5),(3.0,2.7,.4)]:
    for k in range(5):
        ang=k*2.4;loc=(x+math.cos(ang)*s*.35,y+math.sin(ang)*s*.35,.5+s*.58+(k%2)*s*.38)
        blob('shrub cluster',loc,(s*.43,s*.40,s*.47),'foliage' if k%2 else 'grass',segments=8,rings=4)
    if x<-2.5:
        for k in range(5):
            ang=k*2.4
            blob('tall shrub',(x+math.cos(ang)*.23,y+math.sin(ang)*.23,1.0+k*.34),(.48,.40,.41),'foliage',segments=8,rings=4)
            blob('golden shrub tips',(x+math.cos(ang)*.48,y+math.sin(ang)*.48,1.25+k*.34),(.16,.16,.23),'schoolBusYellow',segments=6,rings=3)
for x,y,z in [(2.6,-2.1,.55),(1.8,-2.88,.65),(-1.8,-2.95,.75),(2.1,2.9,.65),(.5,2.94,.80),(-2.6,-2.8,1.3),(-2.6,2.8,1.2),(3.2,2.7,.55)]:
    for j in range(9):
        ang=j*2.4;h=z+.12*(j%3)
        o=blob('broad leaf cluster',(x+math.cos(ang)*.32,y+math.sin(ang)*.30,h),(.27,.12,.10),'foliage' if j%4 else 'schoolBusYellow',segments=8,rings=4)
        o.rotation_euler=(0,.4,ang)
for x,y in [(3.38,2.8),(3.60,-2.70),(2.60,2.25),(2.50,-2.31),(1.0,-3.11),(-1.9,-3.08),(3.55,1.15),(-2.3,3.06)]:
    for k in range(3):
        xx=x+rng.uniform(-.22,.22);yy=y+rng.uniform(-.22,.22);z=.46+rng.random()*.16
        beam('flower stalk',(xx,yy,.3),(xx,yy,z),.025,.025,'grass')
        for j in range(5):
            ang=j*math.tau/5;blob('flower petal',(xx+.095*math.cos(ang),yy+.095*math.sin(ang),z),(.095,.055,.042),'schoolBusYellow' if k%2 else 'survivorRed',segments=6,rings=3)
        blob('flower center',(xx,yy,z+.015),(.052,.052,.044),'schoolBusYellow',segments=6,rings=3)
for i in range(26):
    x=rng.uniform(-3.55,3.55);y=rng.choice((-1,1))*rng.uniform(2.9,3.22)
    for k in range(3):beam('weed',(x,y,.28),(x+.13*math.cos(k*2.1),y+.13*math.sin(k*2.1),.48+rng.random()*.08),.045,.065,'grass')
# Runtime anchors; window geometry and door remain separate from static batches.
front=empty('front',(3,0,1),root)
col=empty('col:house',(-.25,0,2),root);col['collider']='cuboid';col['size']=[4.85,5.4,3.8]
light=empty('light:front_window',(2.5,.35,1.96),root)
light.rotation_euler=Vector((1,0,-.4)).to_track_quat('-Z','Y').to_euler()
# Join by material within functional groups. The roof is a single hideable hierarchy.
for parent in (body,roof,interior,door):
    for mat in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='window_front' if mat==M['windowGlow'] else parent.name+'_'+mat.name
light['ss_light']=json.dumps({'type':'window','color':'light_window_warm','intensity':3,'range':4,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','powerGroup':'self','breakable':True,'emissiveNodes':['window_front'],'tiers':'all'})
asset=list(bpy.context.scene.objects);meshes=[o for o in asset if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
for o in meshes:
    o.data.calc_loop_triangles()
tri=sum(len(o.data.loop_triangles) for o in meshes)
report={'id':'bld.safe-house','tier':'Hero','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(n) for n in ('root','roof','interior','door_front','window_front','col:house')),'within_budget':tri<=50000 and len(meshes)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
# Deterministic vertex AO (32 rays), exported as glTF color attributes.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=240;scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    c=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER');o.data.color_attributes.active_color=c;o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.bake(type='AO')
if a.glb:
    def export(path,objects=None):
        bpy.ops.object.select_all(action='DESELECT')
        for o in (asset if objects is None else objects):o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    export(Path(a.glb).resolve())
    saved={o:o.data.copy() for o in meshes}
    for o in meshes:
        o.data=saved[o].copy();bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('LOD reduction','DECIMATE');mod.ratio=.13;bpy.ops.object.modifier_apply(modifier=mod.name)
    export(HERE/'model.lod1.glb')
    for o in meshes:o.data.calc_loop_triangles()
    lod_stats={'1':sum(len(o.data.loop_triangles) for o in meshes)}
    for o in meshes:o.data=saved[o]
    # Authored distant mesh: collapse-decimating disconnected bevels creates spikes.
    before=set(bpy.context.scene.objects)
    def coarse(name,loc,size,mat,parent=body):return box(name,loc,size,mat,parent,0)
    coarse('plot',(0,0,.13),(7.9,7,.26),'grass')
    for y in (-3.43,3.43):coarse('border',(0,y,.20),(7.9,.23,.4),'sidewalk')
    for x in (-3.83,3.83):coarse('border',(x,0,.20),(.23,6.65,.4),'sidewalk')
    coarse('foundation',(-.25,0,.42),(4.85,5.4,.55),'sidewalk')
    for y in (-2.6,2.6):coarse('wall',(-.25,y,1.98),(4.8,.14,2.56),'sidewalk')
    coarse('wall',(-2.6,0,1.98),(.15,5.25,2.56),'sidewalk')
    for cy,sy in ((1.14,3.0),(-1.94,1.45)):coarse('wall',(2.13,cy,1.98),(.14,sy,2.56),'sidewalk')
    coarse('lintel',(2.13,-.64,3.12),(.14,1.05,.32),'sidewalk')
    coarse('floor',(-.25,0,.69),(4.75,5.25,.12),'woodWarm',interior)
    for side in (-1,1):
        o=coarse('main roof',(-.2,side*1.47,3.985),(5.65,3.33,.14),'asphalt',roof);o.rotation_euler.x=-side*angle
        o=coarse('porch roof',(2.12,-.4+side*.815,3.91),(2.10,1.90,.12),'asphalt',roof);o.rotation_euler.x=-side*porch_angle
        coarse('eave trim',(-.2,side*3.02,3.21),(5.77,.13,.15),'picketWhite')
    for x in (-2.62,2.22):
        mesh('gable',[(x,-2.7,3.25),(x,2.7,3.25),(x,0,4.68)],[(0,1,2) if x>0 else (0,2,1)],'sidewalk',bevel=0)
    mesh('porch gable',[(3.18,-2.08,3.37),(3.18,1.28,3.37),(3.18,-.4,4.37)],[(0,1,2)],'sidewalk',bevel=0)
    coarse('chimney',(-1.48,-1.28,4.62),(.7,.74,1.9),'brick',roof)
    coarse('chimney cap',(-1.48,-1.28,5.51),(.88,.92,.19),'brick',roof)
    for y in (1.8,.35):
        coarse('window',(2.26,y,1.96),(.075,1.05,1.38),'uiDark')
        for yy in (y-.55,y+.55):coarse('frame',(2.37,yy,1.96),(.16,.11,1.55),'picketWhite')
        for z in (1.22,2.71):coarse('frame',(2.38,y,z),(.17,1.2,.11),'picketWhite')
    coarse('glow',(2.31,.35,1.96),(.035,.87,1.2),'windowGlow')
    for z in (1.45,2.48):coarse('board',(2.50,1.8,z),(.14,1.25,.23),'woodWarm')
    coarse('door',(2.29,-.7,1.73),(.11,1.02,2.11),'woodWarm',door)
    for z in (1.02,1.67,2.43):coarse('door board',(2.48,-.69,z),(.17,1.26,.23),'woodWarm',door)
    coarse('handle',(2.52,-.21,1.83),(.08,.10,.10),'uiDark',door)
    for x in (-1.25,1.13):
        coarse('side window',(x,-2.76,1.94),(1.1,.08,1.38),'uiDark')
        for z in (1.39,2.48):coarse('board',(x,-2.92,z),(1.32,.15,.23),'woodWarm')
    coarse('survivor sign',(.15,-3.21,2),(2.69,.085,1.53),'picketWhite')
    for z,txt in ((2.29,'SURVIVORS'),(1.70,'INSIDE')):
        bpy.ops.object.select_all(action='DESELECT')
        cu=bpy.data.curves.new('distant paint','FONT');cu.body=txt;cu.font=sign_font;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=.76 if txt=='INSIDE' else .57;cu.resolution_u=1
        o=bpy.data.objects.new('distant paint',cu);bpy.context.collection.objects.link(o);o.location=(.15,-3.261,z);o.rotation_euler=(math.pi/2,0,0);o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
        o=bpy.context.object;finish(o,'distant paint','uiDark');o.scale.x=(2.37 if txt=='SURVIVORS' else 1.65)/o.dimensions.x
    coarse('deck',(2.70,0,.68),(1.04,4.75,.22),'woodWarm')
    for i in range(3):coarse('step',(3.05+i*.25,-.65,.59-i*.17),(.55,1.46,.20),'sidewalk')
    for y in (-1.98,1.18):coarse('porch support',(3.03,y,2.07),(.13,.13,2.57),'picketWhite')
    for y in (-1.46,.17):
        for x,z in ((2.87,1.43),(3.59,.90)):coarse('rail post',(x,y,z-.30),(.115,.115,.72),'picketWhite')
        v=Vector((.79,0,-.55));o=coarse('rail',(3.235,y,1.285),(.13,.13,v.length),'picketWhite');o.rotation_euler=v.to_track_quat('Z','Y').to_euler()
    for x,y,z in [(2.91,1.2,1),(2.91,1.9,1),(2.91,1.3,1.32),(2.91,2,1.32),(-.7,-3.02,.65),(.05,-3.02,.65),(-.7,-3.02,.98),(.05,-3.02,.98)]:
        blob('sack',(x,y,z),(.39,.32,.19),'picketWhite',segments=8,rings=4)
    for x,y,z in [(-2.7,2.8,1.1),(-2.7,-2.75,1.1),(1,3,.7),(2,3,.6),(1.85,-2.78,.7),(2.7,-2.1,.6),(-1.8,-3,.7),(.3,-3.1,.6)]:
        blob('shrub',(x,y,z),(.53,.45,.62),'grass',segments=6,rings=3)
    for x,y in ((2,2.76),(2,3.17),(3.19,1.55),(3.19,1.99),(3.19,2.43),(2.52,-3.25),(2.52,-2.82),(-1.8,-3.2)):
        coarse('picket',(x,y,.9),(.25,.12,1.12),'picketWhite')
    # Preserve the named high-detail objects while reusing their functional parent nodes.
    old_names={o:o.name for o in meshes}
    for o in meshes:o.name='high_'+o.name
    for parent in (body,roof,interior,door):
        for material in M.values():
            obs=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH' and o.parent==parent and o.data.materials[0]==material]
            if not obs:continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in obs:o.select_set(True)
            bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=obs[0];o.name='window_front' if material==M['windowGlow'] else parent.name+'_'+material.name
    coarse_meshes=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in coarse_meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=coarse_meshes[0];bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    for o in coarse_meshes:
        attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
        o.data.color_attributes.active_color=attr
        o.data.calc_loop_triangles()
    visibility={o:o.hide_render for o in meshes}
    for o in meshes:o.hide_render=True
    bpy.context.view_layer.objects.active=coarse_meshes[0];bpy.ops.object.bake(type='AO')
    for o,hidden in visibility.items():o.hide_render=hidden
    lod_stats['2']=sum(len(o.data.loop_triangles) for o in coarse_meshes)
    export(HERE/'model.lod2.glb',[o for o in asset if o.type!='MESH']+coarse_meshes)
    for o in coarse_meshes:bpy.data.objects.remove(o,do_unlink=True)
    for o,name in old_names.items():o.name=name
    (HERE/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2))
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.21,.29,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.04));m=bpy.data.materials.new('studio floor');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.035,.029,.043,1);bpy.context.object.data.materials.append(m)
    for loc,power,size,color in [((5,-7,10),1800,7,(1,.77,.53)),((-4,4,7),1400,6,(.65,.70,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;target=Vector((0,0,2.3))
    cam.location={'ref':(12,-15,10),'game':(12,-12,17),'front':(15,0,6),'side':(0,-15,7),'rear':(-12,14,10)}[a.view]
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=15.7
    scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=(12,-12,17);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        name=Path(a.render).name.replace('-ref','-game') if '-ref' in Path(a.render).name else 'game.png'
        scene.render.filepath=str(Path(a.render).with_name(name).resolve());bpy.ops.render.render(write_still=True)
    print('RENDER OK')
