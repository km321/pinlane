import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { handleMcpTool, mcpToolDefinitions } from "@/mcp/tools";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: string | number | null | undefined, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
  status = 400,
) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status },
  );
}

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) {
    return rpcError(null, -32001, "Unauthorized", 401);
  }

  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  const { id, method, params } = body;

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "pinlane", version: "0.1.0" },
        });
      case "notifications/initialized":
        return new NextResponse(null, { status: 204 });
      case "tools/list":
        return rpcResult(id, { tools: mcpToolDefinitions });
      case "tools/call": {
        const name = String(params?.name ?? "");
        const args = (params?.arguments as Record<string, unknown>) ?? {};
        const result = await handleMcpTool(auth.workspace.id, name, args);
        return rpcResult(id, result);
      }
      case "ping":
        return rpcResult(id, {});
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return rpcError(id, -32000, message, 500);
  }
}

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    name: "pinlane",
    version: "0.1.0",
    tools: mcpToolDefinitions.map((t) => t.name),
    workspace: { id: auth.workspace.id, name: auth.workspace.name },
  });
}
