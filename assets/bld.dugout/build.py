"""Reproducible Sunset Grove dugout. +X is the open field/front; metres, Z up."""
import argparse, math, sys, json, random
from array import array
from pathlib import Path
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / 'tools/blender'))
from sslib import ao, palette
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24); p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
p.add_argument('--glb'); p.add_argument('--round', type=int, default=4)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng=random.Random(24)
TOKENS=('asphalt','sidewalk','grass','foliage','woodWarm','picketWhite','brick','survivorRed','backpackTeal','schoolBusYellow','policeBlue','uiDark')
mats={token:palette.mat(token) for token in TOKENS}
for token,m in mats.items():
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=.80; bs.inputs['Specular IOR Level'].default_value=.25
    if token=='asphalt': bs.inputs['Metallic'].default_value=.12

def empty(name,parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=parent; return o
root=empty('root'); root['asset_id']='bld.dugout'; roof=empty('roof',root); interior=empty('interior',root)
front=empty('front',root); front.location=(1.2,0,1.3); front['front']=True
objects=[]
def finish(o,name,mat,parent=None,bevel=0):
    o.name=name; o.data.materials.append(mats[mat]); o.parent=parent or root
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    objects.append(o); return o

def box(name,loc,size,mat,bevel=.025,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size; return finish(o,name,mat,parent,bevel)
def rod(name,start,end,r,mat='asphalt',vertices=6,parent=None):
    d=Vector(end)-Vector(start); bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(Vector(start)+Vector(end))/2)
    o=bpy.context.object; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return finish(o,name,mat,parent)
def sphere(name,loc,scale,mat,parent=None,segments=8,rings=4):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc); o=bpy.context.object; o.scale=scale; return finish(o,name,mat,parent)
def text(name,body,loc,size,mat,side=False):
    c=bpy.data.curves.new(name,'FONT'); c.body=body; c.align_x='CENTER'; c.align_y='CENTER'; c.size=size; c.extrude=0; c.bevel_depth=0; c.resolution_u=3
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.location=loc
    # local text horizontal direction = +Y front, -X on right wall; normal = +X/+Y
    from mathutils import Matrix
    axes=((0,1,0),(0,0,1),(1,0,0)) if not side else ((-1,0,0),(0,0,1),(0,1,0))
    o.rotation_euler=Matrix(axes).transposed().to_euler(); bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object; finish(o,name,mat); o.select_set(False)

# Raised concrete pad and individually bevelled curb stones.
box('foundation',(0,0,.12),(3.7,6.6,.24),'sidewalk',.07)
box('infield sand',(0,0,.247),(3.28,6.18,.045),'woodWarm',.03)
for y in [-3.16,3.16]:
    for j in range(6): box('curb',( -1.52+j*.61,y,.24),(.59,.34,.35),'sidewalk',.055)
for x in [-1.69,1.69]:
    for j in range(10): box('curb',(x,-2.85+j*.63,.24),(.34,.61,.35),'sidewalk',.055)
# Masonry coursing; deep recessed mortar joints, open left side.
for row in range(7):
    z=.46+row*.28
    for j in range(9):
        y=-2.5+j*.6+( .3 if row%2 else 0)
        if y<2.66:
            left=max(-2.78,y-.29); right=min(2.75,y+.29)
            box('rear block',(-1.05,(left+right)/2,z),(.25,right-left,.265),'sidewalk',.018)
    for j in range(4):
        x=-.67+j*.50
        box('end wall block',(x,2.62,z),(.48,.26,.265),'sidewalk',.02)
box('wall cap',(0,2.62,2.34),(2.18,.33,.12),'picketWhite',.025)
# Roof support legs, brackets and visible fasteners.
for x in [-1.05,1.04]:
    for y in [-2.66,2.62]:
        box('steel upright',(x,y,1.68),(.105,.105,2.83),'asphalt',.015)
        box('post foot',(x,y,.35),(.24,.24,.12),'asphalt')
        for z in [2.32,2.87]:
            box('post collar',(x,y,z),(.17,.17,.17),'sidewalk',.014)
            rod('collar bolt',(x+.087,y,z),(x+.106,y,z),.028,'uiDark',6)
