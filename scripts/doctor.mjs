import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { engineInfo, buildOfficialConfig } from "../src/config.mjs";

const require = createRequire(import.meta.url);
const report = { ok: true, checks: [] };

function check(name, pass, detail) {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(`${pass ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

check("node", true, process.version);

let pwName = null;
let pwVersion = null;
try {
  const pkg = require("playwright/package.json");
  pwName = pkg.name;
  pwVersion = pkg.version;
  check("playwright alias is patchright", pkg.name === "patchright", `${pkg.name}@${pkg.version}`);
} catch (e) {
  check("playwright alias is patchright", false, String(e.message || e));
}

try {
  const pkg = require("playwright-core/package.json");
  check("playwright-core alias is patchright-core", pkg.name === "patchright-core", `${pkg.name}@${pkg.version}`);
} catch (e) {
  check("playwright-core alias is patchright-core", false, String(e.message || e));
}

try {
  const mcp = require("@playwright/mcp/package.json");
  check("@playwright/mcp installed", true, `${mcp.name}@${mcp.version}`);
} catch (e) {
  check("@playwright/mcp installed", false, String(e.message || e));
}

try {
  const { tools } = require("playwright-core/lib/coreBundle");
  check("createConnection export", typeof tools?.createConnection === "function", "playwright-core/lib/coreBundle.tools.createConnection");
} catch (e) {
  check("createConnection export", false, String(e.message || e));
}

const info = engineInfo();
const chromeOk = info.chrome === "channel:chrome" || existsSync(info.chrome);
check("Chrome binary", chromeOk, String(info.chrome));

const grokToml = path.join(os.homedir(), ".grok", "config.toml");
if (existsSync(grokToml)) {
  const txt = readFileSync(grokToml, "utf8");
  const registered = /mcp_servers\.(grok-browser|chrome-for-ai)/.test(txt);
  check("registered in ~/.grok/config.toml", registered, grokToml);
} else {
  check("registered in ~/.grok/config.toml", false, "config.toml missing");
}

console.log("\nengine:", JSON.stringify(info, null, 2));
console.log("official createConnection config:", JSON.stringify(buildOfficialConfig(), null, 2));
process.exit(report.ok ? 0 : 1);
