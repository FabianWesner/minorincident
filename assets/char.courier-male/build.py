"""Hero courier outfit on the unmodified survivor anatomy and rigid joint contract.
Rebuild: python3 experiment/tools/blender_run.py ../assets/char.courier-male assets/char.courier-male/build.py -- --glb assets/char.courier-male/model.raw.glb
+X forward, Z up. Only clothing/accessory meshes change; survivor source is read-only.
"""
from pathlib import Path
import sys, math, json, hashlib
import bpy, bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
SEX = 'male'
ID = 'char.courier-' + SEX
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key)+1] if key in ARGS else default

# Reuse the accepted survivor's exact authored body, proportions and joint locations.
# Stop before its final merge/export so outfit shells can be swapped individually.
source = REPO / ('assets/char.survivor-' + SEX + '/build.py')
marker = '# Simplify the applied smooth surfaces' if SEX == 'female' else '# Merge each rigid part'
text = source.read_text()
assert text.count(marker) == 1
base = {'__file__':str(HERE/'build.py'), '__name__':'courier_survivor_source'}
exec(compile(text.split(marker)[0], str(source), 'exec'), base)
collection = base['asset'] if SEX == 'female' else base['MODEL']
N = base['N']
scene = bpy.context.scene
bpy.context.view_layer.update()
original_pivots = {n:list(o.matrix_world.translation) for n,o in N.items()}
original_parents = {n:o.parent.name if o.parent else None for n,o in N.items()}
rest_matrices = {n:o.matrix_world.copy() for n,o in N.items()}