for x in [-1.05,1.04]: box('header',(x,-.02,2.97),(.16,5.6,.18),'asphalt',.02,roof)
for y in [-2.65,-1.3,0,1.3,2.65]: box('roof joist',(0,y,2.99),(2.45,.105,.14),'woodWarm',.015,roof)
for j in range(12):
    y=-2.78+j*.505
    o=box('roof panel',(0,y,3.13),(2.65,.491,.115),'asphalt',.025,roof); o.rotation_euler[1]=-.035
    box('standing seam',(0,y-.242,3.2),(2.67,.033,.053),'sidewalk',.013,roof)
for x in [-1.35,1.35]:
    box('roof fascia',(x,0,3.105),(.12,6.05,.18),'asphalt',.022,roof)
    for j in range(12): rod('fascia rivet',(x+(.065 if x>0 else -.065),-2.78+j*.505,3.11),(x+(.08 if x>0 else -.08),-2.78+j*.505,3.11),.022,'schoolBusYellow',6,roof)
for y in [-3.02,3.02]: box('end fascia',(0,y,3.12),(2.8,.12,.18),'sidewalk',.02,roof)
# Rear timber bench with three seat planks, two back planks, and steel trestles.
for y in [-1.9,0,1.9]:
    for x in [-.73,-.18]: rod('bench leg',(x,y,.30),(x+.07,y,.91),.044,parent=interior)
    box('bench foot',(-.42,y,.32),(.85,.13,.065),'asphalt',.016,interior)
    rod('back support',(-.79,y,.80),(-.89,y,1.63),.04,parent=interior)
    rod('bench cross brace',(-.72,y,.42),(-.15,y,.81),.025,parent=interior)
for x in [-.72,-.48,-.24]: box('seat plank',(x,0,.94),(.222,4.83,.09),'woodWarm',.035,interior)
for z in [1.29,1.56]:
    box('back plank',(-.86,0,z),(.10,4.85,.235),'woodWarm',.03,interior)
    for y in [-1.9,0,1.9]: rod('bench bolt',(-.8,y,z),(-.779,y,z),.025,'asphalt',8,interior)
# Front chain-link appearance uses one low-cost diamond ribbon-grid mesh.
fx=1.2; lo=-2.66; hi=.62; bottom=.42; top=2.26
for y in [lo,hi]:
    rod('fence post',(fx,y,.3),(fx,y,2.39),.062,'asphalt',6)
    sphere('post ball',(fx,y,2.4),(.085,.085,.085),'asphalt')
    box('fence concrete footing',(fx,y,.29),(.31,.32,.21),'sidewalk',.035)
    for z in [.51,2.19]: box('fence collar',(fx,y,z),(.15,.15,.13),'sidewalk',.012)
for z in [bottom,top]: rod('fence rail',(fx,lo,z),(fx,hi,z),.033)
def fence_grid(spacing=.24):
    """One mesh of diamond ribbons: textured-look grid without wire cylinders."""
    verts=[]; faces=[]
    for slope in [-1,1]:
        for k in range(-28,30):
            c=k*spacing; pts=[]
            for y in [lo,hi]:
                z=slope*y+c
                if bottom<=z<=top:pts.append((y,z))
            for z in [bottom,top]:
                y=(z-c)/slope
                if lo<=y<=hi:pts.append((y,z))
            if len(pts)<2:continue
            direction=Vector((pts[1][0]-pts[0][0],pts[1][1]-pts[0][1])).normalized()
            normal=Vector((-direction.y,direction.x))*.009
            x=fx+slope*.004
            i=len(verts)
            for point,sign in [(pts[0],-1),(pts[1],-1),(pts[1],1),(pts[0],1)]:
                verts.append((x,point[0]+normal.x*sign,point[1]+normal.y*sign))
            faces.append((i,i+1,i+2,i+3))
    mesh=bpy.data.meshes.new('diamond grid');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('fence grid',mesh);bpy.context.collection.objects.link(o);finish(o,'fence grid','asphalt')
fence_grid()
# League board sits 38mm in front of mesh; letters stand proud.
box('sign border',(1.252,-1.02,1.62),(.066,2.80,.88),'sidewalk',.035)
box('league blue sign',(1.292,-1.02,1.62),(.025,2.73,.81),'policeBlue',.022)
# Navy shade of the policeBlue palette family matches the reference sign.
mats['policeBlue'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.014,.028,.095,1)
text('league name','SUNSET GROVE',(1.312,-.76,1.77),.225,'picketWhite')
text('league subtitle','LITTLE LEAGUE',(1.312,-.76,1.46),.213,'picketWhite')
rod('baseball emblem',(1.31,-2.10,1.63),(1.34,-2.10,1.63),.295,'picketWhite',16)
for sign in [-1,1]:
    for j in range(9):
        z=1.4+j*.055; y=-2.10+sign*(.085+.075*math.sin(j*math.pi/8))
        rod('baseball stitching',(1.347,y-.021,z-.015),(1.347,y+.021,z+.015),.009,'survivorRed',5)
