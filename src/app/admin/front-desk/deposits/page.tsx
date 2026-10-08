import { PartyTaskPage, type PartyTaskParams } from "../PartyTaskPage";
export const dynamic = "force-dynamic";
export default function DepositsPage({ searchParams }: { searchParams: Promise<PartyTaskParams> }) {
  return <PartyTaskPage task="deposits" searchParams={searchParams} />;
}
