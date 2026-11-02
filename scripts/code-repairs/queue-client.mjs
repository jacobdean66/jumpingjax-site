const endpoint = "https://jumpingjaxllc.com/api/agents/code-repair-worker";
const retryableActions = new Set(["claim", "recover", "check"]);
const networkCodes = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);

export class WorkerQueueError extends Error {}

function httpFailure(status) {
  const reason = status === 401 ? "The dedicated worker token was rejected. Check the GitHub and production worker configuration."
    : status === 403 ? "The website denied the worker connection. Check deployment access and firewall rules."
    : status === 409 ? "The queue could not complete the request. Check database availability, pause controls and the task lease."
    : status === 429 ? "The website is rate limiting the worker."
    : status >= 500 ? "The website's worker endpoint is temporarily unavailable."
    : "The worker endpoint rejected the request.";
  return new WorkerQueueError(`Coding worker connection failed (HTTP ${status}). ${reason}`);
}

// Never include a response body, URL, token, task, or raw exception in public Actions logs.
export async function workerQueueRequest(body, {
  token = process.env.CODE_REPAIR_RUNNER_TOKEN,
  fetchImpl = fetch,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (!token?.trim()) throw new WorkerQueueError("Coding worker token is not configured.");
  const attempts = retryableActions.has(body.action) ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000), redirect: "error",
      });
    } catch (error) {
      const code = networkCodes.has(error?.cause?.code) ? ` (${error.cause.code})` : "";
      if (attempt + 1 < attempts) { await wait(500 * (attempt + 1)); continue; }
      throw new WorkerQueueError(`Coding worker could not connect to the website${code}. Check network availability and the canonical worker endpoint.`);
    }
    if (!response.ok) {
      await response.body?.cancel();
      if ((response.status === 429 || response.status >= 500) && attempt + 1 < attempts) { await wait(500 * (attempt + 1)); continue; }
      throw httpFailure(response.status);
    }
    let result;
    try { result = await response.json(); } catch { throw new WorkerQueueError("Coding worker received an invalid response from the website. Check the worker endpoint and deployment routing."); }
    if (result?.ok !== true) throw new WorkerQueueError("Coding worker received a rejected queue response. Check the worker endpoint and queue configuration.");
    return result;
  }
}