for y in [-2.31,.28]:
    for z in [1.26,1.98]: rod('sign screw',(1.31,y,z),(1.333,y,z),.025,'schoolBusYellow',8)
for i,s in enumerate(['PLAY','STRONGER','TOGETHER']): text('wall motto '+s,s,(.06,2.761,1.91-i*.30),.28,'uiDark',True)
# Bats, duffel, small baseballs inside.
for j in range(3):
    y=2.02+j*.13
    rod('bat barrel',(-.22,y,.44),(-.66,y,1.45),.042,'woodWarm',10,interior)
    rod('bat grip',(-.66,y,1.45),(-.74,y,1.66),.024,'uiDark',8,interior)
    sphere('bat knob',(-.74,y,1.67),(.033,.033,.024),'woodWarm',interior)
box('equipment bag',(.10,1.71,.50),(.55,.61,.38),'asphalt',.10,interior)
rod('bag handle',(.11,1.52,.72),(.11,1.87,.72),.025,'survivorRed',8,interior)
for y in [1.48,1.94]:
    rod('bag end piping',(.405,y,.48),(.424,y,.48),.16,'uiDark',10,interior)
    rod('bag badge',(.429,y,.48),(.439,y,.48),.049,'survivorRed',12,interior)
# Open bin with concentric lip, dark recessed opening and slatted barrel.
x,y=1.01,2.99
rod('bin body',(x,y,.33),(x,y,1.09),.27,'asphalt',12)
for j in range(20):
    t=j*math.tau/20
    rod('bin vertical rib',(x+.269*math.cos(t),y+.269*math.sin(t),.37),(x+.269*math.cos(t),y+.269*math.sin(t),1.06),.014,'sidewalk',6)
for z in [.36,1.04,1.14]:
    bpy.ops.mesh.primitive_torus_add(major_radius=.268,minor_radius=.028,major_segments=12,minor_segments=4,location=(x,y,z)); finish(bpy.context.object,'bin rim','asphalt')
rod('bin dark opening',(x,y,1.08),(x,y,1.095),.24,'uiDark',12)
# Crate with open slats and sports balls.
for z in [.38,.53,.68]:
    for yy in [2.93,3.40]: box('crate slat',(-.03,yy,z),(.65,.055,.115),'woodWarm',.014)
    for xx in [-.35,.29]: box('crate end',(xx,3.16,z),(.055,.50,.115),'schoolBusYellow',.012)
for xx in [-.35,.29]:
    for yy in [2.94,3.38]: box('crate corner',(xx,yy,.52),(.07,.07,.52),'brick',.013)
for j in range(3): sphere('baseball',(-.17+j*.15,3.14,.64),(.079,.079,.079),'picketWhite')
# Purposeful vegetation: bush branches with small faceted leaves, curb grass fans.
def leaf(loc,length,angle,mat):
    x,y,z=loc; d=Vector((math.cos(angle)*length*.52,math.sin(angle)*length*.52,length*.78))
    tangent=Vector((-math.sin(angle),math.cos(angle),0))*length*.14
    verts=[Vector(loc),Vector(loc)+d*.48+tangent,Vector(loc)+d,Vector(loc)+d*.48-tangent,Vector(loc)+d*.48+Vector((0,0,.035))]
    mesh=bpy.data.meshes.new('leaf'); mesh.from_pydata(verts,[],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)]); mesh.update()
    o=bpy.data.objects.new('pointed leaf',mesh); bpy.context.collection.objects.link(o); finish(o,'pointed leaf',mat)
for j in range(30):
    if j<15: x=1.47; y=-2.9+j*.4
    else: x=-1.5; y=-2.9+(j-15)*.4
    for k in range(7): leaf((x+rng.uniform(-.08,.08),y+rng.uniform(-.08,.08),.30),rng.uniform(.20,.45),k*math.tau/7,'grass' if k%2 else 'foliage')
# Broad low-poly foliage clumps replace hundreds of individual leaf spheres.
for j in range(6):
    y=-2.65+j*1.03
    rod('bush trunk',(-1.47,y,.30),(-1.47,y,1.30),.03,'woodWarm',5)
    for k in range(3):
        sphere('bush clump',(-1.47+(-.14 if k%2 else .12),y+(k-1)*.15,.72+k*.32),(.32,.34,.30),'foliage' if k%2 else 'grass',segments=7,rings=3)
