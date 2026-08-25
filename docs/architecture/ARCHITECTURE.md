# Kiến trúc — Chrome for AI

MCP điều khiển Chrome thật cho AI agent. **Không fork** Microsoft Playwright MCP. Official MCP vẫn là bề mặt điều khiển; stealth nằm ở tầng engine.

## Mục tiêu

1. Agent (Grok, Antigravity, Codex, Claude, Cursor, …) nói chuyện MCP chuẩn.
2. Toàn bộ tool official: navigate, click, gõ, form, snapshot, cookie, PDF, vision, network.
3. Chống phát hiện automation ở **CDP**, không chỉ vá JavaScript trên trang.
4. Dùng Google Chrome cài sẵn + profile bền, cookie/login giữ lại.

## Sơ đồ

```
AI agent (Grok / Antigravity / Codex / Claude / Cursor / …)
        │  MCP stdio  (tools/list, tools/call)
        ▼
src/index.mjs
        │  StdioServerTransport
        ▼
src/wrap.mjs                    ← Server wrapper
        │
        ├─ extra tools ──────── stealth_status, stealth_audit,
        │                       stealth_check, captcha_detect,
        │                       challenge_wait, human_wait, human_scroll
        │
        └─ InMemoryTransport ─► official createConnection()
                                      │
                                      │  @playwright/mcp@0.0.78
                                      ▼
                              playwright / playwright-core
                              (npm alias → patchright 1.62.1)
                                      │
                                      ▼
                              Google Chrome (channel: chrome)
                              user-data-dir: ~/.chrome-for-ai/profile
```

## Các lớp

### 1. Agent client

Bất kỳ MCP client nào spawn process stdio:

```
node src/index.mjs
```

Không HTTP mặc định. Log chỉ ra **stderr** — stdout dành riêng cho JSON-RPC.

### 2. Wrapper (`src/wrap.mjs`)

`createConnection()` của official MCP đã trả về một MCP `Server` đủ bộ tool.

Wrapper:

1. Nối official server với một `Client` nội bộ qua `InMemoryTransport`.
2. Expose một `Server` mới ra stdio.
3. `tools/list` = 63 tool official + 14 extra.
4. `tools/call` extra thì `src/extra-tools.mjs` xử lý (thường gọi lại `browser_evaluate` / `browser_navigate` official). Tool còn lại forward nguyên xi.

Không copy-paste logic click/type. Khi Microsoft cập nhật tool, chỉ cần bump `@playwright/mcp` (pin tương thích Patchright).

### 3. Official Playwright MCP

Package: `@playwright/mcp@0.0.78`.

Entry thật nằm trong `playwright-core/lib/coreBundle` (`tools.createConnection`). Pin `0.0.78` vì nó đi với Playwright **1.62.x** — trùng Patchright `1.62.1`. `@playwright/mcp@0.0.79+` kéo Playwright `1.63-alpha`, lệch engine.

Capabilities mặc định: `core`, `pdf`, `vision`, `devtools`, `storage`, `network`.

### 4. Stealth runtime (Patchright)

`package.json`:

```json
"playwright": "npm:patchright@1.62.1",
"playwright-core": "npm:patchright-core@1.62.1",
"overrides": {
  "playwright": "npm:patchright@1.62.1",
  "playwright-core": "npm:patchright-core@1.62.1"
}
```

Official MCP `require("playwright")` mà không biết mình đang chạy Patchright.

Patchright vá:

| Rò rỉ | Cách xử lý |
|---|---|
| `Runtime.enable` | Không bật Runtime domain trên mọi frame; eval trong isolated context |
| `Console.enable` | Tắt Console API phía driver |
| Cờ Chrome | Bỏ `--enable-automation`, thêm `--disable-blink-features=AutomationControlled` |
| `navigator.webdriver` | Không còn bị set bởi automation flags |

**Không** inject User-Agent giả hay script fingerprint nặng. Patchright + Chrome thật: giả fingerprint làm *dễ bị bắt hơn*.

### 5. Chrome + profile (`src/config.mjs`)

- `channel: "chrome"` (+ `executablePath` nếu tìm thấy `chrome.exe` trên Windows).
- Headed mặc định (`GROK_BROWSER_HEADLESS` / `CHROME_FOR_AI_HEADLESS` không bật) — cần cửa sổ để giải captcha tương tác.
- `viewport: null` — kích thước cửa sổ thật, không viewport giả.
- Profile bền: `~/.chrome-for-ai/profile` (đổi bằng env).
- Optional: `CHROME_FOR_AI_CDP` / `GROK_BROWSER_CDP` gắn Chrome đang mở; `*_EXTENSION=1` dùng Playwright browser extension.

