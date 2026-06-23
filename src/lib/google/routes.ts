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
};

export type RouteLegEstimate = {
  durationMinutes: number;
  distanceMiles: number;
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
    | { error?: { message?: string } }
    | null;

  if (!res.ok || !Array.isArray(data)) {
    const message =
      data && !Array.isArray(data) ? data.error?.message : null;
    throw new Error(message || "Google Routes API could not calculate the route matrix.");
  }

  const matrix = new Map<string, RouteLegEstimate>();
  for (const element of data) {
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
