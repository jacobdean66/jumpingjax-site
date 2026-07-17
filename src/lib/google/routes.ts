type RouteMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  duration?: string;
  distanceMeters?: number;
  status?: {
    code?: number;
    message?: string;
  };
  condition?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

export type RouteLegEstimate = {
  durationMinutes: number;
  distanceMiles: number;
};

export type GoogleRoutesApiError = {
  code: number | null;
  status: string | null;
  message: string | null;
};

const ROUTES_MATRIX_ENDPOINT =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

function durationSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) return null;
  return Number(match[1]);
}

function milesFromMeters(value: number): number {
  return Math.round((value / 1609.344) * 10) / 10;
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function routeLegKey(origin: string, destination: string): string {
  return `${normalizeAddress(origin)} -> ${normalizeAddress(destination)}`;
}

function readErrorObject(value: unknown): GoogleRoutesApiError | null {
  if (!value || typeof value !== "object") return null;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const record = error as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
  };
  const code = typeof record.code === "number" ? record.code : null;
  const status = typeof record.status === "string" ? record.status : null;
  const message = typeof record.message === "string" ? record.message : null;
  if (code == null && !status && !message) return null;
  return { code, status, message };
}

/** Supports both `{ error }` and `[{ error }]` Google Routes failure bodies. */
export function extractGoogleRoutesError(data: unknown): GoogleRoutesApiError | null {
  if (Array.isArray(data)) {
    for (const entry of data) {
      const found = readErrorObject(entry);
      if (found) return found;
    }
    return null;
  }
  return readErrorObject(data);
}

export function adminMessageForGoogleRoutesError(
  error: GoogleRoutesApiError | null,
): string {
  if (!error || (!error.message && !error.status && error.code == null)) {
    return "Google Routes API could not calculate the route matrix.";
  }

  const parts: string[] = [];
  if (error.status) parts.push(error.status);
  if (error.code != null) parts.push(`code ${error.code}`);
  if (error.message) parts.push(error.message);
  return `Google Routes API error: ${parts.join(" — ")}`;
}

function logGoogleRoutesFailure(args: {
  httpStatus: number;
  error: GoogleRoutesApiError | null;
  bodyKind: string;
}) {
  console.error("[google/routes] computeRouteMatrix failed", {
    httpStatus: args.httpStatus,
    bodyKind: args.bodyKind,
    googleCode: args.error?.code ?? null,
    googleStatus: args.error?.status ?? null,
    googleMessage: args.error?.message ?? null,
  });
}

export async function loadRouteMatrix(
  stops: string[],
): Promise<Map<string, RouteLegEstimate>> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const uniqueStops = [...new Set(stops.map((stop) => stop.trim()).filter(Boolean))];

  if (!apiKey || uniqueStops.length < 2) {
    return new Map();
  }

  const elementCount = uniqueStops.length * uniqueStops.length;
  if (elementCount > 625) {
    throw new Error("Too many stops for Google route matrix. Split this route into smaller days.");
  }

  const waypoint = (address: string) => ({ waypoint: { address } });
  const res = await fetch(ROUTES_MATRIX_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "originIndex,destinationIndex,duration,distanceMeters,status,condition",
    },
    body: JSON.stringify({
      origins: uniqueStops.map(waypoint),
      destinations: uniqueStops.map(waypoint),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      units: "IMPERIAL",
    }),
  });

  const data = (await res.json().catch(() => null)) as
    | RouteMatrixElement[]
    | { error?: { code?: number; message?: string; status?: string } }
    | null;

  const googleError = extractGoogleRoutesError(data);
  const bodyKind = Array.isArray(data)
    ? "array"
    : data && typeof data === "object"
      ? "object"
      : data == null
        ? "unparseable"
        : typeof data;

  if (!res.ok || googleError || !Array.isArray(data)) {
    logGoogleRoutesFailure({
      httpStatus: res.status,
      error: googleError,
      bodyKind,
    });
    throw new Error(adminMessageForGoogleRoutesError(googleError));
  }

  const matrix = new Map<string, RouteLegEstimate>();
  for (const element of data) {
    if (element.error) continue;
    if (
      typeof element.originIndex !== "number" ||
      typeof element.destinationIndex !== "number" ||
      element.originIndex === element.destinationIndex ||
      element.status?.code
    ) {
      continue;
    }

    const seconds = durationSeconds(element.duration);
    if (seconds == null || typeof element.distanceMeters !== "number") {
      continue;
    }

    const origin = uniqueStops[element.originIndex];
    const destination = uniqueStops[element.destinationIndex];
    if (!origin || !destination) continue;

    matrix.set(routeLegKey(origin, destination), {
      durationMinutes: Math.max(1, Math.ceil(seconds / 60)),
      distanceMiles: milesFromMeters(element.distanceMeters),
    });
  }

  return matrix;
}
