import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "src", "index.mjs");
const grokBin = path.join(os.homedir(), ".grok", "bin", "grok.exe");
const grok = existsSync(grokBin) ? grokBin : "grok";

const add = spawnSync(grok, ["mcp", "add", "chrome-for-ai", "--", "node", entry], {
  encoding: "utf8",
  windowsHide: true,
});

if (add.status !== 0) {
  console.error(add.stdout || "");
  console.error(add.stderr || "");
  console.error("grok mcp add failed; writing config.toml directly");
}

const tomlPath = path.join(os.homedir(), ".grok", "config.toml");
if (!existsSync(tomlPath)) {
  console.error("missing", tomlPath);
  process.exit(1);
}

let toml = readFileSync(tomlPath, "utf8");
const escaped = entry.replaceAll("\\", "\\\\");
const block = [
  "",
  "[mcp_servers.chrome-for-ai]",
  'command = "node"',
  `args = [${JSON.stringify(entry)}]`,
  "startup_timeout_sec = 90",
  "tool_timeout_sec = 180",
  "enabled = true",
  "",
].join("\n");

if (/\[mcp_servers\.chrome-for-ai\]/.test(toml)) {
  toml = toml.replace(
    /\[mcp_servers\.chrome-for-ai\][\s\S]*?(?=\n\[|\s*$)/,
    block.trim() + "\n"
  );
} else {
  toml = toml.replace(/\s*$/, "\n" + block);
}

writeFileSync(tomlPath, toml);
console.log("wrote", tomlPath);
console.log("entry", entry);
console.log("Restart Grok (or /mcps → r) to load grok-browser.");
