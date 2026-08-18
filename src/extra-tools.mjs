import { engineInfo } from "./config.mjs";

const AUDIT_JS = `() => {
  const chrome = window.chrome;
  const nav = navigator;
  return {
    href: location.href,
    title: document.title,
    webdriver: nav.webdriver === true,
    webdriverType: typeof nav.webdriver,
    languages: [...(nav.languages || [])],
    language: nav.language,
    platform: nav.platform,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    maxTouchPoints: nav.maxTouchPoints,
    vendor: nav.vendor,
    userAgent: nav.userAgent,
    userAgentData: nav.userAgentData ? {
      mobile: nav.userAgentData.mobile,
      platform: nav.userAgentData.platform,
      brands: nav.userAgentData.brands
    } : null,
    plugins: nav.plugins ? nav.plugins.length : 0,
    mimeTypes: nav.mimeTypes ? nav.mimeTypes.length : 0,
    chromeRuntime: !!(chrome && chrome.runtime),
    chromeApp: !!(chrome && chrome.app),
    chromeCsi: !!(chrome && chrome.csi),
    chromeLoadTimes: typeof chrome?.loadTimes === "function",
    permissions: typeof nav.permissions?.query === "function",
    webgl: (() => {
      try {
        const c = document.createElement("canvas");
        const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
        if (!gl) return null;
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        return {
          vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
          renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
        };
      } catch (e) {
        return { error: String(e) };
      }
    })(),
    outerInner: { outerWidth: window.outerWidth, innerWidth: window.innerWidth, outerHeight: window.outerHeight, innerHeight: window.innerHeight },
    notificationPermission: typeof Notification !== "undefined" ? Notification.permission : null
  };
}`;

const CAPTCHA_JS = `() => {
  const has = (sel) => !!document.querySelector(sel);
  const text = (document.body?.innerText || "").slice(0, 4000);
  const title = document.title || "";
  const recaptcha = has("iframe[src*='recaptcha']") || has(".g-recaptcha") || !!(window.grecaptcha);
  const hcaptcha = has("iframe[src*='hcaptcha']") || has(".h-captcha") || !!(window.hcaptcha);
  const turnstile = has("iframe[src*='challenges.cloudflare.com']") || has(".cf-turnstile") || !!(window.turnstile);
  const funcaptcha = has("iframe[src*='arkoselabs']") || has("iframe[src*='funcaptcha']");
  const geetest = has(".geetest_holder") || has("iframe[src*='geetest']");
  const cloudflareIuam =
    /just a moment/i.test(title) ||
    /checking your browser|attention required|cf-challenge|cloudflare/i.test(text) &&
      (has("#challenge-running") || has("#cf-challenge-running") || has(".cf-browser-verification") || has("#challenge-stage"));
  const datadome = /datadome/i.test(text) || has("#datadome-captcha") || has("iframe[src*='captcha-delivery.com']");
  const perimeterx = /access denied|press and hold/i.test(text) && /px-captcha|perimeterx|_px/i.test(document.documentElement.innerHTML);
  const kinds = [];
  if (recaptcha) kinds.push("recaptcha");
  if (hcaptcha) kinds.push("hcaptcha");
  if (turnstile) kinds.push("turnstile");
  if (funcaptcha) kinds.push("funcaptcha");
  if (geetest) kinds.push("geetest");
  if (cloudflareIuam) kinds.push("cloudflare_iuam");
  if (datadome) kinds.push("datadome");
  if (perimeterx) kinds.push("perimeterx");
  return {
    href: location.href,
    title,
    detected: kinds.length > 0,
    kinds,
    note: kinds.length
      ? "Passive JS challenges (Cloudflare IUAM / some Turnstile) often clear themselves in this stealth runtime. Interactive captchas need a human in the headed window."
      : "No common challenge widget detected."
  };
}`;

const CHALLENGE_GONE_JS = `() => {
  const title = document.title || "";
  const text = (document.body?.innerText || "").slice(0, 2000);
  const blocked =
    /just a moment/i.test(title) ||
    !!document.querySelector("#challenge-running, #cf-challenge-running, .cf-browser-verification, #challenge-stage, .cf-turnstile, iframe[src*='challenges.cloudflare.com']");
  return { blocked, title, href: location.href, sample: text.slice(0, 240) };
}`;

const SANNYSOFT_JS = `() => {
  const rows = [...document.querySelectorAll("table tr")].map((tr) => {
    const cells = [...tr.querySelectorAll("td, th")].map((td) => td.innerText.trim());
    return cells;
  }).filter((r) => r.length >= 2);
  return { href: location.href, title: document.title, rows: rows.slice(0, 40) };
}`;

