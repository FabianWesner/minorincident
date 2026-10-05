import { FloatType, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, RenderTarget, Scene, Vector3, WebGPURenderer } from 'three/webgpu';
import { int, uv, vec4 } from 'three/tsl';
import { clipTexture, crowdMatrix, type CrowdClip } from './crowd';

/** Read the actual GPU matrix shader at five frames, one pixel per rigid part. */
export async function crowdPoseError(renderer: WebGPURenderer, clip: CrowdClip): Promise<number> {
  const texture=clipTexture(clip), target=new RenderTarget(clip.parts.length,1,{type:FloatType,depthBuffer:false});
  const camera=new OrthographicCamera(-1,1,1,-1,0,1), scene=new Scene();
  let maximum=0;
  try {
    for(const time of [0,.25,.5,.75,1]) {
      const frame=Math.round(time*(clip.frames-1));
      const material=new MeshBasicNodeMaterial(); material.toneMapped=false;
      material.outputNode=crowdMatrix(texture,int(uv().x.mul(clip.parts.length)),int(frame)).mul(vec4(.11,.22,.33,1));
      const geometry=new PlaneGeometry(2,2), mesh=new Mesh(geometry,material); scene.add(mesh);
      renderer.setRenderTarget(target); await renderer.compileAsync(scene,camera); renderer.render(scene,camera);
      const pixels=await renderer.readRenderTargetPixelsAsync(target,0,0,clip.parts.length,1);
      for(let part=0;part<clip.parts.length;part++) {
        const matrix=clip.matrices.slice((frame*clip.parts.length+part)*16,(frame*clip.parts.length+part+1)*16);
        const point=new Vector3(.11,.22,.33);
        const x=matrix[0]*point.x+matrix[4]*point.y+matrix[8]*point.z+matrix[12];
        const y=matrix[1]*point.x+matrix[5]*point.y+matrix[9]*point.z+matrix[13];
        const z=matrix[2]*point.x+matrix[6]*point.y+matrix[10]*point.z+matrix[14];
        maximum=Math.max(maximum,Math.hypot(Number(pixels[part*4])-x,Number(pixels[part*4+1])-y,Number(pixels[part*4+2])-z));
      }
      scene.remove(mesh);geometry.dispose();material.dispose();
    }
  } finally {renderer.setRenderTarget(null);texture.dispose();target.dispose();}
  return maximum;
}
