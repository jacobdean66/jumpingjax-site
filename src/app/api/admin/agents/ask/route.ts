import { permanentAgentRoute } from "@/lib/agent-manager/permanent-agent-bridge";

export const dynamic = "force-dynamic";

export function GET() {
  return permanentAgentRoute("ask");
}

export function POST(request: Request) {
  return permanentAgentRoute("ask", request);
}
