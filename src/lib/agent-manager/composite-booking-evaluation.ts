import { FOAM_DURATION_OPTIONS, ONE_DAY_RENTAL_DURATION } from "@/lib/mockBooking";
import {
  estimateCartRentalSubtotal,
  estimateRentalDeliveryFee,
  FOAM_PARTY_RENTAL_ITEM,
} from "@/lib/rentals/rental-pricing-text";
import { priceFacilityParty } from "@/lib/facility-parties/pricing";
import type { FacilityPartyKind, FacilityRoomId } from "@/lib/facility-parties/types";

import {
  buildCompositeBookingDryRun,
  type CalendarBlock,
  type CalendarProjection,
  type CompositeBookingPlan,
  type CompositeBookingRequest,
  type CompositeServiceKind,
  type CompositeServiceRequest,
} from "./composite-booking";

export type CompositeQuoteLine = {
  service: CompositeServiceKind;
  code: string;
  amountCents: number;
};

export type CompositeQuote = {
  currency: "USD";
  estimate: true;
  lines: CompositeQuoteLine[];
  totalCents: number;
  issues: string[];
};

export type CompositeApprovalIntent = {
  transactionKey: string;
  services: CompositeServiceKind[];
  projections: CalendarProjection[];
  quote: CompositeQuote;
  requiresOwnerApproval: true;
  writesAllowed: false;
};

export type CompositeBookingEvaluation = {
  status: CompositeBookingPlan["status"] | "needs_pricing";
  plan: CompositeBookingPlan;
  quote: CompositeQuote;
  approvalIntent: CompositeApprovalIntent | null;
};

type FacilityPackage = { partyKind: FacilityPartyKind; roomId: FacilityRoomId };

const facilityPackages: Record<string, FacilityPackage> = {
  "public-room-10": { partyKind: "public", roomId: "room-10" },
  "public-room-20": { partyKind: "public", roomId: "room-20" },
  "whole-facility": { partyKind: "private", roomId: "room-20" },
  "whole-facility-2h": { partyKind: "private", roomId: "room-20" },
};

function cents(value: number) {
  return Math.round(value * 100);
}

function foamDurationLabel(durationMinutes: number | undefined) {
  return FOAM_DURATION_OPTIONS.find((option) => {
    if (option.id === "foam-30") return durationMinutes === 30;
    if (option.id === "foam-60") return durationMinutes === 60;
    if (option.id === "foam-120") return durationMinutes === 120;
    return false;
  })?.label;
}

function priceRental(service: CompositeServiceRequest, issues: string[]): CompositeQuoteLine[] {
  const itemRefs = service.itemRefs ?? [];
  if (itemRefs.includes(FOAM_PARTY_RENTAL_ITEM)) {
    issues.push("rental.itemRefs must not duplicate the separately selected foam party");
    return [];
  }
  const subtotal = estimateCartRentalSubtotal(
    itemRefs.map((rental_item) => ({ rental_item })),
    ONE_DAY_RENTAL_DURATION.label,
    ONE_DAY_RENTAL_DURATION.spanDays,
  );
  if (subtotal == null) {
    issues.push("One or more rental items do not have a configured catalog price");
    return [];
  }
  return [{ service: "rental", code: "catalog_items", amountCents: cents(subtotal) }];
}

function priceFoam(service: CompositeServiceRequest, issues: string[]): CompositeQuoteLine[] {
  const durationLabel = foamDurationLabel(service.durationMinutes);
  if (!durationLabel) {
    issues.push("Foam duration must be 30, 60, or 120 minutes");
    return [];
  }
  const subtotal = estimateCartRentalSubtotal(
    [{ rental_item: FOAM_PARTY_RENTAL_ITEM }],
    durationLabel,
    1,
    durationLabel,
  );
  if (subtotal == null) {
    issues.push("Foam party catalog price is unavailable");
    return [];
  }
  return [{ service: "foam_party", code: `foam_${service.durationMinutes}`, amountCents: cents(subtotal) }];
}

function priceFacility(service: CompositeServiceRequest, issues: string[]): CompositeQuoteLine[] {
  const packageConfig = service.packageRef ? facilityPackages[service.packageRef] : undefined;
  if (!packageConfig || !service.date || !service.durationMinutes) {
    issues.push("Facility package is not recognized");
    return [];
  }
  const pricing = priceFacilityParty({
    ...packageConfig,
    date: service.date,
    durationMinutes: service.durationMinutes,
    addonSubtotal: 0,
  });
  if (pricing.missingPrice) {
    issues.push(pricing.missingPrice);
    return [];
  }
  return [{ service: "facility_party", code: service.packageRef!, amountCents: cents(pricing.total) }];
}

export function quoteCompositeBooking(request: CompositeBookingRequest): CompositeQuote {
  const issues: string[] = [];
  const lines = request.services.flatMap((service) => {
    if (service.kind === "rental") return priceRental(service, issues);
    if (service.kind === "foam_party") return priceFoam(service, issues);
    return priceFacility(service, issues);
  });

  const deliveryGroups = new Map<string, { distanceMiles: number; service: CompositeServiceKind }>();
  for (const service of request.services) {
    if (service.kind === "facility_party" || !service.locationRef || service.distanceMiles == null) continue;
    const current = deliveryGroups.get(service.locationRef);
    if (current && current.distanceMiles !== service.distanceMiles) {
      issues.push("Services at the same location must use the same delivery distance");
      continue;
    }
    deliveryGroups.set(service.locationRef, { distanceMiles: service.distanceMiles, service: service.kind });
  }
  for (const [locationRef, delivery] of deliveryGroups) {
    lines.push({
      service: delivery.service,
      code: `delivery_${locationRef.length}`,
      amountCents: cents(estimateRentalDeliveryFee(delivery.distanceMiles)),
    });
  }

  return {
    currency: "USD",
    estimate: true,
    lines,
    totalCents: lines.reduce((total, line) => total + line.amountCents, 0),
    issues: [...new Set(issues)],
  };
}

export function evaluateCompositeBooking(
  request: CompositeBookingRequest,
  existingBlocks: CalendarBlock[] = [],
): CompositeBookingEvaluation {
  const plan = buildCompositeBookingDryRun(request, existingBlocks);
  const quote = quoteCompositeBooking(request);
  if (plan.status !== "ready_for_approval") {
    return { status: plan.status, plan, quote, approvalIntent: null };
  }
  if (quote.issues.length) {
    return { status: "needs_pricing", plan, quote, approvalIntent: null };
  }
  return {
    status: "ready_for_approval",
    plan,
    quote,
    approvalIntent: {
      transactionKey: plan.transactionKey,
      services: request.services.map(({ kind }) => kind),
      projections: plan.projections,
      quote,
      requiresOwnerApproval: true,
      writesAllowed: false,
    },
  };
}
