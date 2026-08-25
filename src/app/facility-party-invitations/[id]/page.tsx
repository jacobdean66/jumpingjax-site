import Link from "next/link";

import { PrintButton } from "@/components/PrintButton";
import { FacilityInvitationPreview } from "@/components/facility-parties/FacilityInvitationPreview";
import {
  buildFacilityWaiverInvitationUrl,
  buildPublicFacilityInvitationUrl,
  buildQrCodeImageUrl,
  normalizeInvitationTemplateId,
} from "@/lib/facility-parties/invitations";
import { createFacilityInvitationShareToken, verifyFacilityInvitationShareToken } from "@/lib/facility-parties/invitation-share-token";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ layout?: string; token?: string }>;
};

type FacilityInvitationRow = {
  id: string;
  status: string | null;
  readable_date: string | null;
  readable_time: string | null;
  child_name: string | null;
  party_theme: string | null;
  invitation_template_id: string | null;
};

function clean(value: string | null | undefined): string {
  return value?.trim() || "";
}

export default async function PublicFacilityInvitationPage({
  params,
  searchParams,
}: Props) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const bookingId = resolvedParams.id;
  const tokenResult = verifyFacilityInvitationShareToken(
    resolvedSearch?.token,
    bookingId,
  );

  if (!tokenResult.ok) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase text-slate-500">
            Jumping Jax invitation
          </p>
          <h1 className="mt-2 text-3xl font-black">Invitation link expired</h1>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Please ask the party host or Jumping Jax for a new invitation link.
          </p>
        </section>
      </main>
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_bookings")
    .select(
      "id, status, readable_date, readable_time, child_name, party_theme, invitation_template_id",
    )
    .eq("id", bookingId)
    .in("status", ["pending", "confirmed"])
    .maybeSingle<FacilityInvitationRow>();

  if (error) throw new Error(error.message);

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase text-slate-500">
            Jumping Jax invitation
          </p>
          <h1 className="mt-2 text-3xl font-black">Party not found</h1>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            This invitation is no longer available.
          </p>
        </section>
      </main>
    );
  }

  const layout = resolvedSearch?.layout === "single" ? "single" : "sheet";
  const templateId = normalizeInvitationTemplateId(data.invitation_template_id);
  const shareToken = createFacilityInvitationShareToken(data.id);
  const singleHref = buildPublicFacilityInvitationUrl({
    siteUrl: CANONICAL_PRODUCTION_SITE_URL,
    bookingId: data.id,
    token: shareToken,
    layout: "single",
  });
  const sheetHref = buildPublicFacilityInvitationUrl({
    siteUrl: CANONICAL_PRODUCTION_SITE_URL,
    bookingId: data.id,
    token: shareToken,
    layout: "sheet",
  });
  const waiverUrl = buildFacilityWaiverInvitationUrl({
    siteUrl: CANONICAL_PRODUCTION_SITE_URL,
    bookingId: data.id,
    partyDate: data.readable_date,
  });
  const qrUrl = buildQrCodeImageUrl(waiverUrl, 240);
  const childName = clean(data.child_name) || "You're invited";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 print:bg-white print:p-0">
      <style>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 0.35in;
          }
        }
      `}</style>

      <section className="mx-auto mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Jumping Jax invitation
          </p>
          <h1 className="mt-1 text-2xl font-black">
            {layout === "single" ? "Single invitation" : "Printable invitation sheet"}
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {layout === "single"
              ? "Use this for texting or emailing one guest."
              : "Print this page for four invitations on one landscape sheet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton label="Print" />
          <Link
            href={singleHref}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700"
          >
            Single
          </Link>
          <Link
            href={sheetHref}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700"
          >
            4 per sheet
          </Link>
        </div>
      </section>

      <section
        className={
          layout === "single"
            ? "mx-auto max-w-xl print:mt-0"
            : "mx-auto grid max-w-5xl gap-4 md:grid-cols-2 print:mt-0 print:max-w-none print:grid-cols-2 print:gap-[0.18in]"
        }
      >
        {(layout === "single" ? [1] : [1, 2, 3, 4]).map((copy) => (
          <FacilityInvitationPreview
            key={copy}
            childName={childName}
            partyTheme={clean(data.party_theme)}
            readableDate={clean(data.readable_date)}
            readableTime={clean(data.readable_time)}
            waiverUrl={waiverUrl}
            qrUrl={qrUrl}
            templateId={templateId}
            copy={layout === "single" ? undefined : copy}
            mode={layout === "single" ? "single" : "sheet"}
          />
        ))}
      </section>
    </main>
  );
}