if a.round>=2:
    # Wear is real, offset geometry: chips, wood grain strokes, weeds and tiny pebbles.
    for j in range(42):
        y=rng.uniform(-2.35,2.35); z=rng.choice([1.29,1.56])+rng.uniform(-.075,.075)
        rod('wood grain',(-.802,y,z),(-.800,y+.12,z+.008),.005,'uiDark',5,interior)
    for j in range(45):
        x=rng.uniform(-1.4,1.45); y=rng.uniform(-2.85,2.85)
        sphere('infield pebble',(x,y,.285),(.035,.052,.018),'sidewalk' if j%3 else 'asphalt')
    for j in range(18):
        y=-2.6+j*.30
        box('roof edge paint chip',(1.418,y,3.12),(.008,.06,.025),'woodWarm',.004,roof)
if a.round>=3:
    for j in range(8):
        x=1.45; y=-2.7+j*.39
        for k in range(3):
            xx=x+rng.uniform(-.08,.08); yy=y+rng.uniform(-.1,.1); z=.43+rng.uniform(0,.10)
            rod('flower stem',(xx,yy,.29),(xx,yy,z),.007,'grass',5)
            sphere('flower',(xx,yy,z),(.034,.034,.027),'picketWhite')
# Join all immutable geometry by material AND cutaway group. No animated parts exist.
meshes=[]
groups={(parent,token):[o for o in objects if o.parent==parent and o.data.materials[0]==mats[token]] for parent in [root,roof,interior] for token in TOKENS}
for parent in [root,roof,interior]:
    for token in TOKENS:
        group=groups[parent,token]
        if not group: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join(); o=bpy.context.object
        o.name=('shell' if parent==root else parent.name)+'_'+token; meshes.append(o)
for name,loc,size in [('back',(-1.05,0,1.23),(.27,5.5,2.05)),('end',(0,2.62,1.23),(2.2,.29,2.05)),('fence',(1.2,-1.02,1.34),(.13,3.4,1.9))]:
    o=empty('col:'+name,root); o.location=loc; o['collider']='cuboid'; o['size']=list(size)
def build_distant(detail=False):
    """Solid authored LODs retain silhouette and avoid decimation holes."""
    start=len(objects)
    def block(name,loc,size,mat,parent=root):return box(name,loc,size,mat,0,parent)
    block('pad',(0,0,.12),(3.7,6.6,.24),'sidewalk')
    block('sand',(0,0,.25),(3.28,6.18,.04),'woodWarm')
    if detail:
        for y in [-3.16,3.16]:
            for j in range(6):block('curb',(-1.52+j*.61,y,.24),(.59,.34,.35),'sidewalk')
        for x in [-1.69,1.69]:
            for j in range(10):block('curb',(x,-2.85+j*.63,.24),(.34,.61,.35),'sidewalk')
        for row in range(7):
            block('rear course',(-1.05,0,.46+row*.28),(.25,5.5,.265),'sidewalk')
            for j in range(4):block('end block',(-.67+j*.50,2.62,.46+row*.28),(.48,.26,.265),'sidewalk')
    else:
        for y in [-3.16,3.16]:block('curb',(0,y,.24),(3.6,.34,.35),'sidewalk')
        for x in [-1.69,1.69]:block('curb',(x,0,.24),(.34,6.3,.35),'sidewalk')
        block('rear wall',(-1.05,0,1.30),(.25,5.5,1.94),'sidewalk')
        block('end wall',(.08,2.62,1.30),(1.98,.26,1.94),'sidewalk')
    for x in [-1.05,1.04]:
        for y in [-2.66,2.62]:block('post',(x,y,1.68),(.11,.11,2.83),'asphalt')
    block('roof',(0,0,3.13),(2.8,6.05,.15),'asphalt',roof)
    for j in range(12 if detail else 6):block('seam',(0,-2.5+j*(.5 if detail else 1),3.23),(2.8,.035,.045),'sidewalk',roof)
    for y in [-1.9,1.9]:block('bench leg',(-.45,y,.60),(.55,.10,.60),'asphalt',interior)
    block('seat',(-.48,0,.94),(.72,4.83,.09),'woodWarm',interior)
    block('back',(-.86,0,1.42),(.10,4.85,.51),'woodWarm',interior)
    for y in [lo,hi]:rod('fence post',(fx,y,.3),(fx,y,2.4),.062,'asphalt',4)
    for z in [bottom,top]:rod('fence rail',(fx,lo,z),(fx,hi,z),.033,'asphalt',4)
    fence_grid(.34 if detail else .50)
    block('blue sign',(1.292,-1.02,1.62),(.04,2.80,.88),'policeBlue')
    rod('baseball',(1.316,-2.1,1.63),(1.34,-2.1,1.63),.295,'sidewalk',8)
    if detail:
        text('league name','SUNSET GROVE',(1.321,-.76,1.77),.225,'picketWhite')
        text('league subtitle','LITTLE LEAGUE',(1.321,-.76,1.46),.213,'picketWhite')
        for i,word in enumerate(['PLAY','STRONGER','TOGETHER']):text('wall motto '+word,word,(.06,2.761,1.91-i*.30),.28,'uiDark',True)
    else:
        for z in [1.77,1.46]:block('letter band',(1.321,-.76,z),(.012,1.7,.10),'sidewalk')
    rod('bin',(1.01,2.99,.33),(1.01,2.99,1.14),.27,'asphalt',6)
    block('crate',(-.03,3.16,.52),(.65,.50,.52),'woodWarm')
    for y in ([-2.6,-1.6,-.6,.4,1.4,2.4] if detail else [-2.3,0,2.3]):
        sphere('shrub',(-1.47,y,.85),(.32,.55,.60),'foliage',segments=5,rings=3)
    if detail:
        for j in range(15):
            for k in range(3):leaf((1.47,-2.8+j*.4,.30),.32,k*2.1,'foliage')
    result=objects[start:]
    for o in result:
        color=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
        color.data.foreach_set('color',array('f',[1.0])*(len(color.data)*4))
        o.data.color_attributes.active_color=color
    return result

