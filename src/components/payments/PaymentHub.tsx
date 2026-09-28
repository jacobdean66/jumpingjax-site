/* eslint-disable @next/next/no-img-element */
import { CreditCard, ExternalLink, QrCode, ReceiptText } from "lucide-react";
import {
  FACILITY_DEPOSIT_AMOUNT,
  SWIPESIMPLE_FACILITY_DEPOSIT_URL,
  SWIPESIMPLE_GENERAL_PAYMENT_URL,
  SWIPESIMPLE_RENTAL_PAYMENT_URL,
  adjustedCardTotal,
  buildPaymentQrCodeUrl,
  formatPaymentAmount,
} from "@/lib/payments/swipesimple";

type PaymentHubProps = {
  bookingId?: string | null;
  rentalAmount?: number | null;
  showGeneralPayment?: boolean;
  showQrCodes?: boolean;
};

type PaymentOptionProps = {
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  amountLabel?: string;
  detail: string;
  showQrCode: boolean;
};

function PaymentOption({
  title,
  description,
  href,
  buttonLabel,
  amountLabel,
  detail,
  showQrCode,
}: PaymentOptionProps) {
  return (
    <article className="grid gap-5 border-t border-slate-200 py-7 first:border-t-0 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-600">
          {description}
        </p>
        {amountLabel ? (
          <p className="mt-3 text-lg font-black text-emerald-800">{amountLabel}</p>
        ) : null}
        <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">
          {detail}
        </p>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
        >
          {buttonLabel}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
      {showQrCode ? (
        <div className="w-fit border border-slate-200 bg-white p-3">
          <img
            src={buildPaymentQrCodeUrl(href, 180)}
            alt={`QR code for ${title}`}
            width={180}
            height={180}
            className="h-40 w-40"
          />
          <p className="mt-2 flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
            <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
            Scan to pay
          </p>
        </div>
      ) : null}
    </article>
  );
}

export function PaymentHub({
  bookingId,
  rentalAmount,
  showGeneralPayment = true,
  showQrCodes = true,
}: PaymentHubProps) {
  const validRentalAmount =
    typeof rentalAmount === "number" && Number.isFinite(rentalAmount) && rentalAmount > 0
      ? rentalAmount
      : null;
  const depositCardTotal = adjustedCardTotal(FACILITY_DEPOSIT_AMOUNT);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3 text-emerald-800">
          <CreditCard className="h-6 w-6" aria-hidden="true" />
          <p className="text-sm font-black uppercase">Secure payments</p>
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-5xl">
          Jumping Jax Payments
        </h1>
        <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-slate-600">
          Choose the payment that matches your booking. Card details are entered
          only on SwipeSimple&apos;s secure checkout page.
        </p>
        {bookingId ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-black text-slate-800">
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
            Booking number: <span className="font-mono">{bookingId}</span>
          </p>
        ) : null}
      </div>

      <PaymentOption
        title="Facility party deposit"
        description="Pay the $50 deposit for a Jumping Jax facility party. The remaining facility-party balance is paid in cash."
        href={SWIPESIMPLE_FACILITY_DEPOSIT_URL}
        buttonLabel="Pay facility deposit"
        amountLabel={`${formatPaymentAmount(FACILITY_DEPOSIT_AMOUNT)} deposit + 3% = ${formatPaymentAmount(depositCardTotal)} card total`}
        detail="Enter your facility booking number in SwipeSimple's Invoice Number field."
        showQrCode={showQrCodes}
      />

      <PaymentOption
        title="Rental payment"
        description="Pay an approved inflatable, foam-party, accessory, or delivery rental in full. Enter the base rental total provided by Jumping Jax; SwipeSimple adds the 3% card adjustment."
        href={SWIPESIMPLE_RENTAL_PAYMENT_URL}
        buttonLabel="Pay rental in full"
        amountLabel={
          validRentalAmount !== null
            ? `${formatPaymentAmount(validRentalAmount)} rental total + 3% = ${formatPaymentAmount(adjustedCardTotal(validRentalAmount))} card total`
            : undefined
        }
        detail="Enter the approved base amount and your rental booking number in SwipeSimple."
        showQrCode={showQrCodes}
      />

      {showGeneralPayment ? (
        <PaymentOption
          title="General payment"
          description="Use this for another amount requested by Jumping Jax, including front-counter or miscellaneous payments."
          href={SWIPESIMPLE_GENERAL_PAYMENT_URL}
          buttonLabel="Make a general payment"
          detail="Enter the base amount and a booking, invoice, or reference number. SwipeSimple adds 3%."
          showQrCode={showQrCodes}
        />
      ) : null}

      <div className="border-t border-slate-200 pt-5 text-sm leading-relaxed text-slate-600">
        <p className="font-bold text-slate-900">Before paying</p>
        <p className="mt-1">
          Confirm the payment type, base amount, and booking number. Payment does
          not replace Jumping Jax approval of a pending booking request.
        </p>
      </div>
    </div>
  );
}