# Every exported material uses the canonical token value, including the legacy male.
colors = json.loads((REPO/'src/assets/palette.json').read_text())
M = {}
def linear(hexcolor):
    rgb=[int(hexcolor.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
for token,color in colors.items():
    m=bpy.data.materials.get('pal_'+token) or bpy.data.materials.new('pal_'+token)
    m.use_nodes=True
    shader=m.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value=linear(color)
    shader.inputs['Roughness'].default_value=.65
    m.diffuse_color=linear(color)
    m.use_backface_culling=True
    M[token]=m

def color(o, token):
    o.data.materials.clear(); o.data.materials.append(M[token])
def remove(o):
    bpy.data.objects.remove(o,do_unlink=True)
for o in list(collection.objects):
    if o.type!='MESH': continue
    name=o.name
    if o.parent==N['backpackSocket'] or (SEX=='female' and name.startswith(('strap padding','strap adjustment','crown clump','utility tab'))) or (SEX=='male' and name.startswith(('padded_pack','teal_strap','strap_adjuster','strap_stitch','sweatshirt','waist_ribbing','jacket','cream_front','red_front','front_jacket','slash_pocket','pocket_tab','chest_patch','hood','drawstring','cream_upper','cream_fore','red_shoulder','sleeve_fold','charcoal_cuff','cargo_calf','rolled_cuff','sock_shadow','hero_top_tuft','crown_spike'))):
        remove(o); continue
    if SEX=='female':
        if name.startswith(('tee.shell','tee sleeve')): color(o,'orange')
        elif name.startswith(('ribbed neckline','wrist band','sock stripe')): color(o,'backpackTeal')
        elif name.startswith('sneaker upper'): color(o,'picketWhite')
        elif name.startswith(('shoe padded collar','shoe tongue','scrunchie')): color(o,'orange')
    else:
        if name.startswith(('cargo_waist','cargo_thigh','cargo_side','cargo_pocket','belt_loop','fly','slant_pocket')): color(o,'khaki')
        elif name.startswith(('pocket_stitch','waist_seam')): color(o,'khakiSeam')
        elif name.startswith('pocket_snap'): color(o,'brass')
        elif name.startswith('wristband'): color(o,'backpackTeal')
        elif name.startswith('shoe_upper'): color(o,'picketWhite')
        elif name.startswith(('high_top','ankle_collar','tongue_label')): color(o,'orange')
        elif name.startswith('skin_wrist'): color(o,'skinWarm')
        # Keep face and hand geometry, restore the appropriate canonical skin/hair tokens.
        elif o.data.materials[0].name=='pal_infectedSkin': color(o,'skinWarm')
        elif o.data.materials[0].name=='pal_woodWarm': color(o,'hairChestnut')
        elif o.data.materials[0].name=='pal_brick': color(o,'eyeBrown')
        # Neck must follow the head with every facial part.
        if name=='neck':
            world=o.matrix_world.copy(); o.parent=N['head']; o.matrix_world=world
# Higher white sock cuffs are outfit shells; the ankle joint is unchanged.
if SEX=='male':
    for o in collection.objects:
        if o.type=='MESH' and o.name.startswith('cream_sock'):
            inv=o.matrix_world.inverted()
            for v in o.data.vertices:
                p=o.matrix_world@v.co
                p.z=.153+(p.z-.153)*1.85
                v.co=inv@p

# Compress only hidden hair roots above the cap band, preserving bangs/side tufts/tail.
for o in collection.objects:
    if o.type=='MESH' and o.parent==N['head'] and 'hair' in o.data.materials[0].name and 'ponytail' not in o.name:
        inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            p=o.matrix_world@v.co
            rim=1.30 if SEX=='female' else 1.255
            if p.z>rim-.026:
                p.z=rim-.026+(p.z-(rim-.026))*.30
                p.x=min(p.x,.172 if SEX=='female' else .145)
            v.co=inv@p

# Small closed shells, normals explicitly outward; all new geometry authored in world space.
def finish(o,name,token,parent):
    o.name=name
    for c in list(o.users_collection): c.objects.unlink(o)
    collection.objects.link(o)
    color(o,token)
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
    for f in o.data.polygons: f.use_smooth=True
    bpy.context.view_layer.update(); world=o.matrix_world.copy()
    o.parent=N[parent]; o.matrix_world=world
    return o

def box(name,p,size,token,parent,bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p)
    o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Soft sewn edge','BEVEL'); mod.width=min(bevel,min(size)*.45); mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,token,parent)

def ell(name,p,r,token,parent,seg=24,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p)
    o=bpy.context.object; o.scale=r
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,token,parent)

def mesh(name,vertices,faces,token,parent):
    me=bpy.data.meshes.new(name); me.from_pydata(vertices,[],faces); me.update()
    o=bpy.data.objects.new(name,me); collection.objects.link(o)
    return finish(o,name,token,parent)

def tube(name,points,radius,token,parent):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=4
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for b,p in zip(sp.bezier_points,points): b.co=p; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    cu.bevel_depth=radius; cu.bevel_resolution=2
    o=bpy.data.objects.new(name,cu); collection.objects.link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return finish(o,name,token,parent)

def capsule(name,a,b,r0,r1,token,parent,cap_a=True,cap_b=True):
    a,b=Vector(a),Vector(b); axis=(b-a).normalized()
    u=axis.cross(Vector((1,0,0))).normalized(); v=axis.cross(u)
    rings=[]
    if cap_a:
        rings.extend((a-axis*r0*math.sin(t),r0*math.cos(t)) for t in [1.5,1.25,.95,.62,.3])
    rings.extend([(a,r0),(a.lerp(b,.5),(r0+r1)/2),(b,r1)])
    if cap_b:
        rings.extend((b+axis*r1*math.sin(t),r1*math.cos(t)) for t in [.3,.62,.95,1.25,1.5])
    vertices=[];faces=[];segments=24
    for center,radius in rings:
        for j in range(segments):
            angle=math.tau*j/segments
            vertices.append(tuple(center+radius*(u*math.cos(angle)+v*math.sin(angle))))
    for k in range(len(rings)-1):
        for j in range(segments):
            faces.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
    faces.extend([tuple(reversed(range(segments))),tuple(range((len(rings)-1)*segments,len(rings)*segments))])
    return mesh(name,vertices,faces,token,parent)

def ribbon(name,points,width,token,parent,normal=(1,0,0)):
    pts=[Vector(p) for p in points]; normal=Vector(normal); vertices=[]
    for i,p in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        across=tangent.cross(normal).normalized()*width/2
        vertices.extend([tuple(p-across-normal*.005),tuple(p+across-normal*.005),tuple(p-across+normal*.005),tuple(p+across+normal*.005)])
    faces=[]
    for i in range(len(pts)-1):
        a=i*4; b=a+4
        faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    faces.extend([(0,1,3,2),(len(vertices)-4,len(vertices)-2,len(vertices)-1,len(vertices)-3)])
    return mesh(name,vertices,faces,token,parent)

def chevron(name,x,y,z,width,height,token,parent,sign=1):
    # Raised broad V, 4 mm from the fabric/flap. Closed geometry, never a coplanar decal.
    outline=[(-width/2,height/2),(0,-height/2),(width/2,height/2),(width/2,height*.04),(0,-height*.10),(-width/2,height*.04)]
    vertices=[(x+sign*t,y+yy,z+zz) for t in (0,.006) for yy,zz in outline]
    n=len(outline); faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh(name,vertices,faces,token,parent)

# Shirt and collar. Female uses her fitted shell; male replaces the open varsity jacket.
if SEX=='male':
    base['loft']('courier polo',[(0,0,.683,.107,.178),(0,0,.712,.116,.183),(0,0,.80,.111,.178),(0,0,.9,.114,.181),(0,0,.963,.085,.162),(0,0,.995,.055,.09)],'orange','torso',24,1)
    color(bpy.data.objects['courier polo'],'orange')
    tube('white undershirt collar',[(.055,-.067,.982),(.081,0,.970),(.055,.067,.982)],.014,'picketWhite','torso')
    for side,s in [('L',1),('R',-1)]:
        sh=Vector(original_pivots['arm'+side]); el=Vector(original_pivots['foreArm'+side]); wr=Vector(original_pivots['hand'+side])
        capsule('bare upper arm '+side,sh,el,.052,.049,'skinWarm','arm'+side)
        capsule('bare forearm '+side,el,wr,.049,.039,'skinWarm','foreArm'+side)
        capsule('orange sleeve '+side,sh,sh.lerp(el,.38),.081,.077,'orange','arm'+side,cap_b=False)
        capsule('white sleeve hem '+side,sh.lerp(el,.37),sh.lerp(el,.41),.079,.077,'picketWhite','arm'+side,False,False)
        kn=Vector(original_pivots['shin'+side]); an=Vector(original_pivots['foot'+side])
        capsule('bare calf '+side,kn,an,.066,.048,'skinWarm','shin'+side)
        capsule('white courier sock '+side,kn.lerp(an,.53),an,.065,.056,'picketWhite','shin'+side,False,False)
        capsule('teal sock stripe '+side,kn.lerp(an,.56),kn.lerp(an,.61),.065,.063,'backpackTeal','shin'+side,False,False)
        # Existing trousers become shorts at the same knee joint; no rig edits.
        tube('cargo cuff '+side,[(.068,s*.135,.416),(.055,s*.19,.413),(-.035,s*.193,.413),(-.065,s*.135,.416),(-.035,s*.08,.413),(.068,s*.135,.416)],.01,'khakiLight','leg'+side)
else:
    for side,s in [('L',1),('R',-1)]:
        sh=Vector(original_pivots['arm'+side]); el=Vector(original_pivots['foreArm'+side])
        capsule('white sleeve hem '+side,sh.lerp(el,.49),sh.lerp(el,.53),.067,.064,'picketWhite','arm'+side,False,False)

shirtz=.835 if SEX=='female' else .845
shirtx=.106 if SEX=='female' else .122
chevron('chest courier chevron',shirtx,0,shirtz,.13,.065,'picketWhite','torso')
chevron('back courier chevron',-shirtx-.009,0,shirtz+.018,.145,.07,'picketWhite','torso',-1)
# A clean short placket and two small buttons read as a polo without excessive noise.
box('shirt placket',(shirtx+.009,0,shirtz+.102),(.012,.023,.08),'orange','torso',.004)
for z in [shirtz+.11,shirtz+.133]: ell('shirt button',(shirtx+.018,0,z),(.004,.006,.006),'picketWhite','torso',12,8)

# Crown coverage: solid tailored dome, teal side panels, white front and orange back.
# Back notch aligns with the female ponytail root. Scalp remains underneath throughout.
rx,ry = (.259,.275) if SEX=='female' else (.218,.198)
centerx=-.030 if SEX=='female' else -.040
rim=1.297 if SEX=='female' else 1.251
top=1.442 if SEX=='female' else 1.385
segments=48; rows=12; vertices=[]; faces=[]; face_tokens=[]
for k in range(rows+1):
    ph=(.008+(math.pi/2-.008)*k/rows)
    for j in range(segments):
        angle=2*math.pi*j/segments
        vertices.append((centerx+rx*math.sin(ph)*math.cos(angle),ry*math.sin(ph)*math.sin(angle),rim+(top-rim)*math.cos(ph)))
for k in range(rows):
    for j in range(segments):
        angle=2*math.pi*(j+.5)/segments
        if k>=rows-3 and abs(angle-(math.pi+.52 if SEX=='female' else math.pi))<.22: continue
        faces.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
        face_tokens.append('picketWhite' if math.cos(angle)>.45 else ('orange' if math.cos(angle)<-.6 else 'backpackTeal'))
faces.append(tuple(reversed(range(segments)))); face_tokens.append('picketWhite')
o=mesh('courier cap crown',vertices,faces,'picketWhite','head')
o.data.materials.clear()
for t in ['picketWhite','orange','backpackTeal']: o.data.materials.append(M[t])
for p,t in zip(o.data.polygons,face_tokens): p.material_index=['picketWhite','orange','backpackTeal'].index(t)
mod=o.modifiers.new('Cap shell thickness','SOLIDIFY'); mod.thickness=.009
bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
# Forward visor, oval wide enough to frame the preserved face; flattened rounded volume.
ell('orange cap visor',(centerx+rx*.81,0,rim-.012),(rx*.75,ry*.87,.021),'orange','head',48,16)
tube('visor piping',[(centerx+rx*.8, -ry*.85,rim-.010),(centerx+rx*1.40,-ry*.60,rim-.010),(centerx+rx*1.56,0,rim-.010),(centerx+rx*1.40,ry*.60,rim-.010),(centerx+rx*.8,ry*.85,rim-.010)],.006,'schoolBusYellow','head')
ell('cap top button',(centerx,0,top+.005),(.018,.019,.008),'backpackTeal','head',16,8)
# White front panel is nearly vertical at the bottom; cross pieces stand proud of it.
crossz=rim+.053; crossx=centerx+rx*.96+.008
box('medical cross upright',(crossx,0,crossz),(.014,.027,.085),'backpackTeal','head',.004)
box('medical cross crossbar',(crossx+.002,0,crossz),(.014,.080,.026),'backpackTeal','head',.004)
for angle in [-1.12,1.12,2.30,3.97,5.16]:
    points=[]
    for k in range(1,11):
        ph=math.pi/2*k/11
        points.append((centerx+(rx+.005)*math.sin(ph)*math.cos(angle),(ry+.005)*math.sin(ph)*math.sin(angle),rim+(top-rim)*math.cos(ph)+.004))
    tube('cap panel seam',points,.0025,'denimStitch','head')
box('cap back adjuster',(centerx-(rx*.88 if SEX=='female' else rx)-.005,-.136 if SEX=='female' else 0,rim+.005),(.013,.13,.024),'orange','head',.005)
if SEX=='female':
    # The solid nape closes the original scalp shell below the crown and cap opening.
    # Keeps the established ponytail and face; no exposed rear skull.
    ell('covered rear scalp',(-.135,0,1.13),(.112,.221,.15),'hairChestnut','head',32,20)
    for y in [-.14,-.07,0,.07,.14]:
        tube('nape hair groove',[(-.247,y,1.24),(-.252,y*1.02,1.15),(-.23,y*.94,1.055)],.006,'hairWarm','head')

# Messenger bag: broad, low, asymmetric pouch fixed to the original backpackSocket.
# The strap runs shoulder -> opposite hip on both front and back, staying with torso.
bx,by,bz = (-.176,-.113,.654) if SEX=='female' else (-.196,-.123,.697)
bw,bh=(.26,.235) if SEX=='female' else (.29,.25)
box('messenger padded body',(bx,by,bz),(.136,bw,bh),'backpackTeal','backpackSocket',.033)
box('messenger side gusset',(bx+.012,by,bz-.013),(.142,bw-.012,bh-.027),'tealDark','backpackSocket',.025)
flapx=bx-.08
box('messenger flap',(flapx,by,bz+.035),(.032,bw-.009,bh*.68),'tealLight','backpackSocket',.018)
chevron('bag orange chevron',flapx-.022,by,bz+.031,bw*.60,.074,'orange','backpackSocket',-1)
chevron('bag white chevron',flapx-.030,by,bz+.009,bw*.38,.038,'picketWhite','backpackSocket',-1)
tube('messenger flap piping',[(flapx-.018,by-bw*.43,bz+.099),(flapx-.018,by-bw*.44,bz-.039),(flapx-.018,by+bw*.44,bz-.039),(flapx-.018,by+bw*.43,bz+.099)],.003,'backpackTeal','backpackSocket')
box('bag clasp',(flapx-.028,by,bz-.052),(.016,.033,.025),'brass','backpackSocket',.004)
for s in [-1,1]:
    box('bag strap tab',(bx,by+s*bw*.49,bz+.083),(.041,.016,.057),'orange','backpackSocket',.005)
frontx=.13 if SEX=='female' else .15
shoulder=.967 if SEX=='female' else 1.006
ribbon('messenger diagonal strap front',[(.009,.147,shoulder),(frontx,.122,shoulder-.066),(frontx+.005,.053,shoulder-.143),(frontx+.006,-.055,shoulder-.238),(.088,-.165,shoulder-.310),(-.030,-.203,bz+.077)],.046,'tealDark','torso')
ribbon('messenger diagonal strap back',[(-.176,.120,shoulder-.018),(-.154,.070,shoulder-.086),(-.143,-.018,shoulder-.178),(-.142,-.100,shoulder-.269),(bx,-.179,bz+.089)],.042,'tealDark','torso',(-1,0,0))
box('strap slider',(frontx+.014,.06,shoulder-.146),(.017,.054,.030),'brass','torso',.005)

# Store exact rest-world extents for the closed distant proxies before merging details.
proxy_bounds={}
for o in collection.objects:
    if o.type!='MESH':continue
    points=[o.matrix_world@Vector(corner) for corner in o.bound_box]
    proxy_bounds[o.name]=[tuple(min(p[i] for p in points) for i in range(3)),tuple(max(p[i] for p in points) for i in range(3))]

# Verify preservation before consolidating shells, then apply triangles/clean normals.
bpy.context.view_layer.update()
assert all((N[n].matrix_world.translation-Vector(p)).length<1e-7 for n,p in original_pivots.items())
assert {n:o.parent.name if o.parent else None for n,o in N.items()}==original_parents
N['root']['asset_id']=ID; N['root']['forward']='+X'; N['root']['outfit']='courier'
for o in list(collection.objects):
    if o.type!='MESH': continue
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP')
    bad=[f for f in bm.faces if f.calc_area()<1e-12]
    if bad: bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY')
    bm.to_mesh(o.data); bm.free(); o.data.update()
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles)>400:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Hero surface budget','DECIMATE'); mod.ratio=.88 if 'face' in o.name else .72
        bpy.ops.object.modifier_apply(modifier=mod.name)
