"""Small +X-facing courier cap; the local origin is the head node. Headless Blender."""
from pathlib import Path
import bpy, math, json
root=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
palette=json.loads((root/'src/assets/palette.json').read_text())
def material(token, emission=False):
    name=('emi_' if emission else 'pal_')+token
    m=bpy.data.materials.new(name);hexcolor=palette[token].lstrip('#')
    srgb=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    color=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb]
    m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=1
    return m
teal=material('backpackTeal');dark=material('uiDark');gold=material('schoolBusYellow');lens=material('picketWhite',True)
def cube(name,at,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.dimensions=size;o.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for lod,segments,rings in [(0,12,4),(1,8,2),(2,8,2)]:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    vertices=[];faces=[]
    for j in range(rings):
        a=j*math.pi/(2*rings)
        for i in range(segments):
            t=i*math.tau/segments;vertices.append((.19*math.cos(a)*math.cos(t),.23*math.cos(a)*math.sin(t),.09+.15*math.sin(a)))
    for j in range(rings-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
    top=len(vertices);vertices.append((0,0,.24));bottom=len(vertices);vertices.append((0,0,.09))
    for i in range(segments):
        a=(rings-1)*segments+i;b=(rings-1)*segments+(i+1)%segments
        faces.append((a,b,top));faces.append(((i+1)%segments,i,bottom))
    mesh=bpy.data.meshes.new('cap');mesh.from_pydata(vertices,[],faces);o=bpy.data.objects.new('cap',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(teal)
    cube('brim',(.18,0,.09),(.24,.37,.035),teal)
    cube('band',(0,0,.105),(.4,.48,.045),dark)
    cube('lamp_housing',(.24,0,.16),(.12,.16,.12),gold)
    cube('lamp_lens',(.306,0,.16),(.018,.11,.075),lens)
    triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
    assert triangles<=(800 if lod==0 else 80),triangles
    suffix='' if lod==0 else '.lod'+str(lod)
    bpy.ops.export_scene.gltf(filepath=str(root/('assets/acc.headlamp/model'+suffix+'.glb')),export_format='GLB',export_yup=True)
    print(json.dumps({'lod':lod,'triangles':triangles}))
