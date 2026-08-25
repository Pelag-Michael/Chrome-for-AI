import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createConnection } from "@playwright/mcp";
import { buildOfficialConfig } from "../src/config.mjs";
import { wrapOfficialServer } from "../src/wrap.mjs";

process.env.GROK_BROWSER_HEADLESS = process.env.GROK_BROWSER_HEADLESS || "1";
process.env.GROK_BROWSER_ISOLATED = process.env.GROK_BROWSER_ISOLATED || "1";

const official = await createConnection(buildOfficialConfig());
const wrapper = await wrapOfficialServer(official);
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await wrapper.connect(serverTransport);

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(clientTransport);

const listed = await client.listTools();
const names = listed.tools.map((t) => t.name).sort();
console.log("toolCount", names.length);
console.log("officialSample", names.filter((n) => n.startsWith("browser_")).slice(0, 20).join(", "));
console.log("extras", names.filter((n) => !n.startsWith("browser_")).join(", "));

const requiredOfficial = ["browser_navigate", "browser_click", "browser_evaluate"];
for (const name of requiredOfficial) {
  if (!names.includes(name)) throw new Error("missing official tool " + name);
}

const requiredExtras = [
  "browser_snapshot_refs",
  "browser_click_ref",
  "browser_fill_ref",
  "browser_smart_read",
  "browser_annotated_screenshot",
  "browser_record_step",
  "browser_replay_flow",
];
for (const name of requiredExtras) {
  if (!names.includes(name)) throw new Error("missing extra tool " + name);
}

const status = await client.callTool({ name: "stealth_status", arguments: {} });
const text = status.content?.map((c) => c.text).join("\n") || "";
if (!text.includes("patchright")) throw new Error("stealth_status missing patchright");
console.log("stealth_status ok");

await client.close().catch(() => {});
process.exit(0);
