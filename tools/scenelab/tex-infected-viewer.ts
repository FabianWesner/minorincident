/** Capture the approved source in the pipeline's own pinned inspection viewer. */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client';
const port = Number(process.env.SCENE_PORT ?? 4492), root = '/private/tmp/3dp-tex-infected';
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
let browser;
try {
  for (let i=0;i<100;i++) { try { if ((await fetch(`http://127.0.0.1:${port}/artifacts/latest.html`)).ok) break; } catch { /* Starting the owned server. */ } await new Promise(r=>setTimeout(r,100)); }
  browser = await launchBrowser({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/artifacts/latest.html#zombies`);
  await page.evaluate(async()=>{await (window as unknown as {viewerReady:Promise<void>}).viewerReady;});
  await page.locator('[data-view="front"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({path:'docs/reports/tex-infected/pipeline-viewer.png'});
  await page.locator('#viewport').screenshot({path:'/private/tmp/tex-infected-captures/pipeline-look.png'});
  const state=await page.evaluate(()=>({state:(window as unknown as {currentModelState:unknown}).currentModelState,status:document.getElementById('status')?.textContent}));
  writeFileSync('docs/reports/tex-infected/pipeline-viewer.json',JSON.stringify({root,...state,errors},null,2));
  if(errors.length)throw new Error(errors.join('\n'));
} finally { await browser?.close();server.kill(); }