# Keep one mesh per pivot with material primitives, never join across animation nodes.
for name,parent in N.items():
    parts=[o for o in list(collection.objects) if o.type=='MESH' and o.parent==parent]
    if not parts: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1: bpy.ops.object.join()
    o=bpy.context.object; o.name=name+'_geometry'
    o['rigid_part']=name
bpy.context.view_layer.update()
meshes=[o for o in collection.objects if o.type=='MESH']
for o in meshes: o.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in meshes)
assert triangles<=60000,triangles
report={'id':ID,'triangles':triangles,'meshes':len(meshes),'nodes_ok':True,'missing_nodes':[], 'source':str(source.relative_to(REPO)), 'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'joint_preservation':True, 'backface_culling':True, 'pivots':original_pivots}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',ID,triangles)
if arg('--glb'):
    # Bake AO on the final shells in deterministic CPU Cycles; previews remain Eevee.
    sys.path.insert(0,str(REPO/'tools/blender'))
    from sslib import ao
    ao.bake_all(meshes,samples=32)
    bpy.ops.object.select_all(action='DESELECT')
    for o in collection.objects: o.select_set(True)
    output=Path(arg('--glb')).resolve(); output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=False)
    print('GLB OK',output)

if arg('--render'):
    if arg('--view')=='pose':
        N['armL'].rotation_euler.x=math.radians(55)
        N['foreArmL'].rotation_euler.y=math.radians(-65)
        N['legR'].rotation_euler.y=math.radians(-24)
        N['head'].rotation_euler.z=math.radians(-18)
    world=bpy.data.worlds.new('Courier morning studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.11,.13,.17,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    target=Vector((-.025,0,.72))
    for name,pos,power,size,tint in [('Key',(3,-4,5),430,4,(1,.84,.70)),('Fill',(1,4,3),260,3,(.73,.83,1)),('Rim',(-3,-1,4),420,3,(1,.69,.41))]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.size=size; data.color=tint
        o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); o.location=pos; o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=2000,location=(0,0,-.004))
    floor=bpy.context.object; floor.name='Studio floor'
    mat=bpy.data.materials.new('Studio slate'); mat.use_nodes=True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.036,.032,.048,1)
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
    floor.data.materials.append(mat)
    camera=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera')); scene.collection.objects.link(camera); scene.camera=camera
    directions={'front':(6,0,.08),'side':(0,-6,.08),'back':(-6,0,.08),'ref':(5,-4,2.5),'game':(5,-5,5),'top':(.01,0,6),'pose':(5,-4,3)}
    camera.location=target+Vector(directions['ref' if arg('--view')=='all' else arg('--view','game')]); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    scene.render.resolution_x=int(arg('--width',960)); scene.render.resolution_y=int(arg('--height',540)); scene.render.resolution_percentage=100
    camera.data.ortho_scale=1.72*scene.render.resolution_x/scene.render.resolution_y
    scene.render.engine='BLENDER_EEVEE'
    scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
    scene.view_settings.view_transform='Khronos PBR Neutral'; scene.view_settings.exposure=-.5
    scene.render.filepath=str(Path(arg('--render')).resolve()); Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    if hasattr(scene.eevee,'taa_render_samples'): scene.eevee.taa_render_samples=int(arg('--samples',96))
    render_path=Path(scene.render.filepath)
    views=['ref','front','side','back','game','top','pose'] if arg('--view')=='all' else [arg('--view','game')]
    for view in views:
        if view=='pose':
            N['armL'].rotation_euler.x=math.radians(55)
            N['foreArmL'].rotation_euler.y=math.radians(-65)
            N['legR'].rotation_euler.y=math.radians(-24)
            N['head'].rotation_euler.z=math.radians(-18)
        camera.location=target+Vector(directions[view]); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=(6.2 if view=='game' else 1.72)*scene.render.resolution_x/scene.render.resolution_y
        scene.render.filepath=str(render_path if len(views)==1 else render_path.parent/('hero.png' if view=='ref' else ('pose-test.png' if view=='pose' else view+'.png')))
        bpy.ops.render.render(write_still=True)
        print('RENDER OK',scene.render.filepath)

