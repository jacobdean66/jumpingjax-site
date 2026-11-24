import {AdminShell,AdminAuthError} from "../../_components";
import {verifyAdminAccess} from "@/lib/admin/session";
import {PublishedKnowledge} from "./PublishedKnowledge";

export const dynamic="force-dynamic";

export default async function StaffKnowledgePage(){
  const auth=await verifyAdminAccess();
  if(!auth.ok)return <AdminAuthError reason={auth.reason}/>;
  return <AdminShell><PublishedKnowledge/></AdminShell>;
}
