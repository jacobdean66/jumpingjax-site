"use client";

export function PrintAgreementButton() {
  return <button type="button" onClick={() => window.print()} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800 print:hidden">Print agreement &amp; receipt</button>;
}
