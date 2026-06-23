import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const RENTAL_ORIGIN_ADDRESS = "559 Beaudrot Rd, Greenwood, SC";

type GeocodeResult = {
  formatted_address?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: GeocodeResult[];
};

type DistanceMatrixResponse = {
  status?: string;
  error_message?: string;
  rows?: {
    elements?: {
      status?: string;
      distance?: {
        text?: string;
        value?: number;
      };
      duration?: {
        text?: string;
      };
    }[];
  }[];
};

function milesFromMeters(meters: number): number {
  return Math.round((meters / 1609.344) * 10) / 10;
}

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "address-distance",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps is not configured yet." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    address?: unknown;
  } | null;
  const address = typeof body?.address === "string" ? body.address.trim() : "";

  if (address.length < 8) {
    return NextResponse.json(
      { error: "Enter a complete delivery address." },
      { status: 400 },
    );
  }

  const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  geocodeUrl.searchParams.set("address", address);
  geocodeUrl.searchParams.set("components", "country:US");
  geocodeUrl.searchParams.set("key", apiKey);

  const geocodeRes = await fetch(geocodeUrl, { cache: "no-store" });
  const geocode = (await geocodeRes.json()) as GeocodeResponse;
  const firstResult = geocode.results?.[0];
  const location = firstResult?.geometry?.location;

  if (
    geocode.status !== "OK" ||
    !firstResult?.formatted_address ||
    typeof location?.lat !== "number" ||
    typeof location.lng !== "number"
  ) {
    return NextResponse.json(
      {
        error:
          geocode.error_message ||
          "We could not verify that address. Check the street, city, and ZIP.",
      },
      { status: 400 },
    );
  }

  const distanceUrl = new URL(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
  );
  distanceUrl.searchParams.set("origins", RENTAL_ORIGIN_ADDRESS);
  distanceUrl.searchParams.set("destinations", firstResult.formatted_address);
  distanceUrl.searchParams.set("units", "imperial");
  distanceUrl.searchParams.set("mode", "driving");
  distanceUrl.searchParams.set("key", apiKey);

  const distanceRes = await fetch(distanceUrl, { cache: "no-store" });
  const distanceMatrix = (await distanceRes.json()) as DistanceMatrixResponse;
  const element = distanceMatrix.rows?.[0]?.elements?.[0];

  if (
    distanceMatrix.status !== "OK" ||
    element?.status !== "OK" ||
    typeof element.distance?.value !== "number"
  ) {
    return NextResponse.json(
      {
        error:
          distanceMatrix.error_message ||
          "We could not calculate delivery distance for that address.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    formattedAddress: firstResult.formatted_address,
    latitude: location.lat,
    longitude: location.lng,
    distanceMiles: milesFromMeters(element.distance.value),
    distanceText: element.distance.text ?? null,
    durationText: element.duration?.text ?? null,
    originAddress: RENTAL_ORIGIN_ADDRESS,
  });
}
