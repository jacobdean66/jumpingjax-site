import { createHash } from "node:crypto";

export type CompositeServiceKind = "rental" | "facility_party" | "foam_party";

export type CompositeServiceRequest = {
  kind: CompositeServiceKind;
  date?: string;
  startMinutes?: number;
  durationMinutes?: number;
  itemRefs?: string[];
  packageRef?: string;
  locationRef?: string;
  distanceMiles?: number;
};

export type CompositeBookingRequest = {
  conversationRef: string;
  revision: number;
  cancelled?: boolean;
  services: CompositeServiceRequest[];
};

export type CalendarBlock = {
  resourceRef: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
};

export type CalendarProjection = CalendarBlock & {
  calendar: "rentals" | "facility" | "foam-operations";
  service: CompositeServiceKind;
  transactionKey: string;
  summary: string;
};

export type CompositeBookingPlan = {
  status: "cancelled" | "needs_information" | "conflict" | "ready_for_approval";
  transactionKey: string;
  missing: string[];
  conflicts: string[];
  projections: CalendarProjection[];
  writesAllowed: false;
};

const serviceOrder: CompositeServiceKind[] = ["rental", "facility_party", "foam_party"];

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function normalizedServices(services: CompositeServiceRequest[]) {
  return [...services].sort((left, right) => serviceOrder.indexOf(left.kind) - serviceOrder.indexOf(right.kind));
}

function transactionKey(request: CompositeBookingRequest) {
  const normalized = normalizedServices(request.services).map((service) => ({
    ...service,
    itemRefs: service.itemRefs ? [...service.itemRefs].sort() : undefined,
  }));
  return `composite-booking:${shortHash(JSON.stringify({
    conversationRef: request.conversationRef,
    revision: request.revision,
    services: normalized,
  }))}`;
}

function requiredFields(service: CompositeServiceRequest, index: number) {
  const prefix = `services.${index}.${service.kind}`;
  const missing: string[] = [];
  if (!service.date) missing.push(`${prefix}.date`);
  if (!Number.isInteger(service.startMinutes)) missing.push(`${prefix}.startMinutes`);
  if (!Number.isInteger(service.durationMinutes) || (service.durationMinutes ?? 0) <= 0) {
    missing.push(`${prefix}.durationMinutes`);
  }
  if (service.kind === "rental") {
    if (!service.itemRefs?.length) missing.push(`${prefix}.itemRefs`);
    if (!service.locationRef) missing.push(`${prefix}.locationRef`);
    if (typeof service.distanceMiles !== "number" || service.distanceMiles < 0) {
      missing.push(`${prefix}.distanceMiles`);
    }
  }
  if (service.kind === "facility_party" && !service.packageRef) missing.push(`${prefix}.packageRef`);
  if (service.kind === "foam_party") {
    if (!service.locationRef) missing.push(`${prefix}.locationRef`);
    if (typeof service.distanceMiles !== "number" || service.distanceMiles < 0) {
      missing.push(`${prefix}.distanceMiles`);
    }
  }
  return missing;
}

function projectionResources(service: CompositeServiceRequest) {
  if (service.kind === "facility_party") return ["facility:main"];
  if (service.kind === "foam_party") return ["crew:foam"];
  return (service.itemRefs ?? []).map((itemRef) => `rental:${itemRef}`);
}

function calendarFor(service: CompositeServiceKind): CalendarProjection["calendar"] {
  if (service === "facility_party") return "facility";
  if (service === "foam_party") return "foam-operations";
  return "rentals";
}

function overlaps(left: CalendarBlock, right: CalendarBlock) {
  return left.resourceRef === right.resourceRef
    && left.date === right.date
    && left.startMinutes < right.endMinutes
    && right.startMinutes < left.endMinutes;
}

export function buildCompositeBookingDryRun(
  request: CompositeBookingRequest,
  existingBlocks: CalendarBlock[] = [],
): CompositeBookingPlan {
  const key = transactionKey(request);
  const base = { transactionKey: key, writesAllowed: false as const };

  if (request.cancelled) {
    return { ...base, status: "cancelled", missing: [], conflicts: [], projections: [] };
  }

  const services = normalizedServices(request.services);
  const missing = services.length
    ? services.flatMap((service, index) => requiredFields(service, index))
    : ["services"];
  if (missing.length) {
    return { ...base, status: "needs_information", missing, conflicts: [], projections: [] };
  }

  const projections = services.flatMap((service) => {
    const startMinutes = service.startMinutes as number;
    const endMinutes = startMinutes + (service.durationMinutes as number);
    return projectionResources(service).map((resourceRef) => ({
      resourceRef,
      date: service.date as string,
      startMinutes,
      endMinutes,
      calendar: calendarFor(service.kind),
      service: service.kind,
      transactionKey: key,
      summary: `${service.kind.replace("_", " ")} request ${shortHash(request.conversationRef)}`,
    }));
  });
  const conflicts = projections
    .filter((projection) => existingBlocks.some((block) => overlaps(projection, block)))
    .map((projection) => projection.resourceRef);

  if (conflicts.length) {
    return {
      ...base,
      status: "conflict",
      missing: [],
      conflicts: [...new Set(conflicts)].sort(),
      projections: [],
    };
  }

  return { ...base, status: "ready_for_approval", missing: [], conflicts: [], projections };
}
