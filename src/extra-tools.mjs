import { engineInfo } from "./config.mjs";

const MAX_READ_BYTES = 2 * 1024 * 1024;
const MAX_FLOWS = 50;
const MAX_STEPS = 100;

const AUDIT_JS = `() => {
  const chrome = window.chrome;
  const nav = navigator;
  return {
    href: location.href, title: document.title,
    webdriver: nav.webdriver === true, webdriverType: typeof nav.webdriver,
    languages: [...(nav.languages || [])], language: nav.language,
    platform: nav.platform, hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory, maxTouchPoints: nav.maxTouchPoints,
    vendor: nav.vendor, userAgent: nav.userAgent,
    userAgentData: nav.userAgentData ? { mobile: nav.userAgentData.mobile, platform: nav.userAgentData.platform, brands: nav.userAgentData.brands } : null,
    plugins: nav.plugins ? nav.plugins.length : 0,
    mimeTypes: nav.mimeTypes ? nav.mimeTypes.length : 0,
    chromeRuntime: !!(chrome && chrome.runtime), chromeApp: !!(chrome && chrome.app),
    chromeCsi: !!(chrome && chrome.csi), chromeLoadTimes: typeof chrome?.loadTimes === "function",
    permissions: typeof nav.permissions?.query === "function",
    webgl: (() => { try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return null;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return { vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    } catch (error) { return { error: String(error) }; } })(),
    outerInner: { outerWidth: window.outerWidth, innerWidth: window.innerWidth, outerHeight: window.outerHeight, innerHeight: window.innerHeight },
    notificationPermission: typeof Notification !== "undefined" ? Notification.permission : null
  };
}`;

const CAPTCHA_JS = `() => {
  const has = (selector) => !!document.querySelector(selector);
  const text = (document.body?.innerText || "").slice(0, 4000);
  const title = document.title || "";
  const tests = {
    recaptcha: has("iframe[src*='recaptcha'],.g-recaptcha") || !!window.grecaptcha,
    hcaptcha: has("iframe[src*='hcaptcha'],.h-captcha") || !!window.hcaptcha,
    turnstile: has("iframe[src*='challenges.cloudflare.com'],.cf-turnstile") || !!window.turnstile,
    funcaptcha: has("iframe[src*='arkoselabs'],iframe[src*='funcaptcha']"),
    geetest: has(".geetest_holder,iframe[src*='geetest']"),
    cloudflare_iuam: /just a moment/i.test(title) || (/checking your browser|attention required|cf-challenge|cloudflare/i.test(text) && has("#challenge-running,#cf-challenge-running,.cf-browser-verification,#challenge-stage")),
    datadome: /datadome/i.test(text) || has("#datadome-captcha,iframe[src*='captcha-delivery.com']"),
    perimeterx: /access denied|press and hold/i.test(text) && /px-captcha|perimeterx|_px/i.test(document.documentElement.innerHTML)
  };
  const kinds = Object.entries(tests).filter(([, value]) => value).map(([name]) => name);
  return { href: location.href, title, detected: kinds.length > 0, kinds, note: kinds.length ? "Passive JS challenges may clear themselves; interactive captchas need a human." : "No common challenge widget detected." };
}`;

const CHALLENGE_JS = `() => {
  const title = document.title || "";
  const text = (document.body?.innerText || "").slice(0, 2000);
  const blocked = /just a moment/i.test(title) || !!document.querySelector("#challenge-running,#cf-challenge-running,.cf-browser-verification,#challenge-stage,.cf-turnstile,iframe[src*='challenges.cloudflare.com']");
  return { blocked, title, href: location.href, sample: text.slice(0, 240) };
}`;

const SANNYSOFT_JS = `() => ({ href: location.href, title: document.title, rows: [...document.querySelectorAll("table tr")].map((tr) => [...tr.querySelectorAll("td,th")].map((td) => td.innerText.trim())).filter((row) => row.length >= 2).slice(0, 40) })`;

function walkRootsPrelude() {
  return `
    const roots = [], seenRoots = new Set();
    const visitRoot = (root) => {
      if (!root || seenRoots.has(root)) return;
      seenRoots.add(root); roots.push(root);
      for (const node of root.querySelectorAll ? root.querySelectorAll("*") : []) {
        if (node.shadowRoot) visitRoot(node.shadowRoot);
        if (node.tagName === "IFRAME" || node.tagName === "FRAME") { try { visitRoot(node.contentDocument); } catch {} }
      }
    };
    visitRoot(document);
  `;
}

