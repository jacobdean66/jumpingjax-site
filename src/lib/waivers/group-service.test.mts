import assert from 'node:assert/strict';
import {before,after,afterEach,test} from 'node:test';
import {http,HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {getWaiverGroupForStaff} from './group-service.ts';

const api='https://waiver-group.example.test';
const server=setupServer();
const priorUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,priorKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
before(()=>{process.env.NEXT_PUBLIC_SUPABASE_URL=api;process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';server.listen({onUnhandledRequest:'error'});});
afterEach(()=>server.resetHandlers());
after(()=>{server.close();if(priorUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=priorUrl;if(priorKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=priorKey;});
function fixture({typed=false,dob='2020-01-01',expires='2099-01-01',status='completed'}={}){
  const tables:Record<string,unknown>={
    waiver_submissions:{id:'old-group',template_id:'template',template_version_id:'original-version',signer_first_name:'Parent',signer_last_name:'Example',expires_on:expires,status},
    waiver_participants:[{id:'adult',first_name:'Parent',last_name:'Example',dob:'1990-01-01',role:'adult_signer'},{id:'child',first_name:'Child',last_name:'Example',dob,role:'child'}],
    waiver_participant_name_corrections:[],
    waiver_adult_agreements:typed?[{participant_id:'adult',adult_mode:'watching'}]:[],
  };
  server.use(http.get(`${api}/rest/v1/:table`,({params})=>{const data=tables[String(params.table)];assert.ok(data,`Unexpected query: ${String(params.table)}`);return HttpResponse.json(data);}));
}
test('existing group stays eligible without the new version or typed signatures',async()=>{fixture();const rows=await getWaiverGroupForStaff('old-group');assert.equal(rows?.length,2);assert.ok(rows?.every(r=>r.checkInEligible&&!r.expired));});
test('existing minor coverage retains its original rules when the participant reaches 18',async()=>{fixture({dob:'2000-01-01'});const rows=await getWaiverGroupForStaff('old-group');assert.equal(rows?.find(r=>r.participantId==='child')?.checkInEligible,true);});
test('new typed group age-18 term applies only to its new agreements',async()=>{fixture({typed:true,dob:'2000-01-01'});const rows=await getWaiverGroupForStaff('old-group');assert.equal(rows?.find(r=>r.participantId==='child')?.expired,true);assert.equal(rows?.find(r=>r.participantId==='adult')?.adultMode,'watching');});
test('ordinary expiration and void status still prevent check-in',async()=>{fixture({expires:'2020-01-01'});assert.ok((await getWaiverGroupForStaff('old-group'))?.every(r=>r.expired));server.resetHandlers();fixture({status:'voided'});assert.ok((await getWaiverGroupForStaff('old-group'))?.every(r=>r.expired));});
