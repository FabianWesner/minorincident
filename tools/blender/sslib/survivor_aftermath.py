"""Five living identities from the shipped civilian source rigs.

Run the original anatomy/tailoring recipe before its legacy batching/decimation.
Explicit radial recipes and named decoration omissions author each distance tier;
no mesh reduction modifier is used. Fold swatches and soot into vertex colour,
then merge within the original fifteen rigid owners (crowd-compatible).
"""
import ast
import json
import math
import shutil
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
from . import palette, sockets, export

RECIPES = {
    'dale': ('npc.survivor-group', 'glassesMan', 'foreArmR'),
    'rosa': ('npc.paramedic', None, 'armR'),
    'mr-okafor': ('npc.civilian-elderly', None, 'foreArmR'),
    'mia': ('npc.civilian-woman-a', None, 'armR'),
    'sam': ('npc.survivor-group', 'capMan', 'shinR'),
}
OWNERS = ['hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR',
          'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR']
# Small folds/fasteners do not replace the broad silhouette at distance.
MID_OMIT = ('stitch', 'seam', 'tread', 'lace', 'stud', 'snap', 'catchlight',
            'nostril', 'cord end', 'fringe ridge', 'eye bag', 'patch emblem',
            'eyelet', 'sole lug', 'hair_groove', 'half_up_ridge', 'fringe_ridge',
            'plaid', 'rib', 'piping', 'fringe sheen', 'finger', 'thumb')
FAR_OMIT = (*MID_OMIT, 'finger', 'thumb', 'button', 'buckle inset', 'ear bowl',
            'cheek tint', 'upper lid', 'lower lip', 'mouth upper lip', 'flower_',
            'pleat', 'fold', 'drawstring', 'pack buckle', 'pack flap strap',
            'strap adjuster', 'pocket flap', 'cap emblem', 'cap patch', 'reinforced knee',
            'crown hair', 'beard cheek', 'moustache lock', 'upper teeth', 'collar fold',
            'underhood', 'toe cap', 'shoe heel', 'tongue', 'shoe side stripe', 'cargo flap',
            'eye glint', 'upper lashes', 'outer lash', 'ear inset', 'ear inner',
            'nose light', 'cheek blush', 'spectacle hinge', 'smile crease',
            'sole notch', 'knuckle', 'cuff', 'belt', 'buckle', 'harness inset',
            'rear trouser pocket', 'thigh equipment strap', 'thigh strap',
            'tool holster', 'rescue shears', 'placket facing', 'knee cloth')


class DistanceRecipe(ast.NodeTransformer):
    """Change primitive construction inputs, retaining the base anatomy code."""
    def __init__(self, tier):
        self.tier = tier
        self.radial = (8, 6, 4)[tier]
        self.rings = (6, 5, 3)[tier]

    def visit_FunctionDef(self, node):
        self.generic_visit(node)
        args = {a.arg for a in node.args.args}
        inputs = []
        if node.name in ('ell', 'loft', 'tube', 'lock', 'mesh', 'finish'):
            if 'seg' in args: inputs.append(f'seg = min(seg, {4 if node.name == 'ell' and self.tier == 2 else self.radial})')
            if node.name == 'ell' and 'rings' in args: inputs.append(f'rings = min(rings, {self.rings})')
            if node.name == 'ell':
                radius = 'sz' if 'sz' in args else 'r'
                inputs += [f'seg = min(seg, 4) if max({radius}) < .025 else seg',
                           f'rings = min(rings, 3) if max({radius}) < .025 else rings']
            if node.name == 'tube' and self.tier > 0:
                limit = 12 if self.tier == 1 else 8
                inputs += ['points = list(points)',
                           f'indices = [round(i*(len(points)-1)/({limit}-1)) for i in range({limit})] if len(points) > {limit} else list(range(len(points)))']
                if 'radii' in args: inputs += ['radii = list(radii)', 'radii = [radii[i] for i in indices]']
                inputs += ['points = [points[i] for i in indices]']
            if 'N' in args: inputs.append(f'N = min(N, {self.radial})')
            if 'sub' in args: inputs.append('sub = 0')
        node.body = ast.parse('\n'.join(inputs)).body + node.body
        return node

    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Attribute) and node.func.attr == "modifier_apply":
            node.func = ast.Name(id="apply_authored_modifier", ctx=ast.Load())
        return node

    def visit_Assign(self, node):
        self.generic_visit(node)
        # Hair/scalp and skirt profiles have local, explicitly authored radial counts.
        if isinstance(node.value, ast.Constant) and isinstance(node.value.value, int):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in ('seg', 'N', 'segments'):
                    node.value = ast.Constant(min(node.value.value, self.radial))
        if any(isinstance(t, ast.Attribute) and t.attr == 'segments' for t in node.targets):
            node.value = ast.Constant(1)
        if self.tier > 0 and any(isinstance(t, ast.Attribute) and t.attr == 'width' for t in node.targets):
            node.value = ast.Constant(0)
        if any(isinstance(t, ast.Attribute) and t.attr in ('bevel_resolution', 'resolution_u', 'render_resolution_u') for t in node.targets):
            node.value = ast.Constant(0 if any(isinstance(t, ast.Attribute) and t.attr == 'bevel_resolution' for t in node.targets) else 1)
        return node


