import Link from "next/link";
import { loadAiAdMemory } from "@/lib/admin/ai-ads";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

function ratingLabel(rating?: "like" | "dislike" | null) {
  if (rating === "like") return "Liked";
  if (rating === "dislike") return "Disliked";
  return "Unrated";
}

function ratingClass(rating?: "like" | "dislike" | null) {
  if (rating === "like") {
    return "border-emerald-200 bg-emerald-100 text-emerald-950";
  }
  if (rating === "dislike") {
    return "border-rose-200 bg-rose-100 text-rose-950";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function AuthError() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
          AI Ads
        </p>
        <h1 className="mt-3 text-3xl font-black">
            Owner access required
        </h1>
        <p className="mt-3 leading-relaxed text-slate-600">
          Sign in with the owner account to review generated ad videos.
        </p>
      </section>
    </main>
  );
}

export default async function AdminAiAdsPage() {
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) return <AuthError />;

  const items = (await loadAiAdMemory(40)).filter(
    (item) => item.role === "assistant" && item.video_url
  );
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Jumping Jax Admin
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
              AI Ads
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Review generated videos, prompt history, and like/dislike ratings
              before using anything in marketing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
            >
              Admin home
            </Link>
            <Link
              href="https://ai-video-app-orcin.vercel.app/ai-video"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white hover:bg-violet-700"
            >
              Open generator full screen
            </Link>
            <Link
              href="/admin/recovery-snapshot"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 hover:bg-slate-50"
            >
              Download recovery snapshot
            </Link>
          </div>
        </header>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                Generator
              </p>
              <h2 className="mt-1 text-2xl font-black">Create and tune ads</h2>
            </div>
            <p className="text-sm font-bold text-slate-500">
              Results save below after generation.
            </p>
          </div>
          <iframe
            src="https://ai-video-app-orcin.vercel.app/ai-video"
            title="AI video generator"
            className="h-[920px] w-full border-0 bg-zinc-950"
          />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Library
              </p>
              <h2 className="text-2xl font-black">Previous videos</h2>
            </div>
            <p className="text-sm font-bold text-slate-500">
              Small previews for quick scanning.
            </p>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              No generated AI ads found yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((item) => (
                <article
                  key={item.id ?? item.video_url}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  {item.video_url && (
                    <video
                      src={item.video_url}
                      controls
                      preload="metadata"
                      className="aspect-video w-full bg-slate-950 object-cover"
                    />
                  )}
                  <div className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${ratingClass(item.rating)}`}
                      >
                        {ratingLabel(item.rating)}
                      </span>
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {item.model === "high" ? "Kling" : "Wan"}
                      </span>
                      {item.duration ? (
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {item.duration}s
                        </span>
                      ) : null}
                    </div>

                    <p className="line-clamp-2 text-xs font-black leading-snug text-slate-950">
                      {item.prompt ?? item.content}
                    </p>
                    {item.created_at ? (
                      <p className="text-[11px] font-bold text-slate-400">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
