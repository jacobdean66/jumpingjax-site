import { permanentAgentRoute } from "@/lib/agent-manager/permanent-agent-bridge";

export const dynamic = "force-dynamic";

export function GET() {
  return permanentAgentRoute("projects");
}

export function POST(request: Request) {
  return permanentAgentRoute("projects", request);
}
