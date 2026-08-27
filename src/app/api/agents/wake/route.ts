import { runOne } from "@/lib/agent-manager/service";

export const maxDuration=30;
export async function POST(request:Request){const secret=process.env.AGENT_MANAGER_WAKE_SECRET||process.env.CRON_SECRET;const supplied=request.headers.get("authorization");if(!secret||supplied!==`Bearer ${secret}`)return Response.json({ok:false,error:"Unauthorized"},{status:401});try{const job=await runOne(`wake:${crypto.randomUUID()}`);return Response.json({ok:true,processed:job?.id??null});}catch{return Response.json({ok:false,error:"Wake failed safely."},{status:503});}}
