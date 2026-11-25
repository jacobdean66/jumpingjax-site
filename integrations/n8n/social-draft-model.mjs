const model='deepseek-coder-v2:16b';
const validate=`
const body=$input.first().json.body;
if (!body || body.model !== '${model}' ||
    !/^[a-f0-9-]{36}$/.test(body.runId ?? '') ||
    !['campaign_strategist','creative_director','independent_reviewer','revision'].includes(body.stage) ||
    typeof body.requestId !== 'string' || body.requestId.length > 120 ||
    typeof body.system !== 'string' || typeof body.user !== 'string' ||
    body.system.length + body.user.length > 12000 ||
    !Number.isInteger(body.maxTokens) || body.maxTokens < 1 || body.maxTokens > 1200) throw Error('Invalid draft request');
return [{json:{requestId:body.requestId,request:{model:body.model,stream:false,format:'json',
  messages:[{role:'system',content:body.system},{role:'user',content:body.user}],
  options:{temperature:0,num_ctx:8192,num_predict:body.maxTokens}}}}];
`;
const result=`
const input=$('Validate draft request').first().json;
const response=$input.first().json;
if(response.model!=='${model}' || response.done!==true || response.done_reason==='length' ||
   typeof response.message?.content!=='string' || response.message.content.length>24000) throw Error('Thunder response incomplete');
return [{json:{requestId:input.requestId,executionId:String($execution.id),model:response.model,text:response.message.content}}];
`;
const node=(id,name,type,typeVersion,position,parameters)=>({id,name,type:'n8n-nodes-base.'+type,typeVersion,position:[position,0],parameters});
const nodes=[
  node('81212c2b-1418-40fe-8d3e-bfe8b26a3972','Authenticated draft webhook','webhook',2,0,
    {httpMethod:'POST',path:'jjx-social-draft-model-v1',authentication:'headerAuth',responseMode:'lastNode',responseData:'firstEntryJson',options:{}}),
  node('5a61b020-286f-43e5-bc6e-876e85af1904','Validate draft request','code',2,270,{jsCode:validate}),
  node('cde2ce2a-b4fc-4539-9a8a-c85af1d53119','Thunder DeepSeek','httpRequest',4.2,540,
    {method:'POST',url:'http://172.21.0.1:11436/api/chat',sendBody:true,specifyBody:'json',
      jsonBody:'={{ JSON.stringify($json.request) }}',options:{timeout:80000,redirect:{redirect:{followRedirects:false}}}}),
  node('ef9b609d-d639-4704-8977-3aa106610d34','Verify exact response','code',2,810,{jsCode:result}),
];
const workflow={name:'Jumping Jax Social Posts · Draft Model',active:false,nodes,
  settings:{executionOrder:'v1',executionTimeout:95,saveDataErrorExecution:'none',saveDataSuccessExecution:'none',saveManualExecutions:false,saveExecutionProgress:false},
  connections:Object.fromEntries(nodes.slice(0,-1).map((current,i)=>[current.name,{main:[[{node:nodes[i+1].name,type:'main',index:0}]]}]))};
process.stdout.write(JSON.stringify(workflow,null,2)+'\n');