function snapshotSource(maxElements) {
  return `() => {
    ${walkRootsPrelude()}
    const selector = "a[href],button,input:not([type='hidden']),textarea,select,summary,[contenteditable='true'],[role='button'],[role='link'],[role='checkbox'],[role='radio'],[role='tab'],[role='menuitem'],[tabindex]:not([tabindex='-1']),[onclick]";
    for (const root of roots) for (const old of root.querySelectorAll ? root.querySelectorAll("[data-ai-ref]") : []) old.removeAttribute("data-ai-ref");
    const role = (el) => {
      if (el.getAttribute("role")) return el.getAttribute("role");
      const tag = el.tagName.toLowerCase(), type = (el.getAttribute("type") || "text").toLowerCase();
      if (tag === "a") return "link";
      if (tag === "button" || tag === "summary" || (tag === "input" && ["button","submit","reset","image"].includes(type))) return "button";
      if (tag === "select") return "combobox";
      if (tag === "textarea" || tag === "input") return type === "checkbox" || type === "radio" ? type : "textbox";
      return tag;
    };
    const name = (el) => {
      const explicit = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt");
      if (explicit) return explicit.trim();
      if (el.labels?.length) return [...el.labels].map((label) => label.innerText || label.textContent || "").join(" ").trim();
      return (el.innerText || el.value || el.getAttribute("placeholder") || el.textContent || "").replace(/\\s+/g, " ").trim();
    };
    const elements = [], seen = new Set(), max = ${JSON.stringify(maxElements)};
    for (const root of roots) for (const el of root.querySelectorAll ? root.querySelectorAll(selector) : []) {
      if (seen.has(el) || elements.length >= max) continue;
      seen.add(el);
      const win = el.ownerDocument?.defaultView;
      if (!win) continue;
      const style = win.getComputedStyle(el), rect = el.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= win.innerHeight || rect.left >= win.innerWidth) continue;
      const id = "e" + (elements.length + 1);
      el.setAttribute("data-ai-ref", id);
      elements.push({ ref: "@" + id, tag: el.tagName.toLowerCase(), role: role(el), name: name(el).slice(0, 160), type: el.getAttribute("type") || undefined, placeholder: el.getAttribute("placeholder") || undefined, disabled: !!el.disabled || el.getAttribute("aria-disabled") === "true", rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } });
    }
    return { ok: true, url: location.href, title: document.title, count: elements.length, truncated: elements.length >= max, elements };
  }`;
}

function findRefPrelude(ref) {
  return `
    ${walkRootsPrelude()}
    const wanted = ${JSON.stringify(ref.slice(1))};
    let el = null;
    for (const root of roots) { el = [...(root.querySelectorAll ? root.querySelectorAll("[data-ai-ref]") : [])].find((node) => node.getAttribute("data-ai-ref") === wanted); if (el) break; }
    if (!el) return { ok: false, status: "missing", ref: "@" + wanted, message: "Unknown or stale ref. Call browser_snapshot_refs again." };
  `;
}

function clickSource(ref) {
  return `() => {
    ${findRefPrelude(ref)}
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return { ok: false, status: "disabled", ref: "@" + wanted };
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const rect = el.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2, doc = el.ownerDocument;
    const hit = doc.elementFromPoint(x, y), up = (node) => node?.parentNode || node?.host || node?.getRootNode?.()?.host || null;
    const related = (a, b) => {
      for (let node = a; node; node = up(node)) if (node === b) return true;
      for (let node = b; node; node = up(node)) if (node === a) return true;
      const hitLabel = a?.closest?.("label"), elLabel = b?.closest?.("label");
      return !!(hitLabel && (hitLabel.control === b || hitLabel.contains(b))) || !!(elLabel && elLabel.contains(a));
    };
    if (hit && !related(hit, el)) {
      const desc = (hit.tagName || "element").toLowerCase() + (hit.id ? "#" + hit.id : "") + (typeof hit.className === "string" && hit.className.trim() ? "." + hit.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
      return { ok: false, status: "obstructed", ref: "@" + wanted, coveringElement: desc.slice(0, 180), message: "Target is covered at its click point. Dismiss the covering element first." };
    }
    el.focus?.({ preventScroll: true });
    const view = doc.defaultView;
    for (const type of ["pointerdown","mousedown","pointerup","mouseup"]) {
      const Ctor = type.startsWith("pointer") && view.PointerEvent ? view.PointerEvent : view.MouseEvent;
      el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: type.endsWith("down") ? 1 : 0, pointerType: "mouse" }));
    }
    el.click();
    return { ok: true, status: "clicked", ref: "@" + wanted, tag: el.tagName.toLowerCase(), name: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 120) };
  }`;
}

