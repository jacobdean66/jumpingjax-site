import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { enqueueJob, isSafeManualJob, runOne } from "@/lib/agent-manager/service";
import { validateOwnerPost } from "@/lib/security/request-guard";

export async function POST(request:Request){
  const auth=await verifyAdminOwnerAccess(); if(!auth.ok)return Response.json({ok:false,error:"Owner authorization required."},{status:401});
  const rejected=validateOwnerPost(request);if(rejected)return rejected;
  const body=await request.json().catch(()=>null) as {agentKey?:string;jobType?:string;idempotencyKey?:string}|null;
  if(!body?.agentKey||!body.jobType||!body.idempotencyKey||!isSafeManualJob(body.jobType))return Response.json({ok:false,error:"Only a supported safe deterministic job may be run here."},{status:400});
  try{
    const job=await enqueueJob({agentKey:body.agentKey,jobType:body.jobType,source:"admin.manual",idempotencyKey:body.idempotencyKey,actorId:auth.identity.id});
    const result=job.status==="queued"?await runOne(`admin:${auth.identity.id}`):job;
    return Response.json({ok:true,job,result,deduplicated:job.status!=="queued"});
  }catch{return Response.json({ok:false,error:"The durable job could not be processed."},{status:503});}
}
