"use client";

import { Printer } from "lucide-react";

export function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-sky-950 px-4 py-2 font-black text-white hover:bg-sky-900 print:hidden"
    >
      <Printer className="h-4 w-4" /> Print invoice
    </button>
  );
}