function fillSource(ref, text) {
  return `() => {
    ${findRefPrelude(ref)}
    if (el.disabled || el.readOnly || el.getAttribute("aria-disabled") === "true") return { ok: false, status: "disabled", ref: "@" + wanted };
    const value = ${JSON.stringify(text)};
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); el.focus?.({ preventScroll: true });
    if (el.isContentEditable) el.textContent = value;
    else if (el.tagName === "INPUT") { const setter = Object.getOwnPropertyDescriptor(el.ownerDocument.defaultView.HTMLInputElement.prototype, "value")?.set; setter ? setter.call(el, value) : (el.value = value); }
    else if (el.tagName === "TEXTAREA") { const setter = Object.getOwnPropertyDescriptor(el.ownerDocument.defaultView.HTMLTextAreaElement.prototype, "value")?.set; setter ? setter.call(el, value) : (el.value = value); }
    else return { ok: false, status: "unsupported", ref: "@" + wanted, message: "Ref is not fillable." };
    const view = el.ownerDocument.defaultView;
    el.dispatchEvent(new view.InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value }));
    el.dispatchEvent(new view.Event("change", { bubbles: true, composed: true }));
    return { ok: true, status: "filled", ref: "@" + wanted, length: value.length };
  }`;
}

const ANNOTATE_JS = `() => {
  ${walkRootsPrelude()}
  let count = 0;
  for (const root of roots) {
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    if (!doc || doc.getElementById("__chrome_for_ai_marks__")) continue;
    const host = doc.createElement("div"); host.id = "__chrome_for_ai_marks__"; host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, { position: "fixed", inset: "0", zIndex: "2147483647", pointerEvents: "none" });
    for (const el of doc.querySelectorAll("[data-ai-ref]")) {
      const r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.right <= 0 || r.top >= doc.defaultView.innerHeight || r.left >= doc.defaultView.innerWidth) continue;
      const box = doc.createElement("div"), badge = doc.createElement("span");
      Object.assign(box.style, { position: "absolute", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", border: "2px solid #ff4d00", boxSizing: "border-box", background: "rgba(255,77,0,.06)" });
      badge.textContent = "@" + el.getAttribute("data-ai-ref");
      Object.assign(badge.style, { position: "absolute", left: "-2px", top: "-20px", padding: "1px 4px", borderRadius: "3px", background: "#ff4d00", color: "white", font: "bold 12px/16px Arial,sans-serif", whiteSpace: "nowrap" });
      box.appendChild(badge); host.appendChild(box); count++;
    }
    doc.documentElement.appendChild(host);
  }
  return { ok: true, count };
}`;

const CLEAN_ANNOTATE_JS = `() => { const visit = (doc) => { if (!doc) return; doc.getElementById("__chrome_for_ai_marks__")?.remove(); for (const frame of doc.querySelectorAll("iframe,frame")) try { visit(frame.contentDocument); } catch {} }; visit(document); return { ok: true }; }`;

