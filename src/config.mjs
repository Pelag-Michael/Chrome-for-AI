import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";

const HOME = os.homedir();

function envFirst(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
  }
  return undefined;
}

export function defaultProfileDir() {
  return (
    envFirst("CHROME_FOR_AI_PROFILE", "GROK_BROWSER_PROFILE") ||
    path.join(HOME, ".chrome-for-ai", "profile")
  );
}

export function defaultOutputDir() {
  return (
    envFirst("CHROME_FOR_AI_OUTPUT", "GROK_BROWSER_OUTPUT") ||
    path.join(HOME, ".chrome-for-ai", "output")
  );
}

export function parseCaps(raw) {
  const fallback = ["core", "pdf", "vision", "devtools", "storage", "network"];
  if (!raw) return fallback;
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

export function parseBoolean(raw, fallback = false) {
  if (raw == null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function resolveChromePath() {
  const fromEnv = envFirst("CHROME_FOR_AI_CHROME", "GROK_BROWSER_CHROME");
  if (fromEnv) return fromEnv;
  if (process.platform !== "win32") return undefined;
  const candidates = [
    path.join(process.env["PROGRAMFILES"] || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ];
  return candidates.find((p) => p && existsSync(p));
}

export function engineInfo() {
  return {
    official: "@playwright/mcp@0.0.78",
    stealthRuntime: "patchright@1.62.1 (aliased over playwright + playwright-core)",
    profile: defaultProfileDir(),
    output: defaultOutputDir(),
    chrome: resolveChromePath() || "channel:chrome",
    headless: parseBoolean(envFirst("CHROME_FOR_AI_HEADLESS", "GROK_BROWSER_HEADLESS"), false),
    proxy: envFirst("CHROME_FOR_AI_PROXY", "GROK_BROWSER_PROXY") || null,
    cdp: envFirst("CHROME_FOR_AI_CDP", "GROK_BROWSER_CDP") || null,
    extension: parseBoolean(envFirst("CHROME_FOR_AI_EXTENSION", "GROK_BROWSER_EXTENSION"), false),
  };
}

/**
 * Config object accepted by official createConnection().
 * Stealth comes from the patchright alias + real Chrome + persistent profile.
 * Do NOT inject a fake user-agent or heavy fingerprint script here —
 * Patchright docs: use Chrome without fingerprint injection.
 */
export function buildOfficialConfig() {
  const info = engineInfo();
  const capabilities = parseCaps(envFirst("CHROME_FOR_AI_CAPS", "GROK_BROWSER_CAPS"));
  const chromePath = resolveChromePath();
  const actionMs = Number(envFirst("CHROME_FOR_AI_ACTION_MS", "GROK_BROWSER_ACTION_MS") || 15000);
  const navMs = Number(envFirst("CHROME_FOR_AI_NAV_MS", "GROK_BROWSER_NAV_MS") || 120000);
  const settleMs = Number(envFirst("CHROME_FOR_AI_SETTLE_MS", "GROK_BROWSER_SETTLE_MS") || 800);

  if (info.extension) {
    return {
      extension: true,
      capabilities,
      outputDir: info.output,
      imageResponses: "allow",
      timeouts: { action: actionMs, navigation: navMs, settle: settleMs },
    };
  }

  const isolated = parseBoolean(envFirst("CHROME_FOR_AI_ISOLATED", "GROK_BROWSER_ISOLATED"), false);
  const locale = envFirst("CHROME_FOR_AI_LOCALE", "GROK_BROWSER_LOCALE");
  const timezoneId = envFirst("CHROME_FOR_AI_TZ", "GROK_BROWSER_TZ");
  const browser = {
    browserName: "chromium",
    isolated,
    ...(isolated ? {} : { userDataDir: info.profile }),
    launchOptions: {
      channel: envFirst("CHROME_FOR_AI_CHANNEL", "GROK_BROWSER_CHANNEL") || "chrome",
      headless: info.headless,
      ...(chromePath ? { executablePath: chromePath } : {}),
      ...(info.proxy ? { proxy: { server: info.proxy } } : {}),
    },
    contextOptions: {
      viewport: null,
      ignoreHTTPSErrors: Boolean(info.proxy) || parseBoolean(envFirst("CHROME_FOR_AI_IGNORE_HTTPS", "GROK_BROWSER_IGNORE_HTTPS"), false),
      ...(locale ? { locale } : {}),
      ...(timezoneId ? { timezoneId } : {}),
    },
  };

  if (info.cdp) {
    delete browser.launchOptions;
    delete browser.userDataDir;
    browser.cdpEndpoint = info.cdp;
  }

  return {
    browser,
    capabilities,
    outputDir: info.output,
    imageResponses: "allow",
    snapshot: { mode: "full", boxes: true },
    timeouts: { action: actionMs, navigation: navMs, settle: settleMs },
  };
}