def source_scene(base, kind, tier, project):
    path = project / 'assets' / base / 'build.py'
    code = path.read_text()
    boundary = {'npc.survivor-group': '\nfor i,(kind,pos,yaw)',
                'npc.paramedic': '# Preserve a smooth hero silhouette',
                'npc.civilian-elderly': '# Preserve sculpted silhouette',
                'npc.civilian-woman-a': '# Merge static surfaces by material'}[base]
    code = code.split(boundary)[0]
    if kind:
        # The native cap crown uses literal ring strides instead of `seg`.
        code = code.replace('range(24)', f'range({(8, 6, 6)[tier]})').replace('j/24', f'j/{(8, 6, 6)[tier]}').replace('k*24', f'k*{(8, 6, 6)[tier]}').replace('(j+1)%24', f'(j+1)%{(8, 6, 6)[tier]}').replace('(k+1)*24', f'(k+1)*{(8, 6, 6)[tier]}')
    tree = DistanceRecipe(tier).visit(ast.parse(code))
    ast.fix_missing_locations(tree)
    argv = sys.argv
    sys.argv = [str(path)]
    def apply_authored_modifier(modifier):
        obj = bpy.context.view_layer.objects.active
        mod = obj.modifiers[modifier]
        if mod.type == 'BEVEL' and mod.width == 0:
            obj.modifiers.remove(mod)
        else:
            bpy.ops.object.modifier_apply(modifier=modifier)
    namespace = {'__file__': str(path), '__name__': '__aftermath_base__',
                 'apply_authored_modifier': apply_authored_modifier}
    try:
        exec(compile(tree, str(path), 'exec'), namespace)
        if kind:
            namespace['build_person'](0, kind, (0, 0, 0), 0)
    finally:
        sys.argv = argv
    bpy.context.view_layer.update()
    return bpy.data.objects['root']


