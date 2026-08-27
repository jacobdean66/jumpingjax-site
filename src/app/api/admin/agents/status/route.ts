import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadDashboard } from "@/lib/agent-manager/service";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth=await verifyAdminOwnerAccess();
  if(!auth.ok) return Response.json({ok:false,error:"Owner authorization required."},{status:401,headers:{"Cache-Control":"no-store"}});
  try{return Response.json({ok:true,dashboard:await loadDashboard()},{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({ok:false,error:"Agent Manager storage is unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
