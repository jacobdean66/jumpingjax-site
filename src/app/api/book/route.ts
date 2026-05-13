import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, message: "Expected JSON body" },
      { status: 400 },
    );
  }

  console.log("[api/book] incoming booking:", JSON.stringify(body, null, 2));

  const id = `BK-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return NextResponse.json({
    ok: true as const,
    id,
    message: "Booking received",
  });
}
