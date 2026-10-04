"use client";
export function PrintAgreementButton() { return <button type="button" onClick={() => window.print()} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white print:hidden">Print / save PDF</button>; }
