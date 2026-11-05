"""Deterministic, texture-free Side-tier throwable. Axis +X points to the fuse."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

p=argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view',default='ref',choices=['ref','game','front','side','rear'])
p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
COLORS={'survivorRed':'d9363e','blood':'b3121f','policeBlue':'2f6bff','uiDark':'25222c','sidewalk':'b9a4a0','woodWarm':'b0703f','schoolBusYellow':'f2b630','windowGlow':'ffc773'}
def material(token,emission=0):
    m=bpy.data.materials.new(('emi_' if emission else 'pal_')+token); m.use_nodes=True
    rgb=tuple(int(COLORS[token][i:i+2],16)/255 for i in (0,2,4))
    rgb=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)
    b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=(*rgb,1); b.inputs['Roughness'].default_value=.64
    if emission: b.inputs['Emission Color'].default_value=(*rgb,1); b.inputs['Emission Strength'].default_value=emission
    return m
M={t:material(t) for t in COLORS}; M['spark']=material('windowGlow',12)
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root); root['asset_id']='thr.pipe-bomb'
def mesh(name,verts,faces,mat):
    d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); o.data.materials.append(M[mat]); o.parent=root
    return o
# Profile rings produce deliberately faceted, softly rounded cylinders along X.
def lathe(name,profile,y,z,mat,n=32):
    v=[(x,y+r*math.cos(2*math.pi*j/n),z+r*math.sin(2*math.pi*j/n)) for x,r in profile for j in range(n)]
    f=[tuple(range(n-1,-1,-1)),tuple((len(profile)-1)*n+j for j in range(n))]
    for i in range(len(profile)-1):
        for j in range(n): k=i*n+j; q=i*n+(j+1)%n; f.append((k,q,q+n,k+n))
    return mesh(name,v,f,mat)
Z=.112
for y in [-.066,.066]:
    lathe('red canister',[(-.235,.051),(-.229,.062),(-.214,.068),(.189,.068),(.209,.062),(.214,.050)],y,Z,'survivorRed')
    lathe('end rim',[(-.236,.050),(-.232,.059),(-.221,.061),(-.217,.055)],y,Z,'blood')
    lathe('top rim',[(.195,.062),(.209,.064),(.217,.055),(.218,.048)],y,Z,'survivorRed')
# Wrap the pair with a capsule cross-section; it clears both cylinder surfaces.
def wrap(name,x,width,mat,tilt=0,radius=.078):
    cross=[]
    for cy,start in [(.066,-math.pi/2),(-.066,math.pi/2)]:
        for j in range(17):
            th=start+j*math.pi/16; cross.append((cy+radius*math.cos(th),Z+radius*math.sin(th)))
    n=len(cross); v=[]
    for xx in [x-width/2,x-width/2+.005,x+width/2-.005,x+width/2]:
        for y,z in cross:
            shrink=.003 if xx in [x-width/2,x+width/2] else 0
            cy=.066 if y>=0 else -.066
            v.append((xx+tilt*y,y-shrink*(y-cy)/radius,z-shrink*(z-Z)/radius))
    f=[]
    for i in range(3):
        for j in range(n): f.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    # Inner faces are buried in the cans; end lips are closed to a smaller ring.
    for end in [0,3]:
        offset=len(v)
        for y,z in cross:v.append((v[end*n][0]+tilt*(y-cross[0][0]),y*.96,Z+(z-Z)*.93))
        for j in range(n):f.append((end*n+j,end*n+(j+1)%n,offset+(j+1)%n,offset+j))
    return mesh(name,v,f,mat)
wrap('lower tape band',-.095,.062,'policeBlue')
wrap('upper tape band',.027,.066,'policeBlue')
wrap('diagonal tape overlap',-.031,.031,'policeBlue',-.38,.082)
lathe('fuse collar',[(.173,.043),(.192,.050),(.278,.050),(.285,.042)],0,Z+.052,'uiDark')
lathe('collar raised lip',[(.268,.051),(.277,.055),(.286,.052),(.289,.041)],0,Z+.052,'woodWarm')
lathe('collar bore',[(.293,.035),(.294,.035)],0,Z+.052,'uiDark')
# A curved, segmented fuse with a burn-darkened end.
points=[(.28,0,.164),(.307,0,.17),(.334,0,.187),(.354,0,.214),(.369,0,.246),(.375,0,.271)]
def tube(name,points,r,mat,n=10):
    verts=[]
    for i,pt in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        q=tangent.to_track_quat('Z','Y')
        for j in range(n):verts.append(Vector(pt)+q@Vector((r*math.cos(j*2*math.pi/n),r*math.sin(j*2*math.pi/n),0)))
    faces=[tuple(range(n-1,-1,-1)),tuple((len(points)-1)*n+j for j in range(n))]
    for i in range(len(points)-1):
        for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    return mesh(name,verts,faces,mat)
tube('fuse',points,.009,'woodWarm'); tube('charred fuse tip',points[-2:],.0095,'uiDark')
# Broad irregular paint chips sit 3.5 mm above the cylinder, avoiding decals or textures.
for side,y in enumerate([-.066,.066]):
    for i,(x,th,length) in enumerate([(-.174,2.8,.033),(.126,3.5,.040),(.156,1.7,.023),(-.19,4.3,.024),(.115,4.7,.025)]):
        if side:th+=.6
        corners=[(-.5,-.08),(-.22,-.08),(-.22,-.14),(.43,-.14),(.5,.02),(.18,.02),(.18,.13),(-.5,.13)]
        verts=[(x+u*length,y+.0725*math.cos(th+t),Z+.0725*math.sin(th+t)) for u,t in corners]
        mesh('raised chipped paint',verts,[tuple(range(8))],'sidewalk' if i%2==0 else 'blood')
# Large chipped regions and tape scuffs; all are lifted beyond the 3 mm clearance.
for x,th,length in [(.145,2.45,.046),(-.186,2.3,.038),(.112,1.55,.036)]:
    verts=[(x+u*length,-.066+.0725*math.cos(th+t),Z+.0725*math.sin(th+t)) for u,t in [(-.5,-.17),(-.1,-.17),(-.1,-.06),(.5,-.06),(.5,.10),(.13,.10),(.13,.19),(-.5,.19)]]
    mesh('broad paint loss',verts,[tuple(range(8))],'blood')
for x,th in [(-.096,2.45),(.026,2.9),(-.103,4.0),(.030,1.8)]:
    verts=[(x+u*.025,-.066+.086*math.cos(th+t),Z+.086*math.sin(th+t)) for u,t in [(-.5,-.07),(.1,-.07),(.1,0),(.5,0),(.5,.07),(-.5,.07)]]
    mesh('tape scuff',verts,[tuple(range(6))],'uiDark')
# Small volumetric spark, authored separately so runtime may hide/scale it.
center=Vector(points[-1]); verts=[]; faces=[]
for j in range(12):
    th=2*math.pi*j/12; r=.031 if j%2==0 else .012
    verts.append(center+Vector((r*math.cos(th),-.004,r*math.sin(th))))
verts.extend([center+Vector((0,-.014,0)),center+Vector((0,.010,0))])
for j in range(12):faces.extend([(12,j,(j+1)%12),(13,(j+1)%12,j)])
spark=mesh('fuseSpark',verts,faces,'spark')
bpy.context.scene.cursor.location=center
bpy.ops.object.select_all(action='DESELECT'); spark.select_set(True); bpy.context.view_layer.objects.active=spark; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
# Static meshes are joined by palette identity; the spark remains independent.
for mat in M.values():
    obs=[o for o in bpy.data.objects if o.type=='MESH' and o!=spark and o.data.materials[0]==mat]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name='body' if mat==M['survivorRed'] else 'static_'+mat.name
# Move the asset to ground contact; no hidden floating presentation transform.
minimum=min((o.matrix_world@v.co).z for o in bpy.data.objects if o.type=='MESH' for v in o.data.vertices)
for o in root.children:o.location.z-=minimum
bpy.context.view_layer.update()
grip=bpy.data.objects.new('grip',None); bpy.context.collection.objects.link(grip); grip.parent=root; grip.location=(0,0,Z-minimum)
anchor=bpy.data.objects.new('light:fuse',None); bpy.context.collection.objects.link(anchor); anchor.parent=root; anchor.location=center-Vector((0,0,minimum)); anchor['ss_light']=json.dumps({'type':'point','color':'light_fire','intensity':.2,'range':.35,'pool':False,'beam':'none','flare':True,'reflect':False,'shadow':'none','heroPriority':0,'flicker':'fire','animation':None,'powerGroup':'self','breakable':False,'emissiveNodes':['fuseSpark'],'tiers':'all'})
root['ss_physics']=json.dumps({'class':'light','mass':1.2,'friction':.65,'restitution':.12,'centerOfMass':[0,0,Z-minimum],'pushable':True,'kickable':True,'barricadeValue':0,'barricadeHP':0,'vaultable':True,'flammable':False,'explosive':None,'sounds':'prop.metal-light'})
col=bpy.data.objects.new('col:body',None); bpy.context.collection.objects.link(col); col.parent=root; col.location=(.07,0,.14); col['shape']='cuboid'; col['halfExtents']=[.32,.145,.14]; col['collider']='cuboid'
meshes=[o for o in bpy.data.objects if o.type=='MESH']
# Deterministic 32-direction AO, stored as a glTF vertex color attribute.
bpy.context.view_layer.update()
vertices=[]; polygons=[]
for o in meshes:
    offset=len(vertices); vertices.extend(o.matrix_world@v.co for v in o.data.vertices)
    polygons.extend(tuple(offset+i for i in face.vertices) for face in o.data.polygons)
bvh=BVHTree.FromPolygons(vertices,polygons)
for o in meshes:
    colors=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='POINT')
    o.data.color_attributes.active_color_index=0; o.data.color_attributes.render_color_index=0
    normal_matrix=o.matrix_world.to_3x3().inverted().transposed()
    for v in o.data.vertices:
        n=(normal_matrix@v.normal).normalized()
        tangent=n.cross(Vector((0,0,1)) if abs(n.z)<.9 else Vector((0,1,0))).normalized(); bitangent=n.cross(tangent)
        origin=o.matrix_world@v.co+n*.0006; hits=0
        for j in range(32):
            z=(j+.5)/32; angle=j*2.3999632297; radius=math.sqrt(1-z*z)
            direction=tangent*(radius*math.cos(angle))+bitangent*(radius*math.sin(angle))+n*z
            if bvh.ray_cast(origin,direction,.08)[0] is not None:hits+=1
        ao=1-.5*hits/32; colors.data[v.index].color=(ao,ao,ao,1)
tris=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in meshes)
report={'id':'thr.pipe-bomb','tier':'Side','triangles':tris,'draw_calls':len(meshes),'materials':sorted(set(m.name for o in meshes for m in o.data.materials)),'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ('root','grip','body','fuseSpark','light:fuse','col:body')),'within_budget':tris<=6000 and len(meshes)<=30,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.context.scene.unit_settings.system='METRIC'
if a.glb:
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
    scene.world.color=(.08,.08,.08)
    target=Vector((.04,0,.11))
    def area(loc,energy,color,size):
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=energy; o.data.color=color; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    area((.6,-.8,1.3),12,(1,.76,.56),1.3); area((-.5,.1,.8),9,(.56,.62,1),1)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004)); ground=bpy.context.object
    gm=bpy.data.materials.new('studio'); gm.use_nodes=True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.035,.027,.044,1); ground.data.materials.append(gm)
    bpy.ops.object.camera_add(); cam=bpy.context.object
    dirs={'ref':(.65,-1,.85),'game':(1,-1,1.4),'front':(1,0,.25),'side':(0,-1,.3),'rear':(-1,-1,.4)}
    cam.location=target+Vector(dirs[a.view]).normalized()*2; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=.88; scene.camera=cam
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'
    scene.render.filepath=a.render; bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
