import { FloatType, Matrix4, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, RenderTarget, Scene, Vector3, WebGPURenderer } from 'three/webgpu';
import { int, mat4, uniform, uv, vec3, vec4 } from 'three/tsl';
import { clipTexture, crowdPosition, type CrowdClip } from './crowd';

/** Read the actual GPU matrix shader at five frames and four movement headings, one pixel per rigid part. */
export async function crowdPoseError(renderer: WebGPURenderer, clip: CrowdClip): Promise<number> {
  const texture=clipTexture(clip), target=new RenderTarget(clip.parts.length,1,{type:FloatType,depthBuffer:false});
  const camera=new OrthographicCamera(-1,1,1,-1,0,1), scene=new Scene();
  let maximum=0;
  try {
    for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]) for(const time of [0,.25,.5,.75,1]) {
      const frame=Math.round(time*(clip.frames-1));
      const material=new MeshBasicNodeMaterial(); material.toneMapped=false;
      const instance = new Matrix4().makeRotationY(yaw).setPosition(3,0,7);
      material.outputNode=vec4(crowdPosition(mat4(uniform(instance)),texture,int(uv().x.mul(clip.parts.length)),int(frame),vec3(.11,.22,.33)),1);
      const geometry=new PlaneGeometry(2,2), mesh=new Mesh(geometry,material); scene.add(mesh);
      renderer.setRenderTarget(target); await renderer.compileAsync(scene,camera); renderer.render(scene,camera);
      const pixels=await renderer.readRenderTargetPixelsAsync(target,0,0,clip.parts.length,1);
      for(let part=0;part<clip.parts.length;part++) {
        const matrix=clip.matrices.slice((frame*clip.parts.length+part)*16,(frame*clip.parts.length+part+1)*16);
        const point=new Vector3(.11,.22,.33);
        const x=matrix[0]*point.x+matrix[4]*point.y+matrix[8]*point.z+matrix[12];
        const y=matrix[1]*point.x+matrix[5]*point.y+matrix[9]*point.z+matrix[13];
        const z=matrix[2]*point.x+matrix[6]*point.y+matrix[10]*point.z+matrix[14];
        const expected = new Vector3(x,y,z).applyMatrix4(instance);
        maximum=Math.max(maximum,Math.hypot(Number(pixels[part*4])-expected.x,Number(pixels[part*4+1])-expected.y,Number(pixels[part*4+2])-expected.z));
      }
      scene.remove(mesh);geometry.dispose();material.dispose();
    }
  } finally {renderer.setRenderTarget(null);texture.dispose();target.dispose();}
  return maximum;
}
