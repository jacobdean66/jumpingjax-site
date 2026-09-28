import { resolve4 } from "node:dns/promises";
import { get } from "node:https";

export function publicHttps(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/\.$/, "");
    return value.length <= 4096 && url.protocol === "https:" && !url.username && !url.password &&
      (!url.port || url.port === "443") && host.includes(".") && !/^[\d.]+$/.test(host) && !host.includes(":") &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host);
  } catch { return false; }
}

export function publicIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

async function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

type FetchDependencies = { resolveHost?: (host: string) => Promise<string[]>; httpsGet?: typeof get };

/** No redirects, private DNS results, credentials, compression or unbounded reads. */
export async function fetchPublicResource(source: string, kind: "html" | "image", outerSignal: AbortSignal,
  dependencies: FetchDependencies = {}): Promise<Buffer> {
  if (!publicHttps(source)) throw new Error("Public HTTPS source required.");
  const signal = AbortSignal.any([outerSignal, AbortSignal.timeout(kind === "html" ? 6000 : 8000)]);
  const url = new URL(source);
  const addresses = await abortable((dependencies.resolveHost ?? resolve4)(url.hostname), signal);
  if (!addresses.length || addresses.some(address => !publicIPv4(address))) throw new Error("Public address required.");
  signal.throwIfAborted();
  const limit = kind === "html" ? 512 * 1024 : 4 * 1024 * 1024;
  const allowed = kind === "html" ? ["text/html", "application/xhtml+xml"] : ["image/png", "image/jpeg", "image/webp", "image/gif"];
  return new Promise((resolve, reject) => {
    const request = (dependencies.httpsGet ?? get)(url, {
      family: 4, signal,
      lookup: (_host, _options, callback) => callback(null, addresses[0], 4),
      headers: { Accept: allowed.join(","), "Accept-Encoding": "identity", "User-Agent": "JumpingJax-Invitation-Designer/1.0" },
    }, response => {
      const mime = response.headers["content-type"]?.split(";")[0].toLowerCase();
      const encoding = response.headers["content-encoding"];
      if (response.statusCode !== 200 || !mime || !allowed.includes(mime) ||
        (encoding && encoding !== "identity") || (kind === "image" && Number(response.headers["content-length"] || 0) > limit)) {
        response.destroy(); reject(new Error("Source response unavailable.", { cause: response.statusCode })); return;
      }
      let size = 0;
      let settled = false;
      const chunks: Buffer[] = [];
      const finish = (bytes: Buffer) => {
        if (settled) return;
        settled = true; resolve(bytes); response.destroy();
      };
      response.on("data", (chunk: Buffer) => {
        if (settled) return;
        if (kind === "html") {
          const prefix = chunk.subarray(0, limit - size);
          size += prefix.length; chunks.push(prefix);
          const bytes = Buffer.concat(chunks);
          // Latin-1 keeps ASCII tag offsets aligned with the original bytes.
          const closingHead = /<\/head\s*>/i.exec(bytes.toString("latin1"));
          if (closingHead) { finish(bytes.subarray(0, closingHead.index + closingHead[0].length)); return; }
          if (size === limit) finish(bytes);
        } else {
          size += chunk.length;
          if (size > limit) { response.destroy(new Error("Source exceeds limit.")); return; }
          chunks.push(chunk);
        }
      });
      response.on("end", () => finish(Buffer.concat(chunks)));
      response.on("aborted", () => { if (!settled) reject(new Error("Source response interrupted.")); });
      response.on("error", error => { if (!settled) reject(error); });
    });
    request.on("error", reject);
  });
}
