import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  listSocialPosts,
  type SocialPost,
} from "@/lib/social-posts/social-post-data";
import { SOCIAL_SOURCE_IMAGES } from "@/lib/social-posts/social-source-images";
import AgentDraftForm from "./AgentDraftForm";
import SourceImageField from "./SourceImageField";
import SocialPostsAdminClient from "./SocialPostsAdminClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    message?: string;
    error?: string;
  }>;
};

function AuthError({
  reason,
}: {
  reason: "missing_config" | "invalid_token";
}) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
          Social Posts
        </p>
        <h1 className="mt-3 text-3xl font-black">
          {reason === "missing_config"
            ? "Admin token not configured"
            : "Invalid admin link"}
        </h1>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default async function AdminSocialPostsPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let posts: SocialPost[] = [];
  let loadError = "";

  try {
    posts = await listSocialPosts();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Social posts could not be loaded.";
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Jumping Jax Admin
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
              Social Post Drafts
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Draft, review, approve, reject, and schedule social media posts.
              Meta posting is intentionally not connected yet.
            </p>
          </div>
          <Link
            href={query ? `/admin?${query}` : "/admin"}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
          >
            Admin home
          </Link>
        </header>

        {resolved?.message ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
            {resolved.message}
          </div>
        ) : null}
        {resolved?.error || loadError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {resolved?.error ?? loadError}
          </div>
        ) : null}

        <AgentDraftForm token={token} sourceImages={SOCIAL_SOURCE_IMAGES} />

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Create Test Draft
            </p>
            <h2 className="mt-1 text-2xl font-black">New social post</h2>
          </div>

          <form action="/api/social-posts" method="post" className="grid gap-4 lg:grid-cols-2">
            <input type="hidden" name="token" value={token} />
            <Field label="Title">
              <input
                name="title"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Weekend bounce house promo"
              />
            </Field>
            <Field label="Media URL">
              <input
                name="media_url"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="https://..."
              />
            </Field>
            <Field label="Source image URL for video">
              <SourceImageField images={SOCIAL_SOURCE_IMAGES} />
            </Field>
            <Field label="Prompt">
              <textarea
                name="prompt"
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Prompt or creative brief"
              />
            </Field>
            <Field label="Caption">
              <textarea
                name="caption"
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Draft caption"
              />
            </Field>
            <Field label="Media type">
              <select
                name="media_type"
                defaultValue="image"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </Field>
            <div>
              <p className="text-sm font-black text-slate-700">Platforms</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
                  <input type="checkbox" name="platforms" value="facebook" defaultChecked />
                  Facebook
                </label>
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
                  <input type="checkbox" name="platforms" value="instagram" defaultChecked />
                  Instagram
                </label>
              </div>
            </div>
            <div className="lg:col-span-2">
              <button
                type="submit"
                className="min-h-11 w-full rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700 sm:w-auto"
              >
                Create Test Draft
              </button>
            </div>
          </form>
        </section>

        {loadError ? null : (
          <SocialPostsAdminClient
            posts={posts}
            token={token}
            sourceImages={SOCIAL_SOURCE_IMAGES}
          />
        )}
      </section>
    </main>
  );
}
