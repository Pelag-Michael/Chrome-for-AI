# Chrome for AI

MCP server: AI agents drive **real Google Chrome** — click, type, tabs, cookies — with **Patchright** under official Microsoft Playwright MCP so the CDP handshake is less obvious to bot detection.

Not a fork of [`microsoft/playwright-mcp`](https://github.com/microsoft/playwright-mcp). Same official tools (~63 `browser_*`). Extra stealth/captcha helpers on top.

**Docs:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [CONNECT.md](./CONNECT.md) (Grok, Antigravity, Codex, Claude, Cursor, VS Code, Gemini, …)

---

## Capabilities

An agent connected to this MCP can:

- Open pages, click, type, fill forms, hover, drag & drop, upload files, handle dialogs, navigate back, and manage tabs
- Read accessibility snapshots (vision model not required)
- Manage cookies / localStorage, take screenshots, export PDFs, execute JS, and inspect network traffic
- Persist logins across sessions (persistent Chrome profile)
- Audit browser fingerprint (`stealth_audit`), open bot.sannysoft.com (`stealth_check`)
- Detect CAPTCHAs / Cloudflare IUAM; automatically wait for passive JS challenges to resolve
- Support proxies, attach to an existing running Chrome instance (CDP), headed mode by default

**Not supported / Out of scope:** Solving interactive reCAPTCHA/hCaptcha, token farming, 100% anti-detect guarantee, IP spoofing (requires proxy).

Grok `mcp doctor` handshake verified, **70 tools**.

---

## Install

```bash
git clone https://github.com/Pelag-Michael/Chrome-for-AI.git
cd Chrome-for-AI
npm install
npm test
node scripts/doctor.mjs
```

Then point any MCP client at `node /ABS/PATH/Chrome-for-AI/src/index.mjs`. Full recipes: [CONNECT.md](./CONNECT.md).

Grok shortcut:

```bash
node scripts/install-grok.mjs
grok mcp doctor chrome-for-ai   # or grok-browser if you used the older name
```

## Stack

| Layer | Package | Role |
|---|---|---|
| Official tools | `@playwright/mcp@0.0.78` | Navigate, click, type, snapshot, PDF, vision, storage |
| Stealth engine | `patchright@1.62.1` (npm alias) | Patch `Runtime.enable`, automation flags, `webdriver` |
| Browser | system Google Chrome | Not bundled Chromium |
| Profile | `~/.chrome-for-ai/profile` | Cookies persist |

Do **not** add a fake User-Agent or a heavy fingerprint init-script. Patchright’s own rule: real Chrome, no injection.

Interactive captchas still need a human in the headed window. This MCP detects them; it does not solve them.

## Extra tools

`stealth_status` · `stealth_audit` · `stealth_check` · `captcha_detect` · `challenge_wait` · `human_wait` · `human_scroll`

## License

Apache-2.0. Playwright MCP is Microsoft (Apache-2.0). Patchright is Apache-2.0. This repo only wraps them.
