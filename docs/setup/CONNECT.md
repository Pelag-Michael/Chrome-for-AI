# Kết nối Chrome for AI với các agent

MCP này nói **stdio**. Mọi client chỉ cần spawn:

```text
node <REPO>/src/index.mjs
```

`<REPO>` = thư mục sau khi `git clone` + `npm install`.

## 0. Cài một lần

Yêu cầu: Node.js 18+, Google Chrome.

```bash
git clone https://github.com/Pelag-Michael/Chrome-for-AI.git
cd Chrome-for-AI
npm install
npm test
node scripts/doctor.mjs
```

Windows (PowerShell), lấy path tuyệt đối:

```powershell
(Resolve-Path .\src\index.mjs).Path
```

Dùng path đó trong mọi config bên dưới. Ví dụ:

```text
C:\Users\you\Chrome-for-AI\src\index.mjs
```

macOS / Linux:

```text
/Users/you/Chrome-for-AI/src/index.mjs
```

Khối JSON chuẩn (copy rồi sửa path):

```json
{
  "mcpServers": {
    "chrome-for-ai": {
      "command": "node",
      "args": ["/ABS/PATH/Chrome-for-AI/src/index.mjs"]
    }
  }
}
```

Windows JSON phải escape backslash, hoặc dùng `/`:

```json
"args": ["C:/Users/you/Chrome-for-AI/src/index.mjs"]
```

Sau khi gắn, **restart agent** (hoặc refresh MCP). Thử prompt:

```text
Call stealth_status, then open https://example.com and run stealth_audit.
```

Phải thấy 77 tools: 63 official + 14 extra, gồm `browser_*`, `stealth_*`, `captcha_detect`, `challenge_wait`, và `human_*`.

---

## Grok (Grok Build / grok CLI)

Cách nhanh:

```bash
cd Chrome-for-AI
node scripts/install-grok.mjs
```

Hoặc tay — `~/.grok/config.toml`:

```toml
[mcp_servers.chrome-for-ai]
command = "node"
args = ["C:/Users/you/Chrome-for-AI/src/index.mjs"]
startup_timeout_sec = 90
tool_timeout_sec = 180
enabled = true
```

CLI:

```bash
grok mcp add chrome-for-ai -- node C:/Users/you/Chrome-for-AI/src/index.mjs
```

Rồi tăng timeout trong `config.toml` như trên. Trong TUI: `/mcps` → `r`. Kiểm tra:

```bash
grok mcp doctor chrome-for-ai
```

Kỳ vọng: `handshake OK`, `77 tools discovered`.

---

## Google Antigravity

File global: `~/.gemini/config/mcp_config.json`  
File workspace: `.agents/mcp_config.json`

UI: Settings → Customizations → **Open MCP Config** / **Manage MCP Servers** → **View raw config**.

```json
{
  "mcpServers": {
    "chrome-for-ai": {
      "command": "node",
      "args": ["/ABS/PATH/Chrome-for-AI/src/index.mjs"]
    }
  }
}
```

Antigravity CLI (nếu dùng file riêng): vẫn là `mcpServers` + `command`/`args`. Remote HTTP dùng `serverUrl` — **không** áp dụng server này (stdio local).

Restart Antigravity sau khi lưu.

---

## OpenAI Codex

CLI:

```bash
codex mcp add chrome-for-ai -- node /ABS/PATH/Chrome-for-AI/src/index.mjs
```

Hoặc `~/.codex/config.toml`:

```toml
[mcp_servers.chrome-for-ai]
command = "node"
args = ["/ABS/PATH/Chrome-for-AI/src/index.mjs"]
```

Windows 11 nếu `npx`/spawn lỗi PATH, bọc `cmd`:

```toml
[mcp_servers.chrome-for-ai]
command = "cmd"
args = ["/c", "node", "C:\\Users\\you\\Chrome-for-AI\\src\\index.mjs"]
startup_timeout_ms = 90000
```

---

## Claude Code

```bash
claude mcp add chrome-for-ai --scope user -- node /ABS/PATH/Chrome-for-AI/src/index.mjs
```

---

## Claude Desktop

