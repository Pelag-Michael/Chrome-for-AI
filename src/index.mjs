#!/usr/bin/env node
import { createConnection } from "@playwright/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildOfficialConfig, engineInfo } from "./config.mjs";
import { wrapOfficialServer } from "./wrap.mjs";

function log(...args) {
  console.error("[chrome-for-ai]", ...args);
}

async function main() {
  const info = engineInfo();
  const config = buildOfficialConfig();
  log("starting", JSON.stringify(info));

  const official = await createConnection(config);
  const server = await wrapOfficialServer(official);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("ready (stdio)");
}

main().catch((err) => {
  console.error("[chrome-for-ai] fatal:", err);
  process.exit(1);
});
