type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

async function main(): Promise<void> {
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const deliveryToken = process.env.ADMIN_DELIVERIES_TOKEN?.trim() ?? "";
  const ownerUser = process.env.TEST_OWNER_USERNAME ?? "owner";
  const ownerPass = process.env.TEST_OWNER_PASSWORD ?? "";
  const results: CheckResult[] = [];

  const unauth = await fetch(`${base}/admin/social-posts`);
  const unauthHtml = await unauth.text();
  results.push({
    name: "unauthenticated_rejects_dashboard",
    ok: unauth.ok && !unauthHtml.includes("Social Post Drafts"),
    detail: unauth.status.toString(),
  });

  if (deliveryToken) {
    const tokenRes = await fetch(
      `${base}/admin/social-posts?token=${encodeURIComponent(deliveryToken)}`,
    );
    const tokenHtml = await tokenRes.text();
    results.push({
      name: "delivery_token_access",
      ok: tokenRes.ok && tokenHtml.includes("Social Post Drafts"),
      detail: tokenRes.status.toString(),
    });
  }

  if (ownerPass) {
    const loginRes = await fetch(`${base}/api/admin/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: ownerUser, password: ownerPass }),
    });
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    results.push({
      name: "staff_login",
      ok: loginRes.ok && cookie.includes("jumpingjax-admin-session"),
      detail: loginRes.status.toString(),
    });

    if (cookie) {
      const sessionRes = await fetch(`${base}/admin/social-posts`, {
        headers: { Cookie: cookie.split(";")[0] },
      });
      const sessionHtml = await sessionRes.text();
      results.push({
        name: "cookie_session_access",
        ok: sessionRes.ok && sessionHtml.includes("Social Post Drafts"),
        detail: sessionRes.status.toString(),
      });
    }
  }

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
  }

  if (results.some((result) => !result.ok)) {
    process.exit(1);
  }
}

main();
