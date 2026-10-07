import { HostGuestListClient } from "./HostGuestListClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your party guest list | Jumping Jax", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function HostGuestListPage({ searchParams }: { searchParams: Promise<{ booking?: string; token?: string }> }) {
  const params = await searchParams;
  return <HostGuestListClient bookingId={params.booking ?? ""} token={params.token ?? ""} />;
}