function domReadSource(maxChars) {
  return `() => {
    const source = document.querySelector("main,article,[role='main']") || document.body;
    if (!source) return { source: "dom", url: location.href, title: document.title, content: "", truncated: false };
    const root = source.cloneNode(true), clean = (text) => (text || "").replace(/[ \\t]+/g, " ").replace(/\\n{3,}/g, "\\n\\n").trim();
    root.querySelectorAll("script,style,noscript,svg,canvas,nav,footer,header,form,button,[hidden],[aria-hidden='true'],#__chrome_for_ai_marks__").forEach((el) => el.remove());
    const inline = (el) => { const clone = el.cloneNode(true); for (const a of clone.querySelectorAll("a[href]")) { const label = clean(a.textContent), href = a.getAttribute("href"); if (label && href) a.replaceWith("[" + label + "](" + href + ")"); } return clean(clone.textContent); };
    const blocks = [];
    for (const el of root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table")) {
      if (el.tagName === "P" && el.closest("li,blockquote")) continue;
      const tag = el.tagName.toLowerCase(); let out = "";
      if (/^h[1-6]$/.test(tag)) out = "#".repeat(Number(tag[1])) + " " + inline(el);
      else if (tag === "li") out = "- " + inline(el);
      else if (tag === "blockquote") out = inline(el).split("\\n").map((line) => "> " + line).join("\\n");
      else if (tag === "pre") out = "\`\`\`\\n" + (el.textContent || "").trim() + "\\n\`\`\`";
      else if (tag === "table") {
        const rows = [...el.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((cell) => clean(cell.textContent).replace(/\\|/g, "\\\\|")));
        if (rows.length) { const width = Math.max(...rows.map((row) => row.length)), padded = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]); out = "| " + padded[0].join(" | ") + " |\\n| " + Array(width).fill("---").join(" | ") + " |" + padded.slice(1).map((row) => "\\n| " + row.join(" | ") + " |").join(""); }
      } else out = inline(el);
      if (out) blocks.push(out);
    }
    let content = blocks.join("\\n\\n") || clean(root.textContent), truncated = content.length > ${JSON.stringify(maxChars)};
    if (truncated) content = content.slice(0, ${JSON.stringify(maxChars)}) + "\\n\\n[truncated]";
    return { source: "dom", url: location.href, title: document.title, content, truncated };
  }`;
}

const objectSchema = (properties = {}, required = []) => ({ type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false });
const refProperty = { type: "string", pattern: "^@?e[1-9][0-9]*$", description: "Ref returned by browser_snapshot_refs, for example @e1." };

export const EXTRA_TOOLS = [
  { name: "stealth_status", description: "Show the official Playwright MCP and Patchright runtime, Chrome profile, proxy, and attach configuration.", inputSchema: objectSchema() },
  { name: "stealth_audit", description: "Evaluate the current page for common JavaScript automation fingerprints and return a compact report.", inputSchema: objectSchema() },
  { name: "stealth_check", description: "Open a public bot-detector page and return a compact report.", inputSchema: objectSchema({ url: { type: "string", description: "Detector URL." } }) },
  { name: "captcha_detect", description: "Detect common captcha and bot-challenge widgets without attempting to solve them.", inputSchema: objectSchema() },
  { name: "challenge_wait", description: "Poll until a Cloudflare-style passive interstitial disappears or timeout expires.", inputSchema: objectSchema({ timeoutMs: { type: "number", minimum: 0, maximum: 120000 }, intervalMs: { type: "number", minimum: 100, maximum: 10000 } }) },
  { name: "human_wait", description: "Sleep for a bounded human-like random delay so navigation or passive challenges can settle.", inputSchema: objectSchema({ minMs: { type: "number", minimum: 0, maximum: 60000 }, maxMs: { type: "number", minimum: 0, maximum: 60000 } }) },
  { name: "human_scroll", description: "Smooth-scroll the current page by a bounded pixel delta through browser evaluation.", inputSchema: objectSchema({ dy: { type: "number", minimum: -100000, maximum: 100000 }, dx: { type: "number", minimum: -100000, maximum: 100000 } }) },
  { name: "browser_snapshot_refs", description: "Return compact viewport-only interactive elements and assign temporary @e1-style refs.", inputSchema: objectSchema({ maxElements: { type: "integer", minimum: 1, maximum: 500 } }) },
  { name: "browser_click_ref", description: "Click an @e ref after checking whether an unrelated overlay would intercept the click.", inputSchema: objectSchema({ ref: refProperty }, ["ref"]) },
  { name: "browser_fill_ref", description: "Fill an input, textarea, or contenteditable element by @e ref and fire input events.", inputSchema: objectSchema({ ref: refProperty, text: { type: "string", maxLength: 10000 } }, ["ref", "text"]) },
  { name: "browser_smart_read", description: "Read compact Markdown, preferring negotiated Markdown or nearby llms.txt before rendered DOM extraction.", inputSchema: objectSchema({ url: { type: "string" }, preferLlms: { type: "boolean" }, maxChars: { type: "integer", minimum: 1000, maximum: 200000 }, timeoutMs: { type: "integer", minimum: 1000, maximum: 60000 } }) },
  { name: "browser_annotated_screenshot", description: "Take a viewport screenshot with temporary @e ref boxes, then remove every overlay.", inputSchema: objectSchema({ filename: { type: "string" }, maxElements: { type: "integer", minimum: 1, maximum: 500 }, scale: { type: "string", enum: ["css", "device"] } }) },
  { name: "browser_record_step", description: "Append one replayable browser step to an in-memory session-local named flow.", inputSchema: objectSchema({ flow: { type: "string", pattern: "^[A-Za-z0-9._-]{1,64}$" }, action: { type: "string", enum: ["navigate", "snapshot", "click", "fill", "wait", "scroll"] }, url: { type: "string" }, ref: refProperty, text: { type: "string", maxLength: 10000 }, ms: { type: "integer", minimum: 0, maximum: 120000 }, dx: { type: "number", minimum: -100000, maximum: 100000 }, dy: { type: "number", minimum: -100000, maximum: 100000 }, refreshRefs: { type: "boolean" }, reset: { type: "boolean" } }, ["flow", "action"]) },
  { name: "browser_replay_flow", description: "Replay a named in-memory flow without LLM reasoning between individual steps.", inputSchema: objectSchema({ flow: { type: "string", pattern: "^[A-Za-z0-9._-]{1,64}$" }, continueOnError: { type: "boolean" } }, ["flow"]) },
];