def wrap(owner, tier):
    """Closed tapered gauze volume in the original limb's local frame."""
    meshes = [o for o in owner.children if o.type == 'MESH']
    points = [owner.matrix_world.inverted() @ o.matrix_world @ v.co
              for o in meshes for v in o.data.vertices]
    lo = Vector(tuple(min(p[k] for p in points) for k in range(3)))
    hi = Vector(tuple(max(p[k] for p in points) for k in range(3)))
    center = (lo + hi) / 2
    # Use the limb's middle section, so the wrap never bridges an elbow/knee.
    length = (hi.z - lo.z) * .60
    rx = (hi.x - lo.x) * .54 + .008
    ry = (hi.y - lo.y) * .54 + .008
    sides = (12, 8, 6)[tier]
    verts, faces = [], []
    for j, z in enumerate((-length/2, 0, length/2)):
        for i in range(sides):
            a = 2*math.pi*i/sides
            bulge = 1.015 if j == 1 else 1
            verts.append(tuple(center + Vector((rx*math.cos(a)*bulge, ry*math.sin(a)*bulge, z))))
    for j in range(2):
        for i in range(sides):
            a = j*sides+i; b = j*sides+(i+1)%sides
            faces.append((a, b, b+sides, a+sides))
    faces += [tuple(reversed(range(sides))), tuple(2*sides+i for i in range(sides))]
    mesh = bpy.data.meshes.new('paleGauze')
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(palette.mat('picketWhite'))
    obj = bpy.data.objects.new('paleGauze', mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = owner
    for face in mesh.polygons: face.use_smooth = True
    # Near/mid overlapping gauze edges; far retains the full pale volume.
    if tier < 2:
        for j in (-.28, .10):
            bpy.ops.mesh.primitive_torus_add(major_segments=sides, minor_segments=4,
                major_radius=1, minor_radius=.025)
            seam = bpy.context.object
            seam.name = 'gauzeOverlappingEdge'
            seam.parent = owner
            seam.location = center + Vector((0, 0, length*j))
            seam.scale = (rx, ry, .035)
            seam.data.materials.append(palette.mat('sidewalk'))


def fold_colors(root, identity):
    """Shared palette regions with softly varying, broad asymmetric soot fields."""
    white = palette.mat('picketWhite')
    base = white.diffuse_color[:3]
    for obj in list(root.children_recursive):
        if obj.type != 'MESH': continue
        material = obj.data.materials[0]
        token = material.name.removeprefix('pal_').split('.')[0]
        name = obj.name.lower()
        owner = obj.parent.name
        rgb = list(palette.mat(token).diffuse_color[:3]) if token in palette.TOKENS else list(material.diffuse_color[:3])
        if identity == 'dale' and token in ('vest', 'vestTrim', 'shirt', 'shirtLight', 'pants', 'pantsLight', 'pantsDark'):
            rgb = list(palette.mat('denimBlue').diffuse_color[:3])
            if token in ('vestTrim', 'shirtLight', 'pantsLight'): rgb = [c*1.25 for c in rgb]
        if identity == 'sam' and token in ('vest', 'vestTrim', 'capTan'):
            rgb = list(palette.mat('olive' if token != 'vestTrim' else 'oliveLight').diffuse_color[:3])
        if identity == 'mr-okafor' and token.startswith('skin'):
            rgb = [c*f for c, f in zip(rgb, (.43, .35, .30))]
        layer = obj.data.color_attributes.new(name='palette', type='FLOAT_COLOR', domain='CORNER')
        obj.data.color_attributes.active_color = layer
        is_wrap = name.startswith(('palegauze', 'gauzeoverlapping'))
        skin = token.startswith('skin')
        for loop in obj.data.loops:
            p = obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
            col = rgb.copy()
            if not is_wrap and owner != 'head' and not skin:
                # Asymmetric chest/back smudge and dusty garment hem. Smooth
                # radial masks avoid painted rectangular overlays at any tier.
                chest = math.exp(-((p.z-.88)/.20)**2 - ((p.y+.09)/.16)**2)
                back = math.exp(-((p.z-.77)/.21)**2 - ((p.y-.075)/.20)**2) if p.x < 0 else 0
                dust = math.exp(-((p.z-.36)/.15)**2)
                irregular = .80 + .20*math.sin(p.y*31+p.z*24)*math.cos(p.x*27-p.z*19)
                soot = min(.84, max(chest*.78, back*.72, dust*.62)*irregular)
                col = [c*(1-soot) for c in col]
            # Preserve a clean living face: no dark sockets/emissive eye material.
            layer.data[loop.index].color = (*[min(1, col[k]/base[k]) for k in range(3)], 1)
        obj.data.materials.clear()
        obj.data.materials.append(white)
    export.merge_by_material(root, set(OWNERS), preserve_vertex_colors=True)


def build_aftermath(directory, output):
    directory = Path(directory).resolve()
    project = directory.parents[1]
    identity = directory.name.split('.')[1]
    base, kind, bandage = RECIPES[identity]
    tier_index = sys.argv.index('--distance-tier') if '--distance-tier' in sys.argv else None
    only_tier = int(sys.argv[tier_index+1]) if tier_index is not None else None
    if only_tier not in (None, 0, 1, 2): raise ValueError('distance tier must be 0, 1 or 2')
    definitions = json.loads((project/'src/assets/manifest.json').read_text())
    base_def = next(a for a in definitions if a['id'] == base)
    stats_path = directory/'lod-stats.json'
    stats = json.loads(stats_path.read_text()) if stats_path.exists() else {}
    for tier in ((only_tier,) if only_tier is not None else (0, 1, 2)):
        root = source_scene(base, kind, tier, project)
        # Keep the anatomy and all fifteen limb owners. Attachments are static
        # within that owner; empty weapon/backpack sockets remain available.
        for obj in list(root.children_recursive):
            if obj.type != 'MESH': continue
            name = obj.name.lower()
            omit = MID_OMIT if tier == 1 else FAR_OMIT if tier == 2 else ('stitch', 'seam', 'tread', 'stud', 'snap', 'fringe sheen')
            remove = any(word in name for word in omit)
            if identity == 'dale' and any(word in name for word in ('glasses', 'pack', 'webbing', 'shoulder strap')): remove = True
            if identity == 'rosa' and ('hand medical case' in name or 'medical backpack' in name): remove = True
            if identity == 'mia':
                if 'tote' in name: remove = True
                if name.startswith('flower_'):
                    bits = name.split('_')
                    if bits[1] == 'center': bits.pop(1)
                    row, flower = int(bits[1]), int(bits[2])
                    remove = not (row in ((0, 2) if tier == 0 else (0,)) and flower in ((0, 2, 4, 6) if tier == 0 else (0, 4)))
                if 'bodice_petal' in name and tier > 0: remove = True
                if tier > 0 and any(word in name for word in ('dress_hem', 'gathered_waist', 'bun_braided')): remove = True
                if tier == 2 and any(word in name for word in ('dress_hem', 'gathered_waist', 'bun_braided', 'bun_coil', 'half_up_sweep')): remove = True
                if tier == 2 and name.startswith('wavy_lock') and int(name[len('wavy_lock'):]) not in (0, 5, 10): remove = True
            if identity == 'mr-okafor' and tier == 2 and name.startswith(('swept silver lock', 'nape curl', 'temple sweep')): remove = True
            if identity == 'rosa' and tier == 1:
                if name.startswith('layered crown') and int(name.split('.')[-1] if '.' in name else '0') % 2: remove = True
                if name.startswith('pony sculpt lock') and int(name.split('.')[-1] if '.' in name else '0') % 2: remove = True
            if identity == 'rosa' and tier == 2:
                if name.startswith(('temple sideburn', 'collar stand', 'pony sculpt lock.003', 'ponytail tie')): remove = True
                if name.startswith('sleeve medical star') and obj.parent.name == 'armR': remove = True
                if name.startswith(('layered crown', 'crown tuft', 'side flick', 'long temple')): remove = True
                if name.startswith('pony sculpt lock') and int(name.split('.')[-1] if '.' in name else '0') not in (0, 3, 6): remove = True
                if name.startswith('swept fringe') and int(name.split('.')[-1] if '.' in name else '0') not in (0, 2): remove = True
            if remove: bpy.data.objects.remove(obj, do_unlink=True)
        wrap(bpy.data.objects[bandage], tier)
        root['asset_id'] = directory.name
        root['identity'] = identity
        root['adult'] = True
        root['animation'] = 'rigid-part'
        root['forward'] = '+X'
        root['derivedFrom'] = base
        if kind: root['sourceMember'] = kind
        # Character metadata stays character-owned; no pushable prop physics.
        sockets.empty('body', parent=root)
        bpy.context.view_layer.update()
        points = [o.matrix_world @ v.co for o in root.children_recursive if o.type == 'MESH' for v in o.data.vertices]
        front_x = max(p.x for p in points)
        sockets.empty('front', (front_x+.015, 0, .9), root)
        for o in root.children_recursive:
            if o.type == 'MESH': o.data.calc_loop_triangles()
        print('COMPONENTS', tier, sorted([(o.name, len(o.data.loop_triangles)) for o in root.children_recursive if o.type == 'MESH'], key=lambda p: -p[1])[:18])
        fold_colors(root, identity)
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        for obj in meshes: obj.data.calc_loop_triangles()
        tris = sum(len(o.data.loop_triangles) for o in meshes)
        draws = sum(len(o.data.materials) for o in meshes)
        if tris > (15000, 6000, 2000)[tier] or draws > 15:
            print(sorted([(o.name, len(o.data.loop_triangles)) for o in meshes], key=lambda p: -p[1]))
            raise ValueError(f'{identity} LOD{tier}: {tris} triangles, {draws} draws')
        bpy.context.view_layer.update()
        points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        # Once-only source metres conversion is owned by the manifest pipeline.
        scale = base_def.get('sourceScale', 1)
        dims = [(max(p[k] for p in points)-min(p[k] for p in points))*scale for k in (0, 2, 1)]
        path = directory/('model'+('' if tier == 0 else f'.lod{tier}')+'.glb')
        export.glb(root, path)
        stats[f'lod{tier}'] = dict(triangles=tris, draws=draws, materials=1,
                                  bytes=path.stat().st_size, dimensions=dims)
    stats_path.write_text(json.dumps(stats, indent=2)+'\n')
    supplied = directory/('model'+(f'.lod{only_tier}' if only_tier else '')+'.glb')
    if supplied.resolve() != Path(output).resolve(): shutil.copyfile(supplied, output)
