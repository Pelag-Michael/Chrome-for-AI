import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createConnection } from "@playwright/mcp";
import { buildOfficialConfig } from "../src/config.mjs";
import { parseEvaluatePayload } from "../src/extra-tools.mjs";
import { wrapOfficialServer } from "../src/wrap.mjs";

process.env.GROK_BROWSER_HEADLESS = "1";
process.env.GROK_BROWSER_ISOLATED = "1";

const page = `<!doctype html><html><head><title>Chrome for AI live test</title><style>
body{font:16px sans-serif} #target{position:absolute;left:30px;top:80px;width:140px;height:40px}
#cover{position:absolute;left:30px;top:80px;width:140px;height:40px;z-index:5;background:#ddd}
#email{position:absolute;left:30px;top:150px;width:220px;height:32px}
</style></head><body><main><h1>Live test article</h1><p>Rendered DOM fallback works.</p>
<button id="target" onclick="window.clicked=(window.clicked||0)+1">Submit</button><div id="cover">overlay</div>
<label for="email">Email</label><input id="email" placeholder="Email"></main></body></html>`;

const server = http.createServer((request, response) => {
  if (request.url === "/docs/page.md") {
    response.writeHead(200, { "content-type": "text/markdown; charset=utf-8" });
    response.end("# Markdown source\n\nSmart read works.\n");
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(page);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const url = `http://127.0.0.1:${address.port}/docs/page`;
let client;
let wrapper;
let official;

const json = (result) => JSON.parse(result.content.find((part) => part.type === "text").text);

try {
  official = await createConnection(buildOfficialConfig());
  wrapper = await wrapOfficialServer(official);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await wrapper.connect(serverTransport);
  client = new Client({ name: "live-smoke", version: "1.0.0" });
  await client.connect(clientTransport);

  await client.callTool({ name: "browser_navigate", arguments: { url } });
  const snapshot = json(await client.callTool({ name: "browser_snapshot_refs", arguments: {} }));
  assert.equal(snapshot.ok, true, JSON.stringify(snapshot));
  assert.equal(snapshot.elements[0].ref, "@e1");
  assert.equal(snapshot.elements[1].ref, "@e2");

  const obstructed = json(await client.callTool({ name: "browser_click_ref", arguments: { ref: "@e1" } }));
  assert.equal(obstructed.status, "obstructed");
  await client.callTool({ name: "browser_evaluate", arguments: { function: "() => { document.querySelector('#cover').remove(); return {ok:true}; }" } });
  assert.equal(json(await client.callTool({ name: "browser_click_ref", arguments: { ref: "@e1" } })).status, "clicked");
  assert.equal(json(await client.callTool({ name: "browser_fill_ref", arguments: { ref: "@e2", text: "ai@example.com" } })).status, "filled");

  const read = json(await client.callTool({ name: "browser_smart_read", arguments: { url } }));
  assert.equal(read.source, "markdown");
  assert.match(read.content, /Smart read works/);
  const domRead = json(await client.callTool({ name: "browser_smart_read", arguments: { url, preferLlms: false } }));
  assert.equal(domRead.source, "dom");
  assert.match(domRead.content, /Rendered DOM fallback works/);

  const screenshot = await client.callTool({ name: "browser_annotated_screenshot", arguments: {} });
  assert.ok(screenshot.content.some((part) => part.type === "image"));
  const cleanup = parseEvaluatePayload(await client.callTool({ name: "browser_evaluate", arguments: { function: "() => ({ present: !!document.querySelector('#__chrome_for_ai_marks__') })" } }));
  assert.equal(cleanup.present, false);

  await client.callTool({ name: "browser_record_step", arguments: { flow: "demo", action: "navigate", url, reset: true } });
  await client.callTool({ name: "browser_record_step", arguments: { flow: "demo", action: "fill", ref: "@e2", text: "replayed@example.com" } });
  const replay = json(await client.callTool({ name: "browser_replay_flow", arguments: { flow: "demo" } }));
  assert.equal(replay.ok, true);
  assert.equal(replay.completed, 2);

  console.log("live smoke ok: refs, obstruction, fill, smart read, screenshot, replay");
} finally {
  await client?.close().catch(() => {});
  await wrapper?.close().catch(() => {});
  await official?.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

process.exit(0);