export const EXTRA_TOOLS = [
  {
    name: "stealth_status",
    description:
      "Show how this MCP is wired: official Playwright MCP surface + Patchright stealth runtime, Chrome profile, proxy, CDP/extension attach.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "stealth_audit",
    description:
      "Evaluate the current page for common automation fingerprints (webdriver, chrome.*, plugins, WebGL, UA). Uses official browser_evaluate.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "stealth_check",
    description:
      "Open a public bot-detector page and return a compact report. Default: https://bot.sannysoft.com/",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Detector URL. Default https://bot.sannysoft.com/",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "captcha_detect",
    description:
      "Detect reCAPTCHA, hCaptcha, Turnstile, FunCaptcha, GeeTest, Cloudflare IUAM, DataDome, PerimeterX on the current page. Does not solve interactive captchas.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "challenge_wait",
    description:
      "Poll the current page until a Cloudflare-style interstitial disappears, or timeout. Headed Chrome lets passive challenges finish.",
    inputSchema: {
      type: "object",
      properties: {
        timeoutMs: { type: "number", description: "Max wait. Default 30000." },
        intervalMs: { type: "number", description: "Poll interval. Default 750." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "human_wait",
    description: "Sleep a human-ish random delay so navigation/challenges can settle.",
    inputSchema: {
      type: "object",
      properties: {
        minMs: { type: "number", description: "Minimum delay. Default 400." },
        maxMs: { type: "number", description: "Maximum delay. Default 1400." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "human_scroll",
    description: "Smooth-scroll the current page by a pixel delta (official browser_evaluate).",
    inputSchema: {
      type: "object",
      properties: {
        dy: { type: "number", description: "Vertical pixels. Default 600." },
        dx: { type: "number", description: "Horizontal pixels. Default 0." },
      },
      additionalProperties: false,
    },
  },
];

export const EXTRA_NAMES = new Set(EXTRA_TOOLS.map((t) => t.name));

function textResult(obj) {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: "text", text }] };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(minMs, maxMs) {
  const a = Math.max(0, Number(minMs) || 0);
  const b = Math.max(a, Number(maxMs) || a);
  return a + Math.floor(Math.random() * (b - a + 1));
}

async function officialEvaluate(client, fnSource) {
  const result = await client.callTool({
    name: "browser_evaluate",
    arguments: { function: fnSource },
  });
  return result;
}

function parseEvaluatePayload(result) {
  const raw = result?.content?.map((c) => c.text).filter(Boolean).join("\n") || "";
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export async function runExtraTool(name, args, client) {
  switch (name) {
    case "stealth_status":
      return textResult({
        ok: true,
        ...engineInfo(),
        extras: [...EXTRA_NAMES],
        official: "All @playwright/mcp tools are also available (navigate, click, type, snapshot, pdf, vision, ...).",
        antiBot:
          "Patchright patches Runtime.enable / Console.enable / automation flags. Real Chrome + persistent profile. Interactive captchas still need a human.",
      });

    case "stealth_audit": {
      const result = await officialEvaluate(client, AUDIT_JS);
      const data = parseEvaluatePayload(result);
      const flags = [];
      if (data.webdriver) flags.push("navigator.webdriver=true");
      if (data.webdriverType !== "undefined" && data.webdriver !== false) flags.push(`webdriver type=${data.webdriverType}`);
      if (!data.chromeRuntime) flags.push("window.chrome.runtime missing");
      if (!data.plugins) flags.push("plugins=0");
      return textResult({
        summary: flags.length ? `possible tells: ${flags.join("; ")}` : "no obvious JS automation tells",
        flags,
        data,
      });
    }

    case "stealth_check": {
      const url = args?.url || "https://bot.sannysoft.com/";
      await client.callTool({ name: "browser_navigate", arguments: { url } });
      await sleep(2500);
      const result = await officialEvaluate(client, SANNYSOFT_JS);
      return textResult({
        url,
        report: parseEvaluatePayload(result),
        hint: "Also try https://abrahamjuliot.github.io/creepjs/ or https://kaliiiiiiiiii.github.io/brotector/",
      });
    }

    case "captcha_detect": {
      const result = await officialEvaluate(client, CAPTCHA_JS);
      return textResult(parseEvaluatePayload(result));
    }

    case "challenge_wait": {
      const timeoutMs = Number(args?.timeoutMs || 30000);
      const intervalMs = Number(args?.intervalMs || 750);
      const started = Date.now();
      let last = null;
      while (Date.now() - started < timeoutMs) {
        const result = await officialEvaluate(client, CHALLENGE_GONE_JS);
        last = parseEvaluatePayload(result);
        if (last && last.blocked === false) {
          return textResult({ ok: true, waitedMs: Date.now() - started, last });
        }
        await sleep(intervalMs);
      }
      return textResult({
        ok: false,
        timedOut: true,
        waitedMs: Date.now() - started,
        last,
        hint: "If this is an interactive captcha, solve it in the headed Chrome window, then call captcha_detect again.",
      });
    }

    case "human_wait": {
      const ms = jitter(args?.minMs ?? 400, args?.maxMs ?? 1400);
      await sleep(ms);
      return textResult({ ok: true, waitedMs: ms });
    }

    case "human_scroll": {
      const dy = Number(args?.dy ?? 600);
      const dx = Number(args?.dx ?? 0);
      const result = await officialEvaluate(
        client,
        `() => { window.scrollBy({ top: ${dy}, left: ${dx}, behavior: "smooth" }); return { scrollX: window.scrollX, scrollY: window.scrollY }; }`
      );
      return textResult(parseEvaluatePayload(result));
    }

    default:
      return textResult({ error: `unknown extra tool: ${name}` });
  }
}
