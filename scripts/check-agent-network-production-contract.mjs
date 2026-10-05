// Read-only release check: use no owner cookie, credentials, or customer data.
const base = new URL(process.argv[2] || "https://jumpingjaxllc.com");
if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
  throw new Error("HTTPS required.");
}
if (base.username || base.password || base.search || base.hash) {
  throw new Error("Use a site origin without credentials or query parameters.");
}
const probes = [
  ["GET", "/api/admin/agents/network"],
  ["POST", "/api/admin/agents/network"],
  ["POST", "/api/admin/agents/network/cancel"],
  ["GET", "/api/admin/agents/network/a2a/booking"],
  ["POST", "/api/admin/agents/network/a2a/booking"],
  ["GET", "/api/cron/agent-worker"],
];
const results = await Promise.all(probes.map(async ([method, path]) => {
  try {
    const response = await fetch(new URL(path, base), {
      method,
      redirect: "manual",
      cache: "no-store",
      ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    const json = response.headers.get("content-type")?.includes("application/json") ?? false;
    const data = json ? await response.json().catch(() => null) : null;
    return { method, path, status: response.status, privateJson: response.status === 401 && json && data?.ok === false };
  } catch {
    return { method, path, status: null, privateJson: false };
  }
}));
const ok = results.every((result) => result.privateJson);
console.log(JSON.stringify({ ok, results }, null, 2));
if (!ok) process.exitCode = 1;
