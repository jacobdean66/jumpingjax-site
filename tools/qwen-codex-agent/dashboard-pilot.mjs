import { randomBytes } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const modelNames = ["qwen3:4b", "qwen3:8b"];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const workerPath = "/api/agents/qwen-pilot/worker";

export function pilotOptions(env) {
  const origin = new URL(env.QWEN_PILOT_ORIGIN ?? "https://jumpingjaxllc.com");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if ((origin.protocol !== "https:" && !(origin.protocol === "http:" && loopback))
    || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Set QWEN_PILOT_ORIGIN to the dashboard origin (HTTPS or local development).");
  }
  const secret = env.QWEN_PILOT_WORKER_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("Set the Qwen pilot worker secret through a protected environment.");
  const model = env.QWEN_PILOT_MODEL ?? "qwen3:8b";
  if (!modelNames.includes(model)) throw new Error("Use qwen3:4b or qwen3:8b for the pilot.");
  return { endpoint: new URL(workerPath, origin), secret, model };
}

class WorkerRequestError extends Error {
  constructor(status) {
    super(status === 401 || status === 403 ? "The dashboard rejected the Qwen worker credential." : "The dashboard worker request failed.");
    this.status = status;
  }
}

// Task Scheduler may terminate the PowerShell launcher without terminating its
// Node child. Stop polling if the launcher exits, so a replacement cannot leave
// an older orphan worker taking jobs.
export function watchParent(shutdown, parentPid, probe = process.kill, intervalMs = 5_000) {
  const timer = setInterval(() => {
    try { probe(parentPid, 0); }
    catch (error) { if (error?.code === "ESRCH") shutdown.abort(); }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

export async function runPilot({ endpoint, secret, model, signal, once = false, fetchImpl = fetch, log = console.log, renewIntervalMs = 10_000 }) {
  async function send(command, requestSignal) {
    const timeout = AbortSignal.timeout(20_000);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify(command),
      redirect: "error",
      signal: requestSignal ? AbortSignal.any([timeout, requestSignal]) : timeout,
    });
    if (!response.ok) throw new WorkerRequestError(response.status);
    return response.json();
  }

  async function check(job) {
    const inference = new AbortController();
    const finished = new AbortController();
    const heartbeat = AbortSignal.any([finished.signal, signal]);
    const lease = { jobId: job.id, lease: job.lease };
    const renew = async () => {
      try {
        while (!heartbeat.aborted) {
          await sleep(renewIntervalMs, undefined, { signal: heartbeat });
          let response;
          try {
            response = await send({ action: "renew", ...lease }, heartbeat);
          } catch (error) {
            const terminal = error instanceof WorkerRequestError
              && error.status >= 400 && error.status < 500 && error.status !== 429;
            if (heartbeat.aborted || terminal) throw error;
            log("Lease renewal interrupted; retrying once.");
            await sleep(2_000, undefined, { signal: heartbeat });
            response = await send({ action: "renew", ...lease }, heartbeat);
          }
          if (response.ok !== true) throw new Error("The dashboard did not renew the lease.");
        }
      } catch (error) {
        if (!finished.signal.aborted) {
          if (signal.aborted) log("The worker is stopping.");
          else if (error instanceof WorkerRequestError) log(`Lease renewal failed with HTTP ${error.status}.`);
          else log("Lease renewal failed or timed out.");
          inference.abort();
        }
      }
    };
    const renewing = renew();
    const expected = `JAX-${randomBytes(3).toString("hex")}`;
    let failure = null;
    let stage = "connecting to Ollama";
    try {
      const response = await fetchImpl("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        redirect: "error",
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: `Copy this exact code into the code field: ${expected}` }],
          format: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
          think: false,
          stream: false,
          keep_alive: 0,
          options: { num_predict: 48, num_thread: 1, temperature: 0 },
        }),
        signal: AbortSignal.any([signal, inference.signal, AbortSignal.timeout(300_000)]),
      });
      if (!response.ok) {
        log(`Ollama returned HTTP ${response.status}.`);
        throw new Error("Ollama rejected the check.");
      }
      stage = "reading the Ollama response";
      const result = await response.json();
      stage = "parsing the model response";
      const reply = JSON.parse(result.message.content);
      if (reply.code !== expected) failure = "unexpected_reply";
    } catch {
      failure = "model_unavailable";
      if (!inference.signal.aborted && !signal.aborted) log(`The model check failed while ${stage}.`);
    } finally {
      finished.abort();
      await renewing;
    }
    try {
      const result = await send({ action: "finish", ...lease, model, failure });
      if (result.ok !== true) throw new Error("The dashboard did not confirm completion.");
      log(failure ? "The local model check failed." : "The local model check finished.");
    } catch (error) {
      if (!(error instanceof WorkerRequestError) || error.status !== 409) throw error;
      log("The dashboard ended the lease.");
    }
  }

  while (!signal.aborted) {
    try {
      const { job } = await send({ action: "claim" }, signal);
      if (job !== null) {
        if (typeof job?.id !== "string" || !uuid.test(job.id) || typeof job.lease !== "string" || !uuid.test(job.lease)) {
          throw new Error("The dashboard returned an invalid job.");
        }
        await check(job);
      }
    } catch (error) {
      if (signal.aborted) return;
      if (once || (error instanceof WorkerRequestError && error.status >= 400 && error.status < 500 && error.status !== 429)) throw error;
      if (error instanceof WorkerRequestError) {
        log(`The dashboard returned HTTP ${error.status}. Retrying after a short delay.`);
      } else {
        const safeCodes = ["ETIMEDOUT", "ENOTFOUND", "ECONNRESET", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"];
        const code = error?.cause?.code;
        const detail = safeCodes.includes(code) ? code : error?.name === "TimeoutError" ? "timeout" : "transport error";
        log(`The dashboard connection failed (${detail}). Retrying after a short delay.`);
      }
    }
    if (once) return;
    await sleep(15_000, undefined, { signal }).catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const shutdown = new AbortController();
  const stopParentWatch = watchParent(shutdown, process.ppid);
  process.once("SIGINT", () => shutdown.abort());
  process.once("SIGTERM", () => shutdown.abort());
  try {
    const options = pilotOptions(process.env);
    console.log("Qwen connection-check worker started.");
    await runPilot({ ...options, signal: shutdown.signal, once: process.argv.includes("--once") });
  } catch (error) {
    // Fetch errors may contain addresses or request data. Keep CLI diagnostics bounded.
    console.error(error instanceof WorkerRequestError || error instanceof Error && error.message.startsWith("Set ")
      ? error.message : "The Qwen connection-check worker stopped. Check the dashboard and local Ollama status.");
    process.exitCode = 1;
  } finally {
    stopParentWatch();
  }
}
