import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createToolState, EXTRA_NAMES, EXTRA_TOOLS, runExtraTool } from "./extra-tools.mjs";

/**
 * Official createConnection() already returns a complete MCP Server.
 * We sit a thin wrapper in front: same official tools + extras.
 */
export async function wrapOfficialServer(officialServer) {
  const toolState = createToolState();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "chrome-for-ai-internal", version: "1.1.0" });

  await officialServer.connect(serverTransport);
  await client.connect(clientTransport);

  const wrapper = new Server(
    { name: "chrome-for-ai", version: "1.1.0" },
    { capabilities: { tools: {} } }
  );

  wrapper.setRequestHandler(ListToolsRequestSchema, async () => {
    const listed = await client.listTools();
    const official = listed.tools || [];
    const seen = new Set(official.map((t) => t.name));
    const extras = EXTRA_TOOLS.filter((t) => !seen.has(t.name));
    return { tools: [...official, ...extras] };
  });

  wrapper.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = request.params.arguments || {};
    if (EXTRA_NAMES.has(name)) {
      return runExtraTool(name, args, client, toolState);
    }
    return client.callTool({ name, arguments: args });
  });

  return wrapper;
}