## Extra tools

| Tool | Việc |
|---|---|
| `stealth_status` | Engine, profile, proxy, CDP — không cần page |
| `stealth_audit` | Đọc `webdriver`, `chrome.*`, plugins, WebGL trên trang hiện tại |
| `stealth_check` | Mở bot.sannysoft.com (hoặc URL khác) và tóm tắt |
| `captcha_detect` | reCAPTCHA, hCaptcha, Turnstile, FunCaptcha, GeeTest, Cloudflare IUAM, DataDome, PerimeterX |
| `challenge_wait` | Poll đến khi interstitial Cloudflare biến |
| `human_wait` | Delay ngẫu nhiên |
| `human_scroll` | `scrollBy` smooth |
| `browser_snapshot_refs` | Lọc phần tử tương tác trong viewport, gán ref tạm `@e1` |
| `browser_click_ref` | Click theo ref và hit-test overlay/banner che |
| `browser_fill_ref` | Fill input/textarea/contenteditable theo ref |
| `browser_smart_read` | Ưu tiên Markdown/`llms.txt`, fallback DOM → Markdown |
| `browser_annotated_screenshot` | Screenshot viewport với hộp và nhãn Set-of-Marks |
| `browser_record_step` | Ghi bước vào flow trong RAM của MCP session |
| `browser_replay_flow` | Replay flow; tự refresh refs trước click/fill |

Extra tools **không** giải captcha tương tác, không farm token. Challenge JS thụ động thường tự qua nhờ Patchright.

## Việc làm được / không làm được

### Làm được

- Điều khiển full Chrome: mở URL, click, gõ, fill form, hover, drag, dialog, upload, tab, back.
- Accessibility snapshot (không cần model vision cho phần lớn tương tác).
- Click theo tọa độ nếu bật `vision`.
- Cookie / localStorage (`storage`).
- PDF, screenshot, evaluate JS, network list.
- Giữ login giữa các phiên (profile bền).
- Proxy, attach CDP, headed/headless.
- Giảm mạnh tín hiệu automation so với Playwright MCP trần.
- Detect captcha / đợi Cloudflare IUAM.
- Snapshot viewport gọn, click/fill theo ref và phát hiện vật cản.
- Smart read, screenshot có nhãn, record/replay flow không cần reasoning giữa từng bước.

### Không làm được (cố ý)

- Không phải anti-detect 100%. Fingerprint.com / bot mới vẫn có thể bắt.
- Không giải reCAPTCHA / hCaptcha / Turnstile tương tác.
- Không giả mobile TLS stack hay residential IP (cần proxy riêng).
- Không điều khiển Chrome profile đang mở của bạn trừ khi CDP / extension.
- `browser_evaluate` trên Patchright chạy isolated context — một số script trang chính cần lưu ý.
- Không thay Chrome DevTools MCP cho Lighthouse / heap snapshot sâu. Có thể gắn thêm DevTools MCP nếu cần debug, đừng dùng nó làm driver trên site chống bot.

## File

```
src/index.mjs          entry stdio
src/wrap.mjs           gộp official + extra
src/config.mjs         Chrome, profile, capabilities, env
src/extra-tools.mjs    14 tool stealth/captcha/token-efficient control
scripts/doctor.mjs     kiểm tra alias + Chrome + config
scripts/smoke.mjs      list tools + stealth_status in-process
scripts/live-smoke.mjs Chrome isolated: refs/click/fill/read/screenshot/replay
scripts/install-grok.mjs  ghi ~/.grok/config.toml
test/                  unit test không cần browser
```

## Tương thích version

```
@playwright/mcp  0.0.78
playwright-core  patchright-core@1.62.1
Node             >= 18 (đã test 25)
MCP protocol     2025-11-25
```

Bump official MCP: chỉ khi Patchright đã ship cùng minor Playwright. Sau đó `npm test` + `npm run smoke` + `npm run live-smoke` + `node scripts/doctor.mjs`.

## Bảo mật

Process MCP thấy mọi trang trong session Chrome mà nó mở. Profile chứa cookie. Đừng commit `~/.chrome-for-ai/profile`. Proxy URL có thể chứa password — để trong env, không check vào git.
