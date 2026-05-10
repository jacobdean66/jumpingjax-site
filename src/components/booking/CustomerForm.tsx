"use client";

export type CustomerFields = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventAddress: string;
};

type Props = {
  value: CustomerFields;
  onChange: (next: CustomerFields) => void;
};

export function CustomerForm({ value, onChange }: Props) {
  const patch = (partial: Partial<CustomerFields>) =>
    onChange({ ...value, ...partial });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <h3 className="text-sm font-black uppercase tracking-wide text-cyan-200">
        Your details
      </h3>
      <p className="mt-2 text-xs text-slate-400">
        We&apos;ll only use this to follow up on your request (not sent anywhere
        in this demo).
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Full name
          </span>
          <input
            type="text"
            name="customerName"
            autoComplete="name"
            value={value.customerName}
            onChange={(e) => patch({ customerName: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
            placeholder="Jordan Lee"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Email
          </span>
          <input
            type="email"
            name="customerEmail"
            autoComplete="email"
            value={value.customerEmail}
            onChange={(e) => patch({ customerEmail: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Phone
          </span>
          <input
            type="tel"
            name="customerPhone"
            autoComplete="tel"
            value={value.customerPhone}
            onChange={(e) => patch({ customerPhone: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
            placeholder="(864) 555-0199"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Event address
          </span>
          <textarea
            name="eventAddress"
            rows={3}
            value={value.eventAddress}
            onChange={(e) => patch({ eventAddress: e.target.value })}
            className="mt-1.5 w-full resize-y rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
            placeholder="Street, city, ZIP — helps us plan delivery"
          />
        </label>
      </div>
    </div>
  );
}
