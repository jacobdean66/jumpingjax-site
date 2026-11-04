// Binding must be performed inside the guarded receptionist booking transaction.
export async function POST() {
  return Response.json({ error: "Preview booking integration unavailable" }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}
