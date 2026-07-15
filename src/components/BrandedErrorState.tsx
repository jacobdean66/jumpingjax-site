import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const contactLinkClasses =
  "group rounded-3xl border-2 border-cyan-100 bg-cyan-50 px-5 py-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 focus-visible:ring-offset-2";

type RecoveryAction = {
  href: string;
  label: string;
  emphasis?: "primary" | "secondary";
};

type BrandedErrorStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions: RecoveryAction[];
  retryAction?: ReactNode;
};

export function BrandedErrorState({
  eyebrow,
  title,
  description,
  actions,
  retryAction,
}: BrandedErrorStateProps) {
  return (
    <main className="relative isolate min-h-[70vh] overflow-hidden bg-cyan-100 px-4 py-12 text-slate-950 sm:px-6 sm:py-16">
      <div
        aria-hidden="true"
        className="absolute -left-16 top-20 -z-10 h-44 w-44 rounded-full bg-yellow-300/60 blur-sm sm:h-56 sm:w-56"
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 bottom-16 -z-10 h-52 w-52 rounded-full bg-pink-300/45 blur-sm sm:h-64 sm:w-64"
      />

      <section className="mx-auto max-w-5xl rounded-[2rem] border-2 border-white bg-white/95 px-5 py-8 shadow-[0_20px_60px_rgba(8,145,178,0.18)] sm:px-10 sm:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <Image
            src="/logo.png"
            alt="Jumping Jax"
            width={320}
            height={130}
            priority
            className="mx-auto h-auto w-48 sm:w-64"
          />
          <span className="mt-6 inline-flex rounded-full border border-orange-200 bg-orange-100 px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-orange-900">
            {eyebrow}
          </span>
          <h1 className="mt-5 text-balance text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">
            {description}
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {retryAction}
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={
                  action.emphasis === "primary"
                    ? "inline-flex min-h-12 items-center justify-center rounded-full bg-orange-600 px-7 py-3 text-center text-base font-black text-white shadow-[0_5px_0_rgba(154,52,18,0.25)] transition hover:-translate-y-0.5 hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 focus-visible:ring-offset-2 active:translate-y-0"
                    : "inline-flex min-h-12 items-center justify-center rounded-full border-2 border-cyan-200 bg-cyan-50 px-7 py-3 text-center text-base font-bold text-cyan-950 transition hover:-translate-y-0.5 hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 focus-visible:ring-offset-2 active:translate-y-0"
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-4xl border-t-2 border-dashed border-cyan-100 pt-8">
          <div className="text-center">
            <h2 className="text-2xl font-black sm:text-3xl">Need Help?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Our team is happy to help with a party, rental, or existing booking.
            </p>
          </div>

          <address className="mt-6 grid gap-3 not-italic sm:grid-cols-3">
            <a href="tel:+18649331420" className={contactLinkClasses}>
              <span className="block text-xs font-black uppercase tracking-wider text-cyan-800">
                Karen McClain
              </span>
              <span className="mt-2 block font-bold text-slate-950 group-hover:text-cyan-900">
                Text or call 864-933-1420
              </span>
            </a>
            <a href="tel:+18649532396" className={contactLinkClasses}>
              <span className="block text-xs font-black uppercase tracking-wider text-cyan-800">
                Jumping Jax Facility
              </span>
              <span className="mt-2 block font-bold text-slate-950 group-hover:text-cyan-900">
                Call 864-953-2396
              </span>
            </a>
            <a
              href="mailto:karen.mcclain.jumpingjaxllc@gmail.com"
              className={contactLinkClasses}
            >
              <span className="block text-xs font-black uppercase tracking-wider text-cyan-800">
                Email
              </span>
              <span className="mt-2 block break-words text-sm font-bold text-slate-950 group-hover:text-cyan-900">
                karen.mcclain.jumpingjaxllc@gmail.com
              </span>
            </a>
          </address>
        </div>
      </section>
    </main>
  );
}
