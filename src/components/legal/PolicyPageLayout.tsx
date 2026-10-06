import Link from "next/link";
import type { ReactNode } from "react";

export function PolicyPageLayout({ title, current, children }: {
  title: string;
  current: "privacy" | "data-deletion";
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-cyan-100 px-4 py-10 text-slate-950 sm:px-6">
      <article className="mx-auto max-w-4xl rounded-3xl border-2 border-cyan-200 bg-white px-5 py-8 shadow-sm sm:px-9 sm:py-10">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">Last updated: <time dateTime="2026-10-06">October 6, 2026</time></p>
        <div className="mt-7 text-base [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-4 [&_p]:leading-7 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-6 [&_li]:leading-7 [&_a]:font-semibold [&_a]:text-cyan-800 [&_a]:underline [&_a]:underline-offset-4">
          {children}
        </div>
        <nav aria-label="Privacy and waiver links" className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-6 text-sm font-bold text-cyan-800">
          <Link href="/waiver" className="underline underline-offset-4">Participant waiver</Link>
          <Link href="/privacy" aria-current={current === "privacy" ? "page" : undefined} className="underline underline-offset-4">Privacy policy</Link>
          <Link href="/data-deletion" aria-current={current === "data-deletion" ? "page" : undefined} className="underline underline-offset-4">Data deletion instructions</Link>
        </nav>
      </article>
    </main>
  );
}
