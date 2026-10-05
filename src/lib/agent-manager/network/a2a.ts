import { AgentCard, Task, TaskState, Role } from "@a2a-js/sdk";
import { type A2ARequestHandler } from "@a2a-js/sdk/server";
import { RequestMalformedError, TaskNotFoundError, TaskNotCancelableError, UnsupportedOperationError } from "@a2a-js/sdk/errors";
import { isTerminal } from "./engine";
import { z } from "zod";
import { definition, skills, submitSchema, type NetworkAgentKey, type NetworkStatus, type NetworkTask } from "./contracts";

export function networkAgentCard(key: NetworkAgentKey, origin: string) {
  const agent = definition(key);
  return AgentCard.fromJSON({
    name: agent.name, description: agent.description, version: "1.0.0",
    supportedInterfaces: [{ url: `${origin}/api/admin/agents/network/a2a/${key}`, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    defaultInputModes: ["application/json"], defaultOutputModes: ["application/json", "text/plain"],
    skills: agent.skills.map((skill) => ({ id: skill, name: skills[skill].name, description: skills[skill].name, tags: ["owner-review"], inputModes: ["application/json"], outputModes: ["application/json"] })),
    securitySchemes: { ownerSession: { apiKeySecurityScheme: { location: "cookie", name: "jumpingjax-admin-session", description: "Authenticated owner session; writes also require same-origin validation." } } },
    securityRequirements: [{ schemes: { ownerSession: { list: [] } } }],
  });
}
const states: Record<NetworkStatus, TaskState> = { queued: TaskState.TASK_STATE_SUBMITTED, working: TaskState.TASK_STATE_WORKING, waiting: TaskState.TASK_STATE_WORKING, completed: TaskState.TASK_STATE_COMPLETED, input_required: TaskState.TASK_STATE_INPUT_REQUIRED, blocked: TaskState.TASK_STATE_REJECTED, failed: TaskState.TASK_STATE_FAILED, cancelled: TaskState.TASK_STATE_CANCELED };
export function wireTask(task: NetworkTask) {
  return Task.fromJSON({
    id: task.id, contextId: task.context_id, status: {
      state: states[task.status], timestamp: task.updated_at,
      message: task.result ? { messageId: task.id, taskId: task.id, contextId: task.context_id, role: Role.ROLE_AGENT, parts: [{ text: task.result.summary }, { data: task.result.data }] } : undefined,
    }, metadata: { sender: task.sender_key, recipient: task.recipient_key, skill: task.skill, networkStatus: task.status },
  });
}
export type A2AStore = {
  submit: (input: z.infer<typeof submitSchema> & { sender: "supervisor"; actorId: string }) => Promise<NetworkTask>;
  load: (id: string, recipient: string, actor: string) => Promise<NetworkTask>;
  cancel: (context: string, actor: string) => Promise<void>;
};
export function createNetworkA2AHandler(key: NetworkAgentKey, actorId: string, origin: string, store: A2AStore): A2ARequestHandler {
  const unsupported = async () => { throw new UnsupportedOperationError(); };
  const load = async (id: string) => {
    if (!z.uuid().safeParse(id).success) throw new TaskNotFoundError();
    try { return await store.load(id, key, actorId); } catch { throw new TaskNotFoundError(); }
  };
  return {
    getAgentCard: async () => networkAgentCard(key, origin),
    getAuthenticatedExtendedAgentCard: unsupported,
    async sendMessage(params) {
      const m = params.message;
      if (params.tenant || (params.configuration && !params.configuration.returnImmediately) || params.configuration?.taskPushNotificationConfig || Object.keys(params.metadata ?? {}).length || !m || m.role !== Role.ROLE_USER || m.parts.length !== 1 || m.parts[0].content?.$case !== "data" || m.taskId || m.extensions.length || m.referenceTaskIds.length || Object.keys(m.metadata ?? {}).length) throw new RequestMalformedError({ message: "Send one structured capability request without sender overrides, callbacks, or task continuation." });
      const input = z.object({ skill: z.string(), input: z.record(z.string(), z.unknown()) }).strict().safeParse(m.parts[0].content.value);
      const parsed = submitSchema.safeParse({ requestId: m.messageId, ...(m.contextId ? { contextId: m.contextId } : {}), recipient: key, ...(input.success ? input.data : {}) });
      if (!parsed.success) throw new RequestMalformedError();
      try { return wireTask(await store.submit({ ...parsed.data, sender: "supervisor", actorId })); }
      catch { throw new RequestMalformedError({ message: "Capability unavailable or conversation cannot accept this request." }); }
    },
    async getTask(params) { if (params.tenant) throw new TaskNotFoundError(); return wireTask(await load(params.id)); },
    async cancelTask(params) { if (params.tenant) throw new TaskNotFoundError(); const task = await load(params.id); if (isTerminal(task.status)) throw new TaskNotCancelableError(); await store.cancel(task.context_id, actorId); return wireTask(await load(task.id)); },
    // Connections do not hold worker leases. Clients poll GetTask.
    async *sendMessageStream() { throw new UnsupportedOperationError(); },
    async *resubscribe() { throw new UnsupportedOperationError(); },
    createTaskPushNotificationConfig: unsupported, getTaskPushNotificationConfig: unsupported,
    listTaskPushNotificationConfigs: unsupported, deleteTaskPushNotificationConfig: unsupported, listTasks: unsupported,
  };
}
