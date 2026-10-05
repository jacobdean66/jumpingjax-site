import { definition, MAX_NETWORK_HOPS, validateSkillInput, type NetworkAgentKey, type NetworkResult, type NetworkSkill, type NetworkTask } from "./contracts";
export type Delegate = { recipient: NetworkAgentKey; skill: NetworkSkill; input: Record<string, unknown> };
export type AdapterOutput = NetworkResult | { delegate: Delegate; summary: string };
export type AdapterContext = { task: NetworkTask; history: NetworkTask[]; signal: AbortSignal };
export type AgentAdapter = { key: NetworkAgentKey; execute(skill: NetworkSkill, input: Record<string, unknown>, context: AdapterContext): Promise<AdapterOutput> };
export function isTerminal(status: string) { return ["completed", "input_required", "blocked", "failed", "cancelled"].includes(status); }
export async function executeAdapter(task: NetworkTask, adapters: AgentAdapter[], history: NetworkTask[], signal: AbortSignal): Promise<AdapterOutput> {
  if (signal.aborted) throw new Error("Request timed out.");
  const input = validateSkillInput(task.recipient_key, task.skill, task.input);
  const adapter = adapters.find((a) => a.key === task.recipient_key);
  if (!adapter) throw new Error("Agent adapter is unavailable.");
  const output = await new Promise<AdapterOutput>((resolve, reject) => {
    const abort = () => reject(new Error("Request timed out or was cancelled."));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { signal.removeEventListener("abort", abort); abort(); return; }
    // All adapters are read-only. A late provider response cannot submit a
    // handoff or persist a result after this promise has been interrupted.
    void adapter.execute(task.skill, input, { task, history, signal }).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
  if (signal.aborted) throw new Error("Request timed out.");
  if ("delegate" in output) {
    if (task.hop >= MAX_NETWORK_HOPS) return { status: "blocked", summary: "The handoff limit was reached; owner review is required.", data: {} };
    const child = output.delegate;
    definition(child.recipient); validateSkillInput(child.recipient, child.skill, child.input);
    let ancestor: NetworkTask | undefined = task;
    while (ancestor) {
      if (ancestor.recipient_key === child.recipient && ancestor.skill === child.skill) return { status: "blocked", summary: "A repeated handoff was stopped to prevent a conversation loop.", data: {} };
      const parentId: string | null = ancestor.parent_task_id;
      ancestor = history.find((candidate) => candidate.id === parentId);
    }
  } else {
    if (!isTerminal(output.status) || !output.summary || output.summary.length > 2000 || JSON.stringify(output).length > 24000) throw new Error("Invalid adapter result.");
    if (output.links?.some((l) => !l.href.startsWith("/admin/") || l.href.includes("\\") || l.href.includes("\n"))) throw new Error("Invalid adapter link.");
  }
  return output;
}
