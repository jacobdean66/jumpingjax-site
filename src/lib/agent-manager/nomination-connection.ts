export async function checkNominationCallback(input: {
  appUrl?: string;
  callbackSecret?: string;
}, fetchImpl: typeof fetch = fetch) {
  const appUrl = input.appUrl?.trim();
  const secret = input.callbackSecret?.trim();
  if (appUrl !== "https://jumpingjaxllc.com" || !secret) {
    return { ok: false, mode: "connection_check" as const, businessWrites: 0, reason: "Callback configuration is incomplete." };
  }
  try {
    // An authenticated empty payload must fail validation before any job or
    // nomination writes. A 401 means the two managed credentials differ.
    const response = await fetchImpl(`${appUrl}/api/agents/nomination/callback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json() as { error?: string };
    const ok = response.status === 400 && body.error === "Invalid Nomination Agent callback.";
    return { ok, mode: "connection_check" as const, businessWrites: 0, reason: ok ? "Worker callback authentication verified without creating a nomination." : "Worker callback authentication could not be verified." };
  } catch {
    return { ok: false, mode: "connection_check" as const, businessWrites: 0, reason: "Worker callback could not be reached." };
  }
}
