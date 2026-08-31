import Link from "next/link";

import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "@/app/admin/_components";
import { PrintButton } from "@/app/admin/PrintButton";
import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { InvitationAgentLink } from "@/components/facility-parties/InvitationAgentLink";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  buildFacilityWaiverInvitationUrl,
  buildQrCodeImageUrl,
  invitationTemplateLabel,
  formatInvitationDeliveryPreferences,
  normalizeInvitationDeliveryPreferences,
  normalizeInvitationQuantity,
  normalizeInvitationTemplateId,
} from "@/lib/facility-parties/invitations";
import { runInvitationAgent } from "@/lib/facility-parties/invitations/agent";
import { resolveInvitationSnapshot } from "@/lib/facility-parties/invitations/snapshot";
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
  invitation_quantity: number | null;
  invitation: unknown;
  balloon_colors: string | null;
  table_cloth_colors: string | null;
};

function clean(value: string | null | undefined): string {
  return value?.trim() || "";
}

function mailtoLink(input: {
  email: string | null;
  childName: string;
  date: string;
  waiverUrl: string;
}): string | null {
  const email = clean(input.email);
  if (!email) return null;
  const subject = "Jumping Jax birthday party invitation link";
  const body = [
    `Here is the Jumping Jax waiver link for ${input.childName || "the birthday party"}.`,
    "",
    input.date ? `Party date: ${input.date}` : "",
    `Waiver link: ${input.waiverUrl}`,
    "",
    "Guests can complete the waiver before the party.",
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
      "id, status, customer_name, email, phone, readable_date, readable_time, party_label, parent_name, child_name, child_age, party_theme, invitation_delivery_preference, invitation_template_id, invitation_quantity, invitation, balloon_colors, table_cloth_colors",
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
  const invitationQuantity = normalizeInvitationQuantity(data.invitation_quantity);
  const layout = resolvedSearch?.layout === "single" ? "single" : "sheet";
  const tokenQuery = resolvedSearch?.token
    ? `&token=${encodeURIComponent(resolvedSearch.token)}`
    : "";
  const singleHref = `/admin/facility/${encodeURIComponent(
    data.id,
  )}/invitations?layout=single${tokenQuery}`;
  const sheetHref = `/admin/facility/${encodeURIComponent(
    data.id,
  )}/invitations?layout=sheet${tokenQuery}`;
  const emailHref = mailtoLink({
    email: data.email,
    childName: clean(data.child_name),
    date: clean(data.readable_date),
    waiverUrl,
  });
  const storedSnapshot = resolveInvitationSnapshot({
    partyTheme: data.party_theme,
    stored: data.invitation,
    colorHint: `${clean(data.balloon_colors)} ${clean(data.table_cloth_colors)}`,
  });
  const agentResult = runInvitationAgent({
    action: layout === "single" ? "view-single" : "view-sheet",
    sourceText: storedSnapshot.sourceText,
    colorHint: storedSnapshot.colorHint,
    optionIndex: storedSnapshot.optionIndex,
    alternatesUsed: storedSnapshot.alternatesUsed,
    bookingId: data.id,
  });

  return (
    <AdminShell>
      <AdminHeader
        eyebrow="Facility Invitations"
        title={`${clean(data.child_name) || "Birthday"} invitations`}
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/api/facility/invitations/${encodeURIComponent(data.id)}/editable`}
            download
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white hover:bg-sky-700"
          >
            Download editable invitations
          </Link>
          <PrintButton
            label="Print invitations"
            invitation={{
              sourceText: clean(data.party_theme),
              bookingId: data.id,
            }}
          />
          <InvitationAgentLink
            href={singleHref}
            invitationAction="view-single"
            invitationTheme={agentResult.snapshot.sourceText}
            bookingId={data.id}
            optionIndex={agentResult.snapshot.optionIndex}
            alternatesUsed={agentResult.snapshot.alternatesUsed}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            Single invite
          </InvitationAgentLink>
          <InvitationAgentLink
            href={sheetHref}
            invitationAction="view-sheet"
            invitationTheme={agentResult.snapshot.sourceText}
            bookingId={data.id}
            optionIndex={agentResult.snapshot.optionIndex}
            alternatesUsed={agentResult.snapshot.alternatesUsed}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            4-up sheet
          </InvitationAgentLink>
          {emailHref ? (
            <InvitationAgentLink
              href={emailHref}
              invitationAction="email"
              invitationTheme={agentResult.snapshot.sourceText}
              bookingId={data.id}
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-black text-white hover:bg-sky-600"
            >
              Email link
            </InvitationAgentLink>
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
            size: ${layout === "single" ? "6in 4in" : "11in 8.5in"};
            margin: 0;
          }
        }
      `}</style>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 print:hidden">
        <div className="grid gap-3 text-sm font-semibold text-slate-700 sm:grid-cols-2 lg:grid-cols-6">
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
              Theme
            </span>
            {clean(data.party_theme) || "Classic birthday"}
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Quantity
            </span>
            {invitationQuantity} invitations · {invitationQuantity / 4} {invitationQuantity === 4 ? "sheet" : "sheets"}
          </p>
          <p>
            <span className="block text-xs font-black uppercase text-slate-500">
              Waiver link
            </span>
            <Link className="text-sky-700 underline" href={waiverUrl}>
              Open waiver
            </Link>
          </p>
        </div>
        {preferences.includes("office_pickup") ? (
          <p className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-950">
            Customer asked to pick these up at the office when they pay the deposit.
          </p>
        ) : null}
      </section>

      <section className={layout === "single" ? "mx-auto mt-6 max-w-xl print:mt-0" : "mt-6 print:mt-0"}>
        {layout === "single" ? (
          <PartyInvitationCard
            snapshot={agentResult.snapshot}
            childName={clean(data.child_name) || "Birthday Star"}
            childAge={clean(data.child_age)}
            dateLabel={clean(data.readable_date)}
            timeLabel={clean(data.readable_time)}
            waiverUrl={waiverUrl}
            qrUrl={qrUrl}
          />
        ) : (
          <InvitationSheet
            snapshot={agentResult.snapshot}
            childName={clean(data.child_name) || "Birthday Star"}
            childAge={clean(data.child_age)}
            dateLabel={clean(data.readable_date)}
            timeLabel={clean(data.readable_time)}
            waiverUrl={waiverUrl}
            qrUrl={qrUrl}
            invitationQuantity={invitationQuantity}
          />
        )}
      </section>
    </AdminShell>
  );
}