# Authored distant tier: closed silhouette proxies, retaining every original rig node.
# A 3% collapse of many garment/decal shells creates torn single-sided surfaces;
# simple closed solids keep the courier identity and correct motion at >30 m.
def build_lod(detail,output_path):
    for n,o in N.items():
        o.matrix_world=rest_matrices[n]
        bpy.context.view_layer.update()
    for o in list(collection.objects):
        if o.type=='MESH': remove(o)
    def bounds(names):
        found=[proxy_bounds[n] for n in proxy_bounds if any(n.startswith(k) for k in names)]
        assert found,names
        lo=Vector(tuple(min(b[0][i] for b in found) for i in range(3)))
        hi=Vector(tuple(max(b[1][i] for b in found) for i in range(3)))
        return (lo+hi)/2,hi-lo
    def proxyell(name,p,r,token,parent,seg=12,rings=6):
        if detail:
            if 'face' in name:seg,rings=(24,12 if SEX=='female' else 14)
            elif 'eye' in name:seg,rings=(12 if SEX=='female' else 16,8)
            elif 'hair' in name:seg,rings=20,10
            elif 'ponytail' in name:seg,rings=16,10
            elif 'hand' in name:seg,rings=12,8
            elif 'visor' in name:seg,rings=16,6
            elif 'shorts' in name:seg,rings=16,6
            else:seg,rings=12,6
        return ell(name,p,r,token,parent,seg,rings)
    def lowbox(name,p,size,token,parent):
        bpy.ops.mesh.primitive_cube_add(size=1,location=p)
        o=bpy.context.object;o.scale=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        if not any(t in name for t in ['cross','accent','flap','pocket']):
            mod=o.modifiers.new('Distant soft corners','BEVEL');mod.width=min(size)*.16;mod.segments=2 if detail else 1
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return finish(o,name,token,parent)
    def lowlimb(name,a,b,r0,r1,token,parent):
        a,b=Vector(a),Vector(b);d=b-a
        bpy.ops.mesh.primitive_cone_add(vertices=14 if detail else 6,radius1=r0,radius2=r1,depth=d.length,location=(a+b)/2)
        o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
        return finish(o,name,token,parent)
    # Exact source face extent and eye placement; every proxy remains below head.
    p,size=bounds(['face sculpt' if SEX=='female' else 'sculpted_face'])
    proxyell('distant face',p,size/2,'skinWarm','head',12,4)
    eyes=[n for n in proxy_bounds if n.startswith('eye sclera' if SEX=='female' else 'eye_white')]
    for n in eyes:
        lo,hi=proxy_bounds[n];p=(Vector(lo)+Vector(hi))/2;r=(Vector(hi)-Vector(lo))/2
        # Bold dark eyes remain visible at distance; no thin isolated lash ribbons.
        proxyell('distant eye',p+Vector((.006,0,0)),(.008,r.y*.9,r.z*.9),'picketWhite' if detail else 'eyeBrown','head',6,4)
        if detail:proxyell('distant eye iris',p+Vector((.015,0,0)),(.005,r.y*.67,r.z*.76),'eyeBrown','head',6,4)
    p,size=bounds(['nose tip' if SEX=='female' else 'nose_tip'])
    proxyell('distant nose',p,size/2,'skinWarm','head',6,4)
    p,size=bounds(['neck']);proxyell('distant neck',p,size/2,'skinWarm','head',8,4)
    if detail:
        for name in (['ear','ear.001'] if SEX=='female' else ['ear-1','ear1']):
            lo,hi=proxy_bounds[name];proxyell('distant ear',(Vector(lo)+Vector(hi))/2,(Vector(hi)-Vector(lo))/2,'skinWarm','head')
        for name in proxy_bounds:
            if name.startswith('brow'):
                lo,hi=proxy_bounds[name];lowbox('distant brow',(Vector(lo)+Vector(hi))/2,(Vector(hi)-Vector(lo)),'hairChestnut','head')
    # Closed hair volume under the cap; female tail keeps its original complete extent.
    if SEX=='female':
        proxyell('distant rear hair',(-.135,0,1.13),(.112,.221,.15),'hairChestnut','head',8,4)
        p,size=bounds(['ponytail lock']);proxyell('distant ponytail',p,size/2,'hairChestnut','head',8,4)
    else:
        p,size=bounds(['hair_cap']);proxyell('distant hair',p,size/2,'hairChestnut','head',8,4)
    # Closed dome; front white, sides teal and back orange. No narrow shell or notch.
    vertices=[(centerx,0,top)];faces=[];tokens=[];seg=24 if detail else 12;rows=6 if detail else 3
    for k in range(1,rows+1):
        ph=math.pi/2*k/rows
        for j in range(seg):
            a=math.tau*j/seg
            vertices.append((centerx+rx*math.sin(ph)*math.cos(a),ry*math.sin(ph)*math.sin(a),rim+(top-rim)*math.cos(ph)))
    for j in range(seg):
        faces.append((0,1+j,1+(j+1)%seg));tokens.append(j)
    for k in range(rows-1):
        for j in range(seg):
            a=1+k*seg+j;b=1+k*seg+(j+1)%seg
            faces.append((a,b,b+seg,a+seg));tokens.append(j)
    faces.append(tuple(reversed(range(1+(rows-1)*seg,1+rows*seg))));tokens.append(0)
    o=mesh('distant closed cap',vertices,faces,'picketWhite','head')
    for t in ['backpackTeal','orange']:o.data.materials.append(M[t])
    for face,j in zip(o.data.polygons,tokens):
        cosine=math.cos(math.tau*(j+.5)/seg)
        face.material_index=0 if cosine>.45 else (2 if cosine<-.6 else 1)
    proxyell('distant visor',(centerx+rx*.81,0,rim-.012),(rx*.75,ry*.87,.021),'orange','head',12,4)
    lowbox('distant cross upright',(crossx,0,crossz),(.014,.027,.085),'backpackTeal','head')
    lowbox('distant cross bar',(crossx+.002,0,crossz),(.014,.080,.026),'backpackTeal','head')
    p,size=bounds(['tee.shell' if SEX=='female' else 'courier polo'])
    lowbox('distant orange shirt',p,size,'orange','torso')
    p,size=bounds(['shorts seat' if SEX=='female' else 'cargo_waist'])
    if SEX=='female':lowbox('distant shorts seat',p,Vector((size.x,size.y*1.15,size.z)),'denim','hip')
    else:proxyell('distant shorts seat',p,size/2,'khaki','hip',8,4)
    for side,s in [('L',1),('R',-1)]:
        sh=Vector(original_pivots['arm'+side]);el=Vector(original_pivots['foreArm'+side]);wr=Vector(original_pivots['hand'+side])
        lowlimb('distant upper arm '+side,sh,el,.051,.044,'skinWarm','arm'+side)
        lowlimb('distant sleeve '+side,sh,sh.lerp(el,.43),.071 if SEX=='female' else .081,.065 if SEX=='female' else .077,'orange','arm'+side)
        lowlimb('distant forearm '+side,el,wr,.044,.038,'skinWarm','foreArm'+side)
        lowlimb('distant wristband '+side,el.lerp(wr,.82),el.lerp(wr,.94),.048,.044,'backpackTeal','foreArm'+side)
        p,size=bounds(['palm '+side,'fingers '+side,'thumb '+side] if SEX=='female' else ['palm'+side,'knuckle'+side,'curled_finger'+side,'thumb'+side])
        proxyell('distant hand '+side,p,size/2,'skinWarm','hand'+side,8,4)
        hp=Vector(original_pivots['leg'+side]);kn=Vector(original_pivots['shin'+side]);an=Vector(original_pivots['foot'+side])
        lowlimb('distant thigh '+side,hp,kn,.067,.056,'skinWarm','leg'+side)
        lowlimb('distant shorts '+side,hp,hp.lerp(kn,.49) if SEX=='female' else kn,.09,.087 if SEX=='female' else .074,'denim' if SEX=='female' else 'khaki','leg'+side)
        lowlimb('distant calf '+side,kn,an,.056 if SEX=='female' else .066,.045 if SEX=='female' else .048,'skinWarm','shin'+side)
        lowlimb('distant sock '+side,kn.lerp(an,.52),an,.058 if SEX=='female' else .065,.052 if SEX=='female' else .056,'picketWhite','shin'+side)
        p,size=bounds(['sole '+side,'sneaker upper '+side,'shoe padded collar '+side] if SEX=='female' else ['sneaker_sole'+side,'shoe_upper'+side,'high_top'+side])
        lowbox('distant sneaker '+side,p,size,'picketWhite','foot'+side)
        lowbox('distant shoe accent '+side,p+Vector((-size.x*.35,0,size.z*.28)),(size.x*.22,size.y*.96,size.z*.30),'orange','foot'+side)
        if SEX=='male':
            p,size=bounds(['cargo_side_pouch'+side]);lowbox('distant cargo pocket '+side,p,size,'khakiLight','leg'+side)
    lowbox('distant messenger bag',(bx,by,bz),(.136,bw,bh),'backpackTeal','backpackSocket').name='backpackSocket_geometry'
    lowbox('distant bag flap',(flapx,by,bz+.035),(.032,bw-.009,bh*.68),'tealLight','backpackSocket')
    chevron('distant bag chevron',flapx-.022,by,bz+.031,bw*.60,.074,'orange','backpackSocket',-1)
    ribbon('distant diagonal strap',[(.009,.147,shoulder),(frontx,.122,shoulder-.066),(frontx+.006,-.055,shoulder-.238),(.088,-.165,shoulder-.310),(-.030,-.203,bz+.077)],.046,'tealDark','torso')
    chevron('distant shirt chevron',shirtx+.004,0,shirtz,.13,.065,'picketWhite','torso')
    lowmeshes=[o for o in collection.objects if o.type=='MESH']
    for o in lowmeshes:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces))
        bad=[f for f in bm.faces if f.calc_area()<1e-12]
        if bad:bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY')
        bm.to_mesh(o.data);bm.free()
    sys.path.insert(0,str(REPO/'tools/blender'))
    from sslib import ao
    ao.bake_all(lowmeshes,samples=32)
    bpy.ops.object.select_all(action='DESELECT')
    for o in collection.objects:o.select_set(True)
    output=Path(output_path).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=False)
    print('LOD1 OK' if detail else 'LOD2 OK',output)

if arg('--lod1'):build_lod(True,arg('--lod1'))
if arg('--lod2'):build_lod(False,arg('--lod2'))
