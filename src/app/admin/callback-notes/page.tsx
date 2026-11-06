import { verifyAdminAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { CallbackNoteReview } from "../answering-machine/CallbackNoteReview";

export const dynamic = "force-dynamic";
export default async function CallbackNotesPage() {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const result = await createServiceRoleClient().from("receptionist_callback_notes")
    .select("id,caller_name,phone,reason,caller_created_at").eq("status","needs_review")
    .order("created_at", { ascending: false }).limit(51);
  const notes = result.data ?? [];
  return <AdminShell>
    <AdminHeader eyebrow="Front Desk" title="Receptionist callback notes"><AdminNav token="" role={auth.role} active="callback-notes" compact /></AdminHeader>
    <section className="my-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-slate-700">These requests need staff review. Marking one reviewed does not call or message the customer.</p>
      {result.error ? <p className="mt-2 text-sm font-semibold text-red-700">Callback notes are unavailable. Check the receptionist inbox directly.</p> :
        notes.length === 0 ? <p className="mt-2 text-sm">No callback notes need review.</p> :
        <ul className="mt-3 space-y-3">{notes.slice(0,50).map(note => <li key={note.id} className="rounded-lg bg-white p-3 text-sm">
          <p className="font-bold">{note.caller_name} · {note.phone}</p><p className="whitespace-pre-wrap">{note.reason}</p>
          <p className="text-xs text-slate-600">Requested {new Date(note.caller_created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</p>
          <CallbackNoteReview id={note.id} />
        </li>)}</ul>}
      {notes.length > 50 ? <p className="mt-2 text-sm font-bold">More callback notes need review.</p> : null}
    </section>
  </AdminShell>;
}
