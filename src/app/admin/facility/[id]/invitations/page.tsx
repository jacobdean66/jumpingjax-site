import Link from "next/link";

import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "@/app/admin/_components";
import { PrintButton } from "@/app/admin/PrintButton";
import { FacilityInvitationPreview } from "@/components/facility-parties/FacilityInvitationPreview";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  buildPublicFacilityInvitationUrl,
  buildFacilityWaiverInvitationUrl,
  buildQrCodeImageUrl,
  invitationTemplateLabel,
  formatInvitationDeliveryPreferences,
  normalizeInvitationDeliveryPreferences,
  normalizeInvitationTemplateId,
  resolveInvitationTheme,
} from "@/lib/facility-parties/invitations";
import { createFacilityInvitationShareToken } from "@/lib/facility-parties/invitation-share-token";
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
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  readable_date: string | null;
  readable_time: string | null;
  party_label: string | null;
  parent_name: string | null;
  child_name: string | null;
  child_age: string | null;
  party_theme: string | null;
  invitation_delivery_preference: string | null;
  invitation_template_id: string | null;
};

function clean(value: string | null | undefined): string {
  return value?.trim() || "";
}

function mailtoLink(input: {
  email: string | null;
  childName: string;
  date: string;
  singleUrl: string;
  printableUrl: string;
}): string | null {
  const email = clean(input.email);
  if (!email) return null;
  const subject = "Your Jumping Jax birthday party invitations";
  const body = [
    `Here are the Jumping Jax invitations for ${input.childName || "the birthday party"}.`,
    "",
    input.date ? `Party date: ${input.date}` : "",
    `Printable 4-per-page sheet: ${input.printableUrl}`,
    `Single invitation: ${input.singleUrl}`,
    "",
    "The printable sheet has a Print button. Each invitation includes the waiver QR code for guest check-in.",
  ]
    .filter(Boolean)
    .join("\n");
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

export default async function FacilityInvitationsPage({
  params,
  searchParams,
}: Props) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const auth = await verifyAdminAccess(resolvedSearch?.token ?? "");
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_bookings")
    .select(
      "id, status, customer_name, email, phone, readable_date, readable_time, party_label, parent_name, child_name, child_age, party_theme, invitation_delivery_preference, invitation_template_id",
    )
    .eq("id", resolvedParams.id)
    .maybeSingle<FacilityInvitationRow>();

  if (error) throw new Error(error.message);

  if (!data) {
    return (
      <AdminShell>
        <AdminHeader eyebrow="Facility Invitations" title="Party not found" />
        <AdminNav token="" role={auth.role} active="facility" />
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="font-bold">This facility party could not be found.</p>
        </div>
      </AdminShell>
    );
  }

  const waiverUrl = buildFacilityWaiverInvitationUrl({
    siteUrl: CANONICAL_PRODUCTION_SITE_URL,
    bookingId: data.id,
    partyDate: data.readable_date,
  });
  const qrUrl = buildQrCodeImageUrl(waiverUrl, 240);
  const preferences = normalizeInvitationDeliveryPreferences(
    data.invitation_delivery_preference,
  );
  const templateId = normalizeInvitationTemplateId(data.invitation_template_id);
  const layout = resolvedSearch?.layout === "single" ? "single" : "sheet";
  const shareToken = createFacilityInvitationShareToken(data.id);
  const tokenQuery = resolvedSearch?.token
    ? `&token=${encodeURIComponent(resolvedSearch.token)}`
    : "";
  const singleHref = `/admin/facility/${encodeURIComponent(
    data.id,
  )}/invitations?layout=single${tokenQuery}`;
  const sheetHref = `/admin/facility/${encodeURIComponent(
    data.id,
  )}/invitations?layout=sheet${tokenQuery}`;
  const publicSingleHref = buildPublicFacilityInvitationUrl({
    siteUrl: CANONICAL_PRODUCTION_SITE_URL,
    bookingId: data.id,
    token: shareToken,
    layout: "single",
  });
  const publicSheetHref = buildPublicFacilityInvitationUrl({
    siteUrl: CANONICAL_PRODUCTION_SITE_URL,
    bookingId: data.id,
    token: shareToken,
    layout: "sheet",
  });
  const emailHref = mailtoLink({
    email: data.email,
    childName: clean(data.child_name),
    date: clean(data.readable_date),
    singleUrl: publicSingleHref,
    printableUrl: publicSheetHref,
  });

  return (
    <AdminShell>
      <AdminHeader
        eyebrow="Facility Invitations"
        title={`${clean(data.child_name) || "Birthday"} invitations`}
      >
        <div className="flex flex-wrap gap-2">
          <PrintButton label="Print invitations" />
          <Link
            href={singleHref}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            Single invite
          </Link>
          <Link
            href={sheetHref}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            4-up sheet
          </Link>
          {emailHref ? (
            <Link
              href={emailHref}
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-black text-white hover:bg-sky-600"
            >
              Email invitations
            </Link>
          ) : null}
          <Link
            href={`/admin/facility/${encodeURIComponent(data.id)}/guest-list`}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"
          >
            Guest list
          </Link>
          <Link
            href={`/admin/facility#booking-${encodeURIComponent(data.id)}`}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            Back to facility
          </Link>
        </div>
      </AdminHeader>
      <AdminNav token="" role={auth.role} active="facility" />

      <style>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 0.35in;
          }
        }
      `}</style>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 print:hidden">
        <div className="grid gap-3 text-sm font-semibold text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Customer
            </span>
            {clean(data.customer_name) || "Guest"}
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Party
            </span>
            {clean(data.party_label) || "Facility party"}
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Preference
            </span>
            {formatInvitationDeliveryPreferences(preferences)}
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Design
            </span>
            {invitationTemplateLabel(templateId)}
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Waiver link
            </span>
            <Link className="text-sky-700 underline" href={waiverUrl}>
              Open waiver
            </Link>
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Customer links
            </span>
            <Link className="text-sky-700 underline" href={publicSheetHref}>
              Printable sheet
            </Link>
            <span className="px-2 text-slate-400">/</span>
            <Link className="text-sky-700 underline" href={publicSingleHref}>
              Single invite
            </Link>
          </p>
        </div>
        {preferences.includes("office_pickup") ? (
          <p className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-950">
            Customer asked to pick these up at the office when they pay the deposit.
          </p>
        ) : null}
      </section>

      <section
        className={
          layout === "single"
            ? "mx-auto mt-6 max-w-xl print:mt-0"
            : "mt-6 grid gap-4 md:grid-cols-2 print:mt-0 print:grid-cols-2 print:gap-[0.18in]"
        }
      >
        {(layout === "single" ? [1] : [1, 2, 3, 4]).map((copy) => (
          <FacilityInvitationPreview
            key={copy}
            childName={clean(data.child_name) || "You're invited"}
            partyTheme={
              clean(data.party_theme) || resolveInvitationTheme(data.party_theme).label
            }
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
    </AdminShell>
  );
}
