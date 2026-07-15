"use client";

import { BrandedErrorState } from "@/components/BrandedErrorState";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <BrandedErrorState
      eyebrow="Temporary Website Issue"
      title="We’re Having a Temporary Website Issue"
      description="We’re working to get everything operating normally again. Please try refreshing the page or return to the homepage. If you need immediate assistance with a booking, rental, or party, contact Jumping Jax directly."
      retryAction={
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-orange-600 px-7 py-3 text-center text-base font-black text-white shadow-[0_5px_0_rgba(154,52,18,0.25)] transition hover:-translate-y-0.5 hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 focus-visible:ring-offset-2 active:translate-y-0"
        >
          Try Again
        </button>
      }
      actions={[{ href: "/", label: "Return to Home" }]}
    />
  );
}
