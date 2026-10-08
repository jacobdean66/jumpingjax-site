import { PartyTaskPage, type PartyTaskParams } from "../PartyTaskPage";
export const dynamic = "force-dynamic";
export default function InvitationsPage({ searchParams }: { searchParams: Promise<PartyTaskParams> }) {
  return <PartyTaskPage task="invitations" searchParams={searchParams} />;
}
