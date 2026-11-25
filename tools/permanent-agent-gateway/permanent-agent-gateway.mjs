import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const paths=new Map([
 ['/api/internal/jumping-jax/ask',new Set(['GET','POST'])],
 ['/api/internal/jumping-jax/projects',new Set(['GET','POST'])],
 ['/api/internal/jumping-jax/published',new Set(['GET'])],
]);
const draftPath='/webhook/jjx-social-draft-model-v1';
const draftUpstream='http://127.0.0.1:5678/webhook/JjxSocialDraftV1/authenticated%2520draft%2520webhook/jjx-social-draft-model-v1';
const digest=s=>createHash('sha256').update(s).digest();
export function createGateway({token,upstream='http://127.0.0.1:4330',fetchImpl=fetch,maxConcurrent=6,draftToken}) {
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(token))throw Error('Invalid gateway credential');
 if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(upstream))throw Error('Loopback upstream required');
 if(draftToken&&!/^[A-Za-z0-9._~-]{32,256}$/.test(draftToken))throw Error('Invalid draft gateway credential');
 const expected=digest('Bearer '+token);
 const draftExpected=draftToken?digest('Bearer '+draftToken):null;
 let active=0,draftActive=false;
 return createServer(async(req,res)=>{
  const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  if(req.url===draftPath&&draftExpected){
   if(req.method!=='POST')return reply(405,{error:'Method not allowed.'});
   if(!timingSafeEqual(draftExpected,digest(req.headers.authorization??'')))return reply(401,{error:'Authorization required.'});
   if(draftActive)return reply(429,{error:'Draft service busy.'});
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return reply(415,{error:'JSON required.'});
   draftActive=true;
   try{
    const chunks=[];let size=0;
    for await(const chunk of req){
     size+=chunk.length;
     if(size>80000)return reply(413,{error:'Request too large.'});
     chunks.push(chunk);
    }
    const response=await fetchImpl(draftUpstream,{
     method:'POST',body:Buffer.concat(chunks),
     headers:{Authorization:'Bearer '+draftToken,'Content-Type':'application/json'},
     redirect:'error',cache:'no-store',signal:AbortSignal.timeout(97000),
    });
    if(!response.ok||!response.body)return reply(502,{error:'Draft worker did not confirm the result.'});
    const reader=response.body.getReader();
    let length=0;const parts=[];
    for(;;){
     const {done,value}=await reader.read();
     if(done)break;
     length+=value.length;
     if(length>100000){await reader.cancel();return reply(502,{error:'Invalid draft worker response.'});}
     parts.push(value);
    }
    const text=Buffer.concat(parts).toString('utf8');
    if(text.includes(draftToken)||text.includes(token))return reply(502,{error:'Invalid draft worker response.'});
    return reply(200,JSON.parse(text));
   }catch{return reply(502,{error:'Draft worker did not confirm the result.'});}
   finally{draftActive=false;}
  }
  if(!paths.has(req.url))return reply(404,{error:'Not found.'});
  if(!paths.get(req.url).has(req.method))return reply(405,{error:'Method not allowed.'});
  if(!timingSafeEqual(expected,digest(req.headers.authorization??'')))return reply(401,{error:'Authorization required.'});
  const owner=req.headers['x-jumping-jax-owner'];
  if(typeof owner!=='string'||!/^[a-f0-9]{64}$/.test(owner))return reply(403,{error:'Owner scope required.'});
  if(active>=maxConcurrent)return reply(429,{error:'Service busy. Retry the same request.'});
  active++;
  try{
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>14000)return reply(413,{error:'Request too large.'});chunks.push(chunk);}
   const body=Buffer.concat(chunks);
   if(req.method==='GET'&&size)return reply(400,{error:'GET body rejected.'});
   if(req.method==='POST'&&!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return reply(415,{error:'JSON required.'});
   const response=await fetchImpl(upstream+req.url,{method:req.method,headers:{Authorization:'Bearer '+token,'X-Jumping-Jax-Owner':owner,'Content-Type':'application/json'},...(req.method==='POST'?{body}:{}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(!/application\/json/i.test(response.headers.get('content-type')??''))return reply(502,{error:'Upstream response unavailable.'});
   const reader=response.body.getReader();let length=0,parts=[];
   try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1048576)throw Error('Upstream size limit');parts.push(value);}}catch{await reader.cancel();return reply(502,{error:'Upstream response unavailable.'});}
   const text=Buffer.concat(parts).toString('utf8');
   if(text.includes(token))return reply(502,{error:'Upstream response unavailable.'});
   let value;try{value=JSON.parse(text);}catch{return reply(502,{error:'Upstream response unavailable.'});}
   if(![200,201,202,400,404,409,429,503].includes(response.status))return reply(503,{error:'Private service unavailable.'});
   return reply(response.status,value);
  }catch{return reply(503,{error:'Private service unavailable. Retry the same request.'});}
  finally{active--;}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const token=readFileSync(process.env.CREDENTIALS_DIRECTORY+'/service-token','utf8').trim();
 const draftFile=process.env.CREDENTIALS_DIRECTORY+'/social-draft-token';
 const draftToken=existsSync(draftFile)?readFileSync(draftFile,'utf8').trim():undefined;
 const server=createGateway({token,draftToken});server.requestTimeout=12000;server.headersTimeout=10000;
 server.listen(4380,'127.0.0.1',()=>console.log('Scoped Permanent Agent gateway ready on loopback 4380.'));
 process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}
