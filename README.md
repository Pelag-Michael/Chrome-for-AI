# Chrome for AI

MCP server: AI agents drive **real Google Chrome** — click, type, tabs, cookies — with **Patchright** under official Microsoft Playwright MCP so the CDP handshake is less obvious to bot detection.

Not a fork of [`microsoft/playwright-mcp`](https://github.com/microsoft/playwright-mcp). Same official tools (~63 `browser_*`). Extra stealth/captcha helpers on top.

**Docs:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [CONNECT.md](./CONNECT.md) (Grok, Antigravity, Codex, Claude, Cursor, VS Code, Gemini, …)

---

## Tiếng Việt — đã làm được gì

Agent gắn MCP này có thể:

- Mở trang, click, gõ, điền form, hover, kéo thả, upload, dialog, back, tab
- Đọc accessibility snapshot (không bắt buộc model vision)
- Cookie / localStorage, screenshot, PDF, chạy JS, xem network
- Giữ login giữa các phiên (Chrome profile bền)
- Audit fingerprint (`stealth_audit`), mở bot.sannysoft.com (`stealth_check`)
- Nhận diện captcha / Cloudflare IUAM; đợi challenge JS thụ động tự hết
- Proxy, gắn Chrome đang mở (CDP), headed mặc định

**Chưa / không làm:** giải reCAPTCHA/hCaptcha tương tác, farm token, anti-detect 100%, giả IP (cần proxy).

Grok đã `mcp doctor` handshake OK, **70 tools**.

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
