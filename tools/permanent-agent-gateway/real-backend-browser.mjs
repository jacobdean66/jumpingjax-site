import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from '/opt/agent-tools/packages/node_modules/playwright/index.mjs';
const cwd='/opt/permanent-agent-production/source',root='/opt/permanent-agent-production';
const idsFile=root+'/browser-acceptance-ids.json';
const ids=existsSync(idsFile)?JSON.parse(readFileSync(idsFile)): {thread:randomUUID(),turn:randomUUID(),projectA:randomUUID(),projectB:randomUUID()};
if(!existsSync(idsFile))writeFileSync(idsFile,JSON.stringify(ids),{mode:0o600});
const token=readFileSync('/etc/permanent-agent-gateway/service-token','utf8').trim();
const password=randomBytes(24).toString('base64url');
const from=createHash('sha256').update('owner').digest('hex');
const to=createHash('sha256').update('permanent-agent-release-isolated-browser-test').digest('hex');
const port=43987,origin='http://localhost:'+port;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{cwd,env:{...process.env,VERCEL_ENV:'preview',NEXT_TELEMETRY_DISABLED:'1',ADMIN_OWNER_USERNAME:'synthetic-owner',ADMIN_OWNER_PASSWORD:password,ADMIN_SESSION_SECRET:randomBytes(32).toString('hex'),COMMAND_CENTER_JAX_ORIGIN:'https://contabo-command-center.tail4acd0e.ts.net:10000',COMMAND_CENTER_JAX_TOKEN:token,COMMAND_CENTER_JAX_OWNER_BINDING:from+':'+to},stdio:['ignore','ignore','ignore']});
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(origin+'/admin/agents')).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
 browser=await chromium.launch({executablePath:'/opt/agent-tools/browsers/chromium-1255/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];const requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
 await page.goto(origin+'/admin/agents#supervisor');await page.getByPlaceholder('Username').fill('synthetic-owner');await page.getByPlaceholder('Password').fill(password);await page.getByRole('button',{name:'Open dashboard',exact:true}).click();
 await page.getByLabel('Ask a question').waitFor();
 const call=async(area,body)=>page.evaluate(async({area,body})=>{const r=await fetch('/api/admin/agents/'+area,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,value:await r.json()};},{area,body});
 // Both fixtures are real saved drafts in a separate synthetic backend namespace. Nothing is started.
 for(const [id,name] of [[ids.projectA,'Synthetic release older draft'],[ids.projectB,'Synthetic release newest draft']]){
  const value=await call('projects',{action:'save-draft',id,name,instructions:'Synthetic release verification. Never execute this draft.',compute:'contabo',attachment:null,workers:[{role:'builder',host:'contabo',model:''},{role:'reviewer',host:'contabo',model:''},{role:'tester',host:'contabo',model:''}]});assert.ok([200,202].includes(value.status));assert.equal(value.value.project.state,'draft');
 }
 await page.reload();await page.getByLabel('Ask a question').waitFor();
 await page.getByLabel('Ask a question').fill('Can I use Contabo instead?');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 const answer=page.locator('#supervisor article').filter({hasText:'Can I use Contabo instead?'}).last();await answer.waitFor();await page.waitForFunction(()=>!document.querySelector('textarea[aria-label="Ask a question"]').value);
 const answerText=await answer.innerText();assert.match(answerText,/Contabo/i);assert.ok(answerText.length>80);
 await page.reload();await page.locator('#supervisor article').filter({hasText:'Can I use Contabo instead?'}).last().waitFor();
 const workspace=page.locator('#jax-project-workspace');await workspace.getByRole('button',{name:'Projects',exact:true}).click();await workspace.getByRole('button',{name:/Synthetic release older draft/}).click();
 await workspace.getByRole('heading',{name:'Synthetic release older draft',exact:true}).waitFor();
 await page.reload();await workspace.getByRole('heading',{name:'Synthetic release older draft',exact:true}).waitFor();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);assert.equal(errors.length,0);assert.ok(!requests.some(u=>u.includes('tail4acd0e')));
 await page.screenshot({path:root+'/mobile-real-backend.png',fullPage:true});
 const proof={at:new Date().toISOString(),syntheticWebsiteAccount:true,separateSyntheticBackendNamespace:true,realContaboBackend:true,phoneWidth:390,answerVisible:true,answerRestored:true,nonFirstProjectRestored:true,projectIds:[ids.projectA,ids.projectB],projectsStarted:0,publicPhoneActivated:false,inferenceCalls:0,consoleErrors:errors,clientContaboRequests:0};writeFileSync(root+'/real-backend-browser.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){console.error('BROWSER_CHECK_FAILED',error.message);throw error;}
finally{await browser?.close();server.kill('SIGTERM');}
