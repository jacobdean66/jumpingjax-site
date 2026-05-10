"use client";

import { RentalItem } from "@/lib/types";
import { contact } from "@/data/site";
import { Phone, Mail, Calendar, ArrowRight } from "lucide-react";

interface RentalBookingCTAProps {
  rental: RentalItem;
}

export default function RentalBookingCTA({ rental }: RentalBookingCTAProps) {
  const handleBookingClick = () => {
    window.open(
      "https://www.facebook.com/share/1ChMgQfUjo/?mibextid=wwXIfr",
      "_blank"
    );
  };

  return (
    <section className="bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent px-4 py-14 md:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="px-5 py-8 sm:px-6 md:px-10 md:py-12 lg:px-12">
            <div className="grid items-center gap-8 md:grid-cols-[1.15fr_0.85fr]">
              <div>
                <h2 className="mb-4 text-balance text-3xl font-black tracking-tight text-white md:text-4xl lg:text-5xl">
                  Ready to Book?
                </h2>
                <p className="mb-7 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  Contact us today to reserve {rental.name} for your next event.
                  We handle setup, delivery, and takedown.
                </p>

                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Calendar className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
                    <span className="text-slate-300">
                      Available for weekdays and weekends
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
                    <span className="text-slate-300">
                      Quick response to rental inquiries
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
                    <span className="text-slate-300">
                      Serving South Carolina and surrounding areas
                    </span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={handleBookingClick}
                  className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-cyan-400 px-8 py-4 text-base font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-cyan-950/35 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950 md:text-lg"
                >
                  Book This Rental
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </button>

                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur sm:p-6">
                  <p className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
                    Contact Information
                  </p>
                  <div className="space-y-3">
                    <a
                      href={`tel:${contact.phone.replace(/\D/g, "")}`}
                      className="flex items-center gap-2 font-semibold text-white transition hover:text-cyan-300"
                    >
                      <Phone className="h-5 w-5" />
                      <span>{contact.phone}</span>
                    </a>
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 font-semibold text-white transition hover:text-cyan-300"
                    >
                      <Mail className="h-5 w-5" />
                      <span>{contact.email}</span>
                    </a>
                  </div>
                </div>

                <p className="text-center text-xs text-slate-500">
                  Availability subject to booking confirmation
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