# AO baked to vertex colors before export; lights/camera added only afterwards.
if a.glb:
    assert sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)<=20_000, 'Small shelter triangle budget exceeded'
    assert len(meshes)<=40, 'Draw-call budget exceeded'
    ao.bake_all(meshes,samples=32)
    # glTF normalized bytes preserve baked AO with a quarter of float storage.
    for o in meshes:
        old=o.data.color_attributes['ao']; old.name='ao_float'
        values=array('f',[0.0])*(len(old.data)*4); old.data.foreach_get('color',values)
        packed=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
        packed.data.foreach_set('color',values); o.data.color_attributes.active_color=packed
        o.data.color_attributes.remove(old)
    def export(path, selected_meshes):
        bpy.ops.object.select_all(action='DESELECT')
        for o in bpy.context.scene.objects: o.select_set(o.type=='EMPTY' or o in selected_meshes)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True)
    export(a.glb,meshes)
    for suffix in ['lod1','lod2']:
        variants=build_distant(detail=suffix=='lod1')
        if variants:
            groups={}
            for o in variants: groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
            variants=[]
            for group in groups.values():
                bpy.ops.object.select_all(action='DESELECT')
                for o in group:o.select_set(True)
                bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join()
                variants.append(bpy.context.object)
        export(Path(a.glb).with_name('model.'+suffix+'.glb'),variants)
        for o in variants:
            data=o.data; bpy.data.objects.remove(o,do_unlink=True); bpy.data.meshes.remove(data)
    triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
    (ROOT/'build-stats.json').write_text(json.dumps({'triangles':triangles,'draw_calls':len(meshes),'materials':[m.name for m in mats.values() if m.users],'nodes_ok':True},indent=2))
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.world.color=(.20,.20,.20)
    box('studio floor',(0,0,-.16),(200,200,.25),'uiDark',0)
    def light(name,loc,power,color,size):
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,8),1100,(1,.77,.52),7); light('cool fill',(0,5,6),700,(.57,.68,1),6); light('rim',(-4,-1,5),1200,(1,.71,.39),5)
    bpy.ops.object.camera_add(); cam=bpy.context.object
    views={'ref':(12,8,7),'game':(10,10,14),'front':(12,0,5),'side':(0,12,5),'rear':(-10,-8,7)}
    cam.location=views[a.view]; cam.rotation_euler=(Vector((0,0,1.35))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=11.8 if a.view=='game' else 10.7
    scene.camera=cam; scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.filepath=a.render; bpy.ops.render.render(write_still=True)
print('OK dugout build')
