import type {
  CompositeBookingRequest,
  CompositeServiceKind,
  CompositeServiceRequest,
} from "./composite-booking";

const SERVICE_KINDS = new Set<CompositeServiceKind>(["rental", "facility_party", "foam_party"]);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function optionalString(value: unknown, max: number) {
  return value === undefined || (typeof value === "string" && value.length > 0 && value.length <= max);
}

function parseService(value: unknown): CompositeServiceRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.kind !== "string" || !SERVICE_KINDS.has(record.kind as CompositeServiceKind)) return null;
  if (record.date !== undefined && (typeof record.date !== "string" || !YMD.test(record.date))) return null;
  if (record.startMinutes !== undefined && (!Number.isInteger(record.startMinutes) || Number(record.startMinutes) < 0 || Number(record.startMinutes) > 1439)) return null;
  if (record.durationMinutes !== undefined && (!Number.isInteger(record.durationMinutes) || Number(record.durationMinutes) < 1 || Number(record.durationMinutes) > 1440)) return null;
  if (!optionalString(record.packageRef, 80) || !optionalString(record.locationRef, 120)) return null;
  if (record.distanceMiles !== undefined && (typeof record.distanceMiles !== "number" || record.distanceMiles < 0 || record.distanceMiles > 500)) return null;
  if (record.itemRefs !== undefined && (
    !Array.isArray(record.itemRefs)
    || record.itemRefs.length < 1
    || record.itemRefs.length > 10
    || record.itemRefs.some((item) => typeof item !== "string" || item.length < 1 || item.length > 80)
  )) return null;
  return {
    kind: record.kind as CompositeServiceKind,
    date: record.date as string | undefined,
    startMinutes: record.startMinutes as number | undefined,
    durationMinutes: record.durationMinutes as number | undefined,
    itemRefs: record.itemRefs as string[] | undefined,
    packageRef: record.packageRef as string | undefined,
    locationRef: record.locationRef as string | undefined,
    distanceMiles: record.distanceMiles as number | undefined,
  };
}

export function parseCompositeBookingRequest(value: unknown): CompositeBookingRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.conversationRef !== "string" || record.conversationRef.length < 8 || record.conversationRef.length > 120) return null;
  if (!Number.isInteger(record.revision) || Number(record.revision) < 1 || Number(record.revision) > 1000) return null;
  if (record.cancelled !== undefined && typeof record.cancelled !== "boolean") return null;
  if (!Array.isArray(record.services) || record.services.length < 1 || record.services.length > 3) return null;
  const services = record.services.map(parseService);
  if (services.some((service) => service === null)) return null;
  const typedServices = services as CompositeServiceRequest[];
  if (new Set(typedServices.map(({ kind }) => kind)).size !== typedServices.length) return null;
  return {
    conversationRef: record.conversationRef,
    revision: Number(record.revision),
    cancelled: record.cancelled as boolean | undefined,
    services: typedServices,
  };
}

