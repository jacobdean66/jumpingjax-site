import { createHash } from "node:crypto";
export function taskFingerprint(recipient: string, skill: string, input: Record<string, unknown>) {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, val]) => [k, canonical(val)])) : v;
  return createHash("sha256").update(JSON.stringify({ recipient, skill, input: canonical(input) })).digest("hex");
}
