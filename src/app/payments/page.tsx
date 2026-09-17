import type { Metadata } from "next";
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
    <main className="min-h-screen bg-[#f5f7f9] px-4 py-10 text-slate-950 sm:px-6 sm:py-14">
      <PaymentHub bookingId={bookingId} rentalAmount={rentalAmount} />
    </main>
  );
}
