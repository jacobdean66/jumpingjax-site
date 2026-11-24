import {AdminShell,AdminAuthError} from "../../_components";
import {verifyAdminOwnerAccess} from "@/lib/admin/session";
import {PrivateRelease} from "./PrivateRelease";

export const dynamic="force-dynamic";

export default async function PrivateReleasePage(){
  const auth=await verifyAdminOwnerAccess();
  if(!auth.ok)return <AdminAuthError reason={auth.reason}/>;
  return <AdminShell><PrivateRelease/></AdminShell>;
}
