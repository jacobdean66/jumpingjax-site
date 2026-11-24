import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=new URL('../../',import.meta.url);
const guard=await import(new URL('src/lib/security/request-guard.ts',root));
const hash=v=>createHash('sha256').update(v).digest('hex');
function load(file,env,modules,fetchImpl){
 const exports={};const source=readFileSync(new URL(file,root),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:key=>{if(key in modules)return modules[key];throw Error('Unmapped fixture import: '+key);},URL,Request,Response,AbortSignal,process:{env},fetch:fetchImpl});return exports;
}
test('production bridge preserves exact authenticated-owner mapping and denies unauthenticated/cross-origin writes',async()=>{
 const env={COMMAND_CENTER_JAX_ORIGIN:'https://scoped.example:10000',COMMAND_CENTER_JAX_TOKEN:'synthetic_'+ 'a'.repeat(48),VERCEL_ENV:'production'};
 const connection=load('src/lib/agent-manager/permanent-agent-connection.ts',env,{'server-only':{},'node:crypto':{createHash}});
 let owner=false,identity='owner',calls=[];
 const bridge=load('src/lib/agent-manager/permanent-agent-bridge.ts',env,{'server-only':{},'./permanent-agent-connection':connection,'@/lib/admin/session':{verifyAdminOwnerAccess:async()=>owner?{ok:true,identity:{id:identity}}:{ok:false,reason:'invalid_token'}},'@/lib/security/request-guard':guard,'@/lib/agent-manager/chat-pictures-server':{readChatRequest:r=>r.json()}},async(url,options)=>{calls.push({url,options});return Response.json({answer:{text:'Synthetic transport check',sources:[]}});});
 assert.equal((await bridge.permanentAgentRoute('ask')).status,401);assert.equal(calls.length,0);owner=true;
 const bad=new Request('https://jumpingjaxllc.com/api/admin/agents/ask',{method:'POST',headers:{origin:'https://outside.example','content-type':'application/json'},body:'{}'});
 assert.equal((await bridge.permanentAgentRoute('ask',bad)).status,403);assert.equal(calls.length,0);
 env.COMMAND_CENTER_JAX_OWNER_BINDING=hash('owner')+':'+hash('existing-authorized-workspace');
 const good=new Request('https://jumpingjaxllc.com/api/admin/agents/ask',{method:'POST',headers:{origin:'https://jumpingjaxllc.com','content-type':'application/json'},body:'{}'});
 assert.equal((await bridge.permanentAgentRoute('ask',good)).status,200);assert.equal(calls[0].options.headers['X-Jumping-Jax-Owner'],hash('existing-authorized-workspace'));assert.equal(calls[0].options.redirect,'error');
 identity='different-owner';await bridge.permanentAgentRoute('projects');assert.equal(calls.at(-1).options.headers['X-Jumping-Jax-Owner'],hash('different-owner'));
 assert.equal(calls.at(-1).url.pathname,'/api/internal/jumping-jax/projects');
});
test('Vercel runtime check requires the service credential and returns only read-only status metadata',async()=>{
 const env={COMMAND_CENTER_JAX_ORIGIN:'https://scoped.example:10000',COMMAND_CENTER_JAX_TOKEN:'synthetic_'+ 'a'.repeat(48),VERCEL:'1',VERCEL_REGION:'test',VERCEL_GIT_COMMIT_SHA:'b'.repeat(40)};
 const connection=load('src/lib/agent-manager/permanent-agent-connection.ts',env,{'server-only':{},'node:crypto':{createHash}});let calls=[];
 const route=load('src/app/api/internal/permanent-agent/readiness/route.ts',env,{'server-only':{},'node:crypto':await import('node:crypto'),'@/lib/agent-manager/permanent-agent-connection':connection},async(url,options)=>{calls.push({url,options});return Response.json({projects:[{private:'omitted'}],secret:'not returned'});});
 assert.equal((await route.GET(new Request('https://app.example/api/internal/permanent-agent/readiness'))).status,401);assert.equal(calls.length,0);
 const response=await route.GET(new Request('https://app.example/api/internal/permanent-agent/readiness',{headers:{authorization:'Bearer '+env.COMMAND_CENTER_JAX_TOKEN}}));const value=await response.json();assert.equal(response.status,200);assert.equal(value.runtime,'vercel-function');assert.equal(calls.length,3);assert.ok(calls.every(x=>x.options.method===undefined&&x.options.redirect==='error'));assert.equal(value.upstreams.projects.count,1);assert.ok(!JSON.stringify(value).includes('omitted'));assert.ok(!JSON.stringify(value).includes(env.COMMAND_CENTER_JAX_TOKEN));
});
