import { normalView } from 'three/tsl';
import { Mesh, type BufferAttribute, type InterleavedBufferAttribute, type LightShadow, type Object3D, type Material, type Camera, type Light } from 'three/webgpu';

type ShadowLight = Light & { shadow: LightShadow; target?: Object3D; angle?: number; distance?: number };
type ShadowMaterial = Material & { id: number; positionNode?: unknown; normalNode?: unknown; maskNode?: unknown; opacityNode?: unknown; castShadowNode?: unknown; displacementMap?: unknown };
interface State { previous: number[]; current: number[] }
/** Reuse exact shadow inputs; unknown vertex/alpha effects always take the normal refresh path. */
export class ShadowRefresh {
  private readonly states = new WeakMap<Object3D, State>();
  prepare(scene: Object3D, camera?: Camera): () => void {
    const state = this.states.get(scene) ?? { previous: [], current: [] }; this.states.set(scene, state);
    const values = state.current; values.length = 0;
    const lights: ShadowLight[] = []; let dynamic = Boolean((scene as Object3D & { overrideMaterial?: unknown }).overrideMaterial);
    values.push(camera?.layers.mask ?? 1);
    const add = (data: ArrayLike<number>) => { for (let i = 0; i < data.length; i++) values.push(data[i]); };
    scene.traverseVisible(object => {
      const light = object as ShadowLight;
      if ((light as unknown as { isLight?: boolean }).isLight && light.castShadow && light.shadow) { lights.push(light); return; }
      if (!object.castShadow) return;
      if (!(object instanceof Mesh)) { dynamic = true; return; }
      if (object.customDepthMaterial || object.customDistanceMaterial || (object as Mesh & { isBatchedMesh?: boolean }).isBatchedMesh) dynamic = true;
      values.push(object.id, object.count ?? 1, object.geometry.id, object.geometry.drawRange.start, object.geometry.drawRange.count, object.layers.mask);
      add(object.matrixWorld.elements);
      const mesh = object as Mesh & { skeleton?: { update(): void; boneMatrices: Float32Array }; instanceMatrix?: { version: number }; morphTargetInfluences?: number[] };
      if (mesh.skeleton) {
        mesh.skeleton.update(); add(mesh.skeleton.boneMatrices);
        const skinned = object as Mesh & { bindMatrix?: { elements: number[] }; bindMatrixInverse?: { elements: number[] } };
        if (skinned.bindMatrix) add(skinned.bindMatrix.elements);
        if (skinned.bindMatrixInverse) add(skinned.bindMatrixInverse.elements);
      }
      if (mesh.morphTargetInfluences) add(mesh.morphTargetInfluences);
      values.push(mesh.instanceMatrix?.version ?? 0, object.geometry.index?.version ?? 0);
      for (const attribute of Object.values(object.geometry.attributes) as (BufferAttribute | InterleavedBufferAttribute)[]) values.push('data' in attribute ? attribute.data.version : attribute.version);
      for (const material of (Array.isArray(object.material) ? object.material : [object.material]) as ShadowMaterial[]) {
        values.push(material.id, material.version, Number(material.visible), material.side, material.opacity, material.alphaTest);
        const fixed = object.userData.staticInstanceAttributes && object.userData.staticInstancePosition === material.positionNode && material.userData.fixedStaticPosition;
        if (material.positionNode && !fixed || material.normalNode && material.normalNode !== normalView || material.maskNode || material.opacityNode || material.castShadowNode || material.displacementMap || material.alphaTest > 0) dynamic = true;
      }
    });
    for (const light of lights) {
      const shadow = light.shadow;
      values.push(light.id, light.intensity, light.angle ?? 0, light.distance ?? 0, shadow.bias, shadow.normalBias, shadow.mapSize.x, shadow.mapSize.y);
      add(light.matrixWorld.elements); if (light.target) add(light.target.matrixWorld.elements);
      add((shadow.camera as Camera).projectionMatrix.elements);
    }
    const changed = dynamic || values.length !== state.previous.length || values.some((value, i) => value !== state.previous[i]);
    state.current = state.previous; state.previous = values;
    const restore: { shadow: LightShadow; auto: boolean }[] = [];
    for (const light of lights) if (light.shadow.autoUpdate) {
      const shadow = light.shadow; restore.push({ shadow, auto: shadow.autoUpdate });
      shadow.autoUpdate = false; shadow.needsUpdate = shadow.needsUpdate || changed || !shadow.map;
    }
    return () => { for (const { shadow, auto } of restore) shadow.autoUpdate = auto; };
  }
}