export const EXTRA_NAMES = new Set(EXTRA_TOOLS.map((tool) => tool.name));
export const createToolState = () => ({ flows: new Map() });

const textResult = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
const jitter = (a, b) => { const min = clamp(a, 0, 0, 60000), max = clamp(b, min, min, 60000); return min + Math.floor(Math.random() * (max - min + 1)); };

export function normalizeRef(value) {
  const raw = String(value || "").trim(), ref = raw.startsWith("@") ? raw : `@${raw}`;
  if (!/^@e[1-9][0-9]*$/.test(ref)) throw new Error(`Invalid ref: ${raw || "(empty)"}`);
  return ref;
}

function httpUrl(value) {
  const url = new URL(String(value));
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http(s) URLs are supported.");
  url.hash = "";
  return url;
}

export function smartReadCandidates(value) {
  const target = httpUrl(value), output = [target.href];
  if (!/\.(md|markdown|txt)$/i.test(target.pathname)) { const md = new URL(target); md.pathname = target.pathname.endsWith("/") ? target.pathname + "index.md" : target.pathname + ".md"; output.push(md.href); }
  const parts = target.pathname.split("/").filter(Boolean);
  if (parts.length && !target.pathname.endsWith("/")) parts.pop();
  for (let i = parts.length; i >= 0; i--) { const llms = new URL(target.origin); llms.pathname = `/${parts.slice(0, i).join("/")}${i ? "/" : ""}llms.txt`; output.push(llms.href); }
  return [...new Set(output)];
}

async function evaluate(client, fn) {
  if (!client) throw new Error("This tool requires an active browser client.");
  return client.callTool({ name: "browser_evaluate", arguments: { function: fn } });
}

export function parseEvaluatePayload(result) {
  const raw = result?.content?.map((part) => part.text).filter(Boolean).join("\n") || "", attempts = [raw];
  const resultSection = raw.match(/### Result\s*\n([\s\S]*?)(?=\n### |$)/i)?.[1]; if (resultSection) attempts.push(resultSection);
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]; if (fenced) attempts.push(fenced);
  for (const [start, end] of [["{", "}"], ["[", "]"]]) { const a = raw.indexOf(start), b = raw.lastIndexOf(end); if (a >= 0 && b > a) attempts.push(raw.slice(a, b + 1)); }
  for (const candidate of attempts) try { return JSON.parse(candidate.trim()); } catch {}
  return { raw };
}

async function readLimited(response) {
  if (Number(response.headers.get("content-length") || 0) > MAX_READ_BYTES) throw new Error("Response too large.");
  const reader = response.body?.getReader?.();
  if (!reader) return (await response.text()).slice(0, MAX_READ_BYTES);
  const decoder = new TextDecoder(); let bytes = 0, output = "";
  while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > MAX_READ_BYTES) { await reader.cancel(); throw new Error("Response too large."); } output += decoder.decode(value, { stream: true }); }
  return output + decoder.decode();
}

