import test from "node:test";
import assert from "node:assert/strict";
import { EXTRA_NAMES, EXTRA_TOOLS, runExtraTool } from "../src/extra-tools.mjs";
import { parseCaps, parseBoolean, buildOfficialConfig } from "../src/config.mjs";

test("extra tool names are unique and documented", () => {
  assert.equal(EXTRA_TOOLS.length, EXTRA_NAMES.size);
  for (const tool of EXTRA_TOOLS) {
    assert.ok(tool.name);
    assert.ok(tool.description.length > 20);
    assert.equal(tool.inputSchema.type, "object");
  }
});

test("parseCaps default includes vision and devtools", () => {
  const caps = parseCaps(undefined);
  assert.ok(caps.includes("core"));
  assert.ok(caps.includes("vision"));
  assert.ok(caps.includes("devtools"));
});

test("parseBoolean", () => {
  assert.equal(parseBoolean("1", false), true);
  assert.equal(parseBoolean("no", true), false);
  assert.equal(parseBoolean(undefined, true), true);
});

test("buildOfficialConfig uses chrome channel and persistent profile", () => {
  const prevHeadless = process.env.GROK_BROWSER_HEADLESS;
  const prevCdp = process.env.GROK_BROWSER_CDP;
  const prevExt = process.env.GROK_BROWSER_EXTENSION;
  delete process.env.GROK_BROWSER_CDP;
  delete process.env.GROK_BROWSER_EXTENSION;
  process.env.GROK_BROWSER_HEADLESS = "0";
  const cfg = buildOfficialConfig();
  assert.equal(cfg.browser.launchOptions.channel, "chrome");
  assert.equal(cfg.browser.launchOptions.headless, false);
  assert.ok(cfg.browser.userDataDir);
  assert.match(cfg.browser.userDataDir.replaceAll("\\", "/"), /chrome-for-ai\/profile$/);
  assert.ok(cfg.capabilities.includes("vision"));
  process.env.GROK_BROWSER_HEADLESS = prevHeadless;
  if (prevCdp != null) process.env.GROK_BROWSER_CDP = prevCdp;
  if (prevExt != null) process.env.GROK_BROWSER_EXTENSION = prevExt;
});

test("human_wait returns a delay in range", async () => {
  const started = Date.now();
  const result = await runExtraTool("human_wait", { minMs: 20, maxMs: 40 }, null);
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 15);
  assert.ok(result.content[0].text.includes("waitedMs"));
});

test("stealth_status does not need a browser", async () => {
  const result = await runExtraTool("stealth_status", {}, null);
  const body = JSON.parse(result.content[0].text);
  assert.equal(body.ok, true);
  assert.ok(body.stealthRuntime.includes("patchright"));
  assert.ok(body.official.includes("@playwright/mcp"));
});
