import type { Metadata } from "next";
import Link from "next/link";
import { PaymentHub } from "@/components/payments/PaymentHub";

export const metadata: Metadata = {
  title: "Payments",
  description: "Securely pay a Jumping Jax facility deposit or rental balance.",
};

type Props = {
  searchParams?: Promise<{
    booking?: string;
    amount?: string;
  }>;
};

export default async function PaymentsPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const bookingId = resolved?.booking?.trim() || null;
  const parsedAmount = Number(resolved?.amount);
  const rentalAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null;

  return (
    <main className="min-h-screen bg-[#f5f7f9] text-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-black text-slate-950">
            Jumping Jax
          </Link>
          <a
            href="tel:8649331420"
            className="text-sm font-black text-emerald-800 hover:text-emerald-700"
          >
            864-933-1420
          </a>
        </div>
      </header>
      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <PaymentHub bookingId={bookingId} rentalAmount={rentalAmount} />
      </section>
    </main>
  );
}
