"""Old three-seat sofa. Deterministic palette geometry, metres, +X seating front."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(OUT.parents[1]/'tools/blender'))
from sslib import palette, ao
p=argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view',default='ref')
p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng=random.Random(27)
mats=[palette.mat(t) for t in ['hairCopper','hairAuburn','leatherShadow','woodWarm','khaki','hairShadow']]
for m in mats:m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.88
wear_regions=[]
def box(name,pos,size,bevel,mat,segments=5):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Soft upholstery','BEVEL'); b.width=bevel; b.segments=segments
    bpy.ops.object.modifier_apply(modifier=b.name)
    o.data.materials.append(mat)
    if 'cushion' in name:
        for shade in [mats[1],mats[2],mats[3]]:o.data.materials.append(shade)
        bm=bmesh.new(); bm.from_mesh(o.data)
        faces=[f for f in bm.faces if f.calc_area()>.045 and (f.normal.x>.99 or ('Seat' in name and f.normal.z>.99))]
        edges=sorted({e for f in faces for e in f.edges},key=lambda e:e.index)
        bmesh.ops.subdivide_edges(bm,edges=edges,cuts=3,use_grid_fill=True)
        for v in bm.verts:
            if abs(v.co.x-size[0]/2)<.0001 and abs(v.co.y)<size[1]/2-.09 and abs(v.co.z)<size[2]/2-.09:
                v.co.y+=rng.uniform(-.025,.025); v.co.z+=rng.uniform(-.02,.02)
            elif 'Seat' in name and abs(v.co.z-size[2]/2)<.0001 and abs(v.co.x)<size[0]/2-.09 and abs(v.co.y)<size[1]/2-.09:
                v.co.x+=rng.uniform(-.03,.03); v.co.y+=rng.uniform(-.025,.025)
        faces=[f for f in bm.faces if f.normal.x>.99 or ('Seat' in name and f.normal.z>.99)]
        bmesh.ops.triangulate(bm,faces=faces)
        for f in bm.faces:
            if f.normal.x>.99 or ('Seat' in name and f.normal.z>.99):f.material_index=rng.choices([0,1,2,3],[65,16,18,1])[0]
        bm.to_mesh(o.data); bm.free(); o.data.update()
    for face in o.data.polygons:face.use_smooth=True
    norm=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); norm.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=norm.name)
    return o

def tube(name,points,radius,mat):
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'; curve.resolution_u=1
    curve.bevel_depth=radius; curve.bevel_resolution=0
    s=curve.splines.new('POLY'); s.points.add(len(points)-1)
    for v,pt in zip(s.points,points):v.co=(*pt,1)
    o=bpy.data.objects.new(name,curve); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object; o.data.materials.append(mat); o.select_set(False)
    return o

def rim(name,center,w,h,r,plane,mat):
    pts=[]
    for u,v,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(7):
            t=math.radians(start+i*90/6); q=(u+r*math.cos(t),v+r*math.sin(t))
            pts.append((center[0],center[1]+q[0],center[2]+q[1]) if plane=='front' else (center[0]+q[1],center[1]+q[0],center[2]))
    pts.append(pts[0]); tube(name,pts,.009,mat)

def patch(center,sx,sy,plane,mat):
    # Irregular raised leather wear, all faces at least 6mm clear of underlying planes.
    bounds=(center, sx, sy, plane)
    for c, w, h, face in wear_regions:
        if face!=plane:continue
        depth_axis={'front':0,'top':2,'side':1}[plane]
        if abs(c[depth_axis]-center[depth_axis])>.025:continue
        u,v={'front':(1,2),'top':(1,0),'side':(0,2)}[plane]
        if abs(c[u]-center[u])<w+sx+.008 and abs(c[v]-center[v])<h+sy+.008:return
    wear_regions.append(bounds)
    n=rng.randint(5,8); verts=[]
    for i in range(n):
        t=i*2*math.pi/n; u=math.cos(t)*sx*rng.uniform(.65,1); v=math.sin(t)*sy*rng.uniform(.65,1)
        verts.append((center[0],center[1]+u,center[2]+v) if plane=='front' else ((center[0]+v,center[1]+u,center[2]) if plane=='top' else (center[0]+u,center[1],center[2]+v)))
    if plane=='top' or plane=='side' and center[1]>0:verts.reverse()
    mesh=bpy.data.meshes.new('Wear'); mesh.from_pydata([center]+verts,[],[(0,i+1,(i+1)%n+1) for i in range(n)]); mesh.update()
    o=bpy.data.objects.new('Raised worn leather',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    bpy.context.view_layer.objects.active=o
    solid=o.modifiers.new('Leather thickness','SOLIDIFY'); solid.thickness=.002; solid.offset=1
    bpy.ops.object.modifier_apply(modifier=solid.name)

# Low feet and a deep upholstered apron.
for x in [-.36,.38]:
    for y in [-1.01,1.01]:box('Timber foot',(x,y,.065),(.18,.19,.13),.012,mats[5],3)
box('Base apron',(0,0,.245),(.98,2.18,.25),.045,mats[1])
box('Rear shell',(-.405,0,.72),(.22,2.22,.96),.07,mats[2])
for y in [-1.105,1.105]:
    box('Arm side',(0,y,.48),(1.02,.25,.71),.06,mats[1])
    box('Rolled arm',(.015,y,.85),(1.06,.31,.28),.13,mats[0],5)
    rim('Arm front piping',(.553,y,.605),.235,.70,.105,'front',mats[3])
    # arm cap has an upholstered inset rather than a flat square end.
    box('Arm end panel',(.521,y,.61),(.04,.245,.71),.06,mats[2])
for i,y in enumerate([-.70,0,.70]):
    box('Seat cushion '+str(i),(.115,y,.48),(.77,.675,.24),.065,mats[0],5)
    rim('Seat front welt',(.507,y,.48),.615,.18,.045,'front',mats[3])
    rim('Seat upper seam',(.115,y,.597),.625,.69,.07,'top',mats[1])
    box('Back cushion '+str(i),(-.275,y,.91),(.245,.675,.68),.075,mats[0],5)
    rim('Back dark welt',(-.144,y,.91),.615,.62,.08,'front',mats[5])
    rim('Back worn edge',(-.132,y,.91),.596,.60,.078,'front',mats[3])
    for j in range(7):
        patch((.507,y+rng.uniform(-.24,.24),rng.uniform(.42,.54)),.04,.025,'front',rng.choice(mats[:4]))
    # Larger, readable peeled spots, deliberately sparse.
    patch((-.130,y+(.13 if i==0 else -.09),.91+.07*i),.030,.05,'front',mats[3])
    patch((.516,y-.18,.535),.04,.025,'front',mats[4])
    tube('Crack', [(-.125,y-.18,1.19),(-.122,y-.14,1.15),(-.125,y-.13,1.11)],.006,mats[5])
for y in [-1.105,1.105]:
    for x in [-.26,.1,.34]:
        tube('Rolled arm seam',[(x,y-.13,.87),(x,y-.10,.96),(x,y,.991),(x,y+.10,.96),(x,y+.13,.87)],.006,mats[3])
for j in range(20):patch((.498,rng.uniform(-.98,.98),rng.uniform(.17,.31)),.025,.018,'front',rng.choice([mats[2],mats[3]]))
for y in [-1.236,1.236]:
    for j in range(12):patch((rng.uniform(-.37,.37),y,rng.uniform(.22,.67)),.025,.035,'side',rng.choice([mats[2],mats[3]]))
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
root['asset_id']='prop.sofa'; root['tier']='Side'; root['front']='+X'
root['ss_physics']={'class':'heavy','mass':65,'friction':.8,'restitution':.05,'centerOfMass':[0,.5,0],'pushable':True,'kickable':False,'barricadeValue':1.3,'barricadeHP':250,'vaultable':False,'flammable':True,'burnTime':30,'breakable':{'hp':160,'debrisSet':'debris.wood-small'},'sounds':'prop.wood-medium'}
# Split the face-coloured upholstery before joining all static geometry by material.
for obj in list(bpy.context.scene.objects):
    if obj.type=='MESH' and len(obj.data.materials)>1:
        bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
meshes=[]
groups={m:[o for o in parts if o.data.materials[0]==m] for m in mats}
for i,m in enumerate(mats):
    group=groups[m]
    if not group:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join()
    o=bpy.context.object; o.name='body' if i==0 else 'detail_'+m.name; o.parent=root
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); meshes.append(o)
front=bpy.data.objects.new('front',None); bpy.context.collection.objects.link(front); front.parent=root; front.location=(.55,0,.5)
col=bpy.data.objects.new('col:sofa',None); bpy.context.collection.objects.link(col); col.parent=root; col.location=(0,0,.63)
col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[1.1,2.52,1.26]; col['halfExtents']=[.55,1.26,.63]
tris=sum(len(poly.vertices)-2 for o in meshes for poly in o.data.polygons)
report=dict(id='prop.sofa',tier='Side',triangles=tris,draw_calls=len(meshes),materials=[m.name for m in mats if groups[m]],nodes_ok=True,within_budget=6000<=tris<=12000,rounds=5,webgpu_ok=False,webgl2_ok=False,gaps=[])
(OUT/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    ao.bake_all(meshes,samples=32)
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root,front,col]+meshes:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.world.use_nodes=True; bg=scene.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value=(.12,.10,.16,1); bg.inputs['Strength'].default_value=.5
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012)); floor=bpy.context.object
    m=bpy.data.materials.new('Studio floor'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.025,.022,.032,1); floor.data.materials.append(m)
    def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((3,-4,6),750,4,(1,.78,.58)),((-3,2,4),600,3,(1,.55,.30)),((1,4,4),350,4,(.65,.72,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=color; aim(o,(0,0,.6))
    views={'ref':(5,-3,3),'game':(4,-5,6),'front':(5,0,2),'rear':(-5,0,2),'side':(0,-5,2)}
    bpy.ops.object.camera_add(location=views[a.view]); camera=bpy.context.object; aim(camera,(0,0,.62)); camera.data.type='ORTHO'; camera.data.ortho_scale=4.6 if a.view=='game' else 3.9; scene.camera=camera
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'; scene.render.filepath=a.render
    bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
