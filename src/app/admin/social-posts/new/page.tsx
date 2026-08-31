import Link from "next/link";
import SocialPostsPageHeader from "@/app/admin/social-posts/SocialPostsPageHeader";
import AgentDraftForm from "@/app/admin/social-posts/AgentDraftForm";
import SourceImageField from "@/app/admin/social-posts/SourceImageField";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { getAgentUiProtectionStatus } from "@/lib/social-posts/agents/agent-ui-protection";
import { SOCIAL_SOURCE_IMAGES } from "@/lib/social-posts/social-source-images";

export const dynamic = "force-dynamic";
type Props = { searchParams?: Promise<{ token?: string; message?: string; error?: string }> };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-black text-slate-700">{label}</span><div className="mt-1">{children}</div></label>;
}

export default async function NewSocialPostPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const agentUiProtection = await getAgentUiProtectionStatus();

  return (
    <main className="sp-page"><section className="sp-container">
      <SocialPostsPageHeader title="Create Social Post" description="Build one post here, then return to the compact draft library to open its editor." query={query.slice(1)} singleLineTitle />
      <Link href={`/admin/social-posts${query}`} className="mt-4 inline-flex text-sm font-black text-violet-700 hover:text-violet-900">← Back to draft cards</Link>
      {resolved?.message ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">{resolved.message}</div> : null}
      {resolved?.error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">{resolved.error}</div> : null}

      <AgentDraftForm token={token} sourceImages={SOCIAL_SOURCE_IMAGES} agentUiProtection={agentUiProtection} />

      <details className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none p-4 text-sm font-black text-slate-900 sm:p-5">Create a manual test draft</summary>
        <form action="/api/social-posts" method="post" className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-2 sm:p-5">
          <input type="hidden" name="token" value={token} />
          <Field label="Title"><input name="title" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder="Weekend bounce house promo" /></Field>
          <Field label="Media URL"><input name="media_url" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder="https://..." /></Field>
          <Field label="Source image URL"><SourceImageField images={SOCIAL_SOURCE_IMAGES} /></Field>
          <Field label="Media type"><select name="media_type" defaultValue="image" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value="image">Image</option><option value="video">Video</option></select></Field>
          <Field label="Prompt"><textarea name="prompt" rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Prompt or creative brief" /></Field>
          <Field label="Caption"><textarea name="caption" rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Draft caption" /></Field>
          <div className="lg:col-span-2"><button type="submit" className="min-h-11 rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white">Create manual draft</button></div>
        </form>
      </details>
    </section></main>
  );
}