async function fetchReadable(url, timeoutMs, maxChars) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { accept: "text/markdown, text/plain;q=0.9, text/html;q=0.5, */*;q=0.1", "user-agent": "chrome-for-ai/1.1 smart-read" } });
    if (!response.ok) return null;
    const finalUrl = httpUrl(response.url || url).href, type = (response.headers.get("content-type") || "").toLowerCase();
    if (!/markdown|text\/plain/.test(type) && !/\.(md|markdown|txt)(?:$|\?)/i.test(finalUrl)) { await response.body?.cancel?.(); return null; }
    let content = await readLimited(response), truncated = content.length > maxChars;
    if (truncated) content = content.slice(0, maxChars) + "\n\n[truncated]";
    return { source: finalUrl.endsWith("llms.txt") ? "llms.txt" : "markdown", url: finalUrl, contentType: type, content, truncated };
  } finally { clearTimeout(timer); }
}

function flowStep(args) {
  const step = { action: args.action, refreshRefs: args.refreshRefs !== false };
  if (args.action === "navigate") step.url = httpUrl(args.url).href;
  else if (args.action === "click") step.ref = normalizeRef(args.ref);
  else if (args.action === "fill") { step.ref = normalizeRef(args.ref); step.text = String(args.text ?? "").slice(0, 10000); }
  else if (args.action === "wait") step.ms = Math.round(clamp(args.ms, 500, 0, 120000));
  else if (args.action === "scroll") { step.dx = clamp(args.dx, 0, -100000, 100000); step.dy = clamp(args.dy, 600, -100000, 100000); }
  else if (args.action !== "snapshot") throw new Error(`Unsupported flow action: ${args.action}`);
  return step;
}

async function replayStep(step, client, state) {
  if (step.action === "navigate") return client.callTool({ name: "browser_navigate", arguments: { url: step.url } });
  if (step.action === "snapshot") return runExtraTool("browser_snapshot_refs", {}, client, state);
  if (step.action === "wait") { await sleep(step.ms); return textResult({ ok: true, waitedMs: step.ms }); }
  if (step.action === "scroll") return runExtraTool("human_scroll", step, client, state);
  if (step.refreshRefs) await runExtraTool("browser_snapshot_refs", {}, client, state);
  return runExtraTool(step.action === "click" ? "browser_click_ref" : "browser_fill_ref", step, client, state);
}