Sửa MCP config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "chrome-for-ai": {
      "command": "node",
      "args": ["/ABS/PATH/Chrome-for-AI/src/index.mjs"]
    }
  }
}
```

Restart Claude Desktop.

---

## Cursor

Settings → MCP → Add new MCP Server.

Hoặc `~/.cursor/mcp.json` / `<project>/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "chrome-for-ai": {
      "command": "node",
      "args": ["/ABS/PATH/Chrome-for-AI/src/index.mjs"]
    }
  }
}
```

---

## VS Code / GitHub Copilot

Command Palette → MCP: Open User Configuration, hoặc:

```bash
code --add-mcp "{\"name\":\"chrome-for-ai\",\"command\":\"node\",\"args\":[\"/ABS/PATH/Chrome-for-AI/src/index.mjs\"]}"
```

`mcp.json`:

```json
{
  "servers": {
    "chrome-for-ai": {
      "command": "node",
      "args": ["/ABS/PATH/Chrome-for-AI/src/index.mjs"]
    }
  }
}
```

Copilot CLI (`~/.copilot/mcp-config.json`):

```json
{
  "mcpServers": {
    "chrome-for-ai": {
      "type": "local",
      "command": "node",
      "tools": ["*"],
      "args": ["/ABS/PATH/Chrome-for-AI/src/index.mjs"]
    }
  }
}
```

---

## Gemini CLI

```bash
gemini mcp add -s user chrome-for-ai node /ABS/PATH/Chrome-for-AI/src/index.mjs
```

Hoặc settings JSON cùng schema `mcpServers` ở trên.

---

## Windsurf

Làm theo docs Windsurf Cascade MCP. Dán khối `mcpServers` chuẩn.

---

## Cline

`cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "chrome-for-ai": {
      "type": "stdio",
      "command": "node",
      "args": ["/ABS/PATH/Chrome-for-AI/src/index.mjs"],
      "timeout": 90,
      "disabled": false
    }
  }
}
```

---

## Amp

```bash
amp mcp add chrome-for-ai -- node /ABS/PATH/Chrome-for-AI/src/index.mjs
```

Hoặc `amp.mcpServers` trong settings.json — cùng `command` / `args`.

---

## Factory (droid)

```bash
droid mcp add chrome-for-ai "node /ABS/PATH/Chrome-for-AI/src/index.mjs"
```

---

## OpenCode

`~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "chrome-for-ai": {
      "type": "local",
      "command": ["node", "/ABS/PATH/Chrome-for-AI/src/index.mjs"],
      "enabled": true
    }
  }
}
```

---

## Warp

Settings → AI → Manage MCP Servers → Add. Dán khối `mcpServers` chuẩn.

---

## LM Studio / Goose / Junie / Kiro / Qodo

Cùng pattern stdio: **command = `node`**, **args = path tới `src/index.mjs`**.

Goose: Advanced settings → Extensions → Add custom extension → type STDIO.

JetBrains Junie: Settings → Tools → Junie → MCP Settings → Add.

---

## Env dùng chung

Có thể gắn vào field `env` của client (nếu client hỗ trợ) hoặc set ở user/system.

| Biến | Việc |
|---|---|
| `CHROME_FOR_AI_PROFILE` hoặc `GROK_BROWSER_PROFILE` | Thư mục user-data Chrome |
| `CHROME_FOR_AI_HEADLESS=1` hoặc `GROK_BROWSER_HEADLESS=1` | Ẩn cửa sổ (khó giải captcha) |
| `CHROME_FOR_AI_CHROME` hoặc `GROK_BROWSER_CHROME` | Đường dẫn chrome.exe / Google Chrome |
| `CHROME_FOR_AI_PROXY` hoặc `GROK_BROWSER_PROXY` | `http://user:pass@host:port` |
| `CHROME_FOR_AI_CDP` hoặc `GROK_BROWSER_CDP` | Gắn Chrome đang mở (`ws://127.0.0.1:9222/...`) |
| `CHROME_FOR_AI_EXTENSION=1` | Playwright MCP extension (tab đang login) |
| `CHROME_FOR_AI_CAPS` | Ví dụ `core,pdf,vision,devtools,storage,network` |

Ví dụ Cursor:

```json
{
  "mcpServers": {
    "chrome-for-ai": {
      "command": "node",
      "args": ["/ABS/PATH/Chrome-for-AI/src/index.mjs"],
      "env": {
        "CHROME_FOR_AI_PROXY": "http://127.0.0.1:7890"
      }
    }
  }
}
```

---

## Hai agent cùng lúc

Profile bền **chỉ một process Chrome** dùng được. Client thứ hai: `--isolated` qua `CHROME_FOR_AI_ISOLATED=1` / `GROK_BROWSER_ISOLATED=1`, hoặc `CHROME_FOR_AI_PROFILE` khác.

---

## Lỗi thường gặp

| Hiện tượng | Cách xử |
|---|---|
| Handshake timeout | Tăng startup timeout (Grok: `startup_timeout_sec = 90`). Lần đầu `npm`/Chrome chậm. |
| 0 tools | Sai path `src/index.mjs`. Chạy `node src/index.mjs` tay — phải im stdout, log ở stderr. |
| `playwright` không phải patchright | Chạy trong đúng repo sau `npm install`. `node scripts/doctor.mjs`. |
| Không tìm thấy Chrome | Cài Google Chrome. Hoặc set `CHROME_FOR_AI_CHROME`. |
| Bị Cloudflare chặn | Headed (đừng headless). Đợi `challenge_wait`. Interactive captcha: giải trên cửa sổ. |
| Hai client tranh profile | Tách `CHROME_FOR_AI_PROFILE` hoặc bật isolated. |

Không dùng `npx @playwright/mcp@latest` thay server này — đó là official **không** Patchright.