export async function runExtraTool(name, args = {}, client, state = createToolState()) {
  switch (name) {
    case "stealth_status": return textResult({ ok: true, ...engineInfo(), extras: [...EXTRA_NAMES], official: "All @playwright/mcp tools are also available.", antiBot: "Patchright + real Chrome + persistent profile. Interactive captchas still need a human." });
    case "stealth_audit": {
      const data = parseEvaluatePayload(await evaluate(client, AUDIT_JS)), flags = [];
      if (data.webdriver) flags.push("navigator.webdriver=true");
      if (data.webdriverType !== "undefined" && data.webdriver !== false) flags.push(`webdriver type=${data.webdriverType}`);
      if (!data.chromeRuntime) flags.push("window.chrome.runtime missing");
      if (!data.plugins) flags.push("plugins=0");
      return textResult({ summary: flags.length ? `possible tells: ${flags.join("; ")}` : "no obvious JS automation tells", flags, data });
    }
    case "stealth_check": {
      const url = httpUrl(args.url || "https://bot.sannysoft.com/").href;
      await client.callTool({ name: "browser_navigate", arguments: { url } }); await sleep(2500);
      return textResult({ url, report: parseEvaluatePayload(await evaluate(client, SANNYSOFT_JS)) });
    }
    case "captcha_detect": return textResult(parseEvaluatePayload(await evaluate(client, CAPTCHA_JS)));
    case "challenge_wait": {
      const timeoutMs = clamp(args.timeoutMs, 30000, 0, 120000), intervalMs = clamp(args.intervalMs, 750, 100, 10000), started = Date.now(); let last = null;
      while (Date.now() - started < timeoutMs) { last = parseEvaluatePayload(await evaluate(client, CHALLENGE_JS)); if (last?.blocked === false) return textResult({ ok: true, waitedMs: Date.now() - started, last }); await sleep(intervalMs); }
      return textResult({ ok: false, timedOut: true, waitedMs: Date.now() - started, last });
    }
    case "human_wait": { const ms = jitter(args.minMs ?? 400, args.maxMs ?? 1400); await sleep(ms); return textResult({ ok: true, waitedMs: ms }); }
    case "human_scroll": {
      const dy = clamp(args.dy, 600, -100000, 100000), dx = clamp(args.dx, 0, -100000, 100000);
      return textResult(parseEvaluatePayload(await evaluate(client, `() => { window.scrollBy({ top: ${JSON.stringify(dy)}, left: ${JSON.stringify(dx)}, behavior: "smooth" }); return { ok: true, scrollX: window.scrollX, scrollY: window.scrollY }; }`)));
    }
    case "browser_snapshot_refs": return textResult(parseEvaluatePayload(await evaluate(client, snapshotSource(Math.round(clamp(args.maxElements, 150, 1, 500))))));
    case "browser_click_ref": return textResult(parseEvaluatePayload(await evaluate(client, clickSource(normalizeRef(args.ref)))));
    case "browser_fill_ref": return textResult(parseEvaluatePayload(await evaluate(client, fillSource(normalizeRef(args.ref), String(args.text ?? "").slice(0, 10000)))));
    case "browser_smart_read": {
      const maxChars = Math.round(clamp(args.maxChars, 30000, 1000, 200000)), timeoutMs = Math.round(clamp(args.timeoutMs, 10000, 1000, 60000));
      let target = args.url ? httpUrl(args.url).href : null;
      if (!target) target = httpUrl(parseEvaluatePayload(await evaluate(client, `() => ({ url: location.href })`)).url).href;
      const fetchErrors = [];
      if (args.preferLlms !== false) for (const candidate of smartReadCandidates(target)) try { const found = await fetchReadable(candidate, timeoutMs, maxChars); if (found) return textResult({ ok: true, ...found }); } catch (error) { fetchErrors.push({ url: candidate, error: String(error.message || error) }); }
      if (args.url) await client.callTool({ name: "browser_navigate", arguments: { url: target } });
      return textResult({ ok: true, ...parseEvaluatePayload(await evaluate(client, domReadSource(maxChars))), ...(fetchErrors.length ? { fetchErrors: fetchErrors.slice(0, 3) } : {}) });
    }
    case "browser_annotated_screenshot": {
      await runExtraTool("browser_snapshot_refs", { maxElements: args.maxElements }, client, state);
      const annotation = parseEvaluatePayload(await evaluate(client, ANNOTATE_JS));
      try {
        const shot = await client.callTool({ name: "browser_take_screenshot", arguments: { type: "png", ...(args.filename ? { filename: args.filename } : {}), scale: args.scale || "css", fullPage: false } });
        return { ...shot, content: [{ type: "text", text: JSON.stringify({ annotated: annotation.count || 0 }) }, ...(shot.content || [])] };
      } finally { await evaluate(client, CLEAN_ANNOTATE_JS).catch(() => {}); }
    }
    case "browser_record_step": {
      const flow = String(args.flow || "");
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(flow)) throw new Error("Invalid flow name.");
      if (!state.flows.has(flow) && state.flows.size >= MAX_FLOWS) throw new Error(`At most ${MAX_FLOWS} flows are allowed.`);
      if (args.reset) state.flows.set(flow, []);
      const steps = state.flows.get(flow) || [];
      if (steps.length >= MAX_STEPS) throw new Error(`Flow already has ${MAX_STEPS} steps.`);
      const step = flowStep(args); steps.push(step); state.flows.set(flow, steps);
      return textResult({ ok: true, flow, stepNumber: steps.length, step: { ...step, ...(step.action === "fill" ? { text: `[${step.text.length} chars kept in memory]` } : {}) }, note: "Session-local; not persisted." });
    }
    case "browser_replay_flow": {
      const flow = String(args.flow || ""), steps = state.flows.get(flow);
      if (!steps?.length) return textResult({ ok: false, error: `Unknown or empty flow: ${flow}` });
      const reports = [];
      for (let index = 0; index < steps.length; index++) try {
        const result = await replayStep(steps[index], client, state), payload = parseEvaluatePayload(result);
        const ok = result?.isError !== true && payload.ok !== false && !payload.error && !["missing","obstructed","disabled","unsupported"].includes(payload.status);
        reports.push({ step: index + 1, action: steps[index].action, ok, result: JSON.stringify(payload).slice(0, 600) });
        if (!ok && !args.continueOnError) break;
      } catch (error) { reports.push({ step: index + 1, action: steps[index].action, ok: false, error: String(error.message || error) }); if (!args.continueOnError) break; }
      return textResult({ ok: reports.length === steps.length && reports.every((report) => report.ok), flow, completed: reports.filter((report) => report.ok).length, total: steps.length, reports });
    }
    default: return textResult({ error: `unknown extra tool: ${name}` });
  }
}
