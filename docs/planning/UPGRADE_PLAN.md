# Kế Hoạch Nâng Cấp Toàn Diện "Chrome for AI" (grok-browser-mcp)

> **Trạng thái (2026-08-25): ĐÃ TRIỂN KHAI v1.1.0.** Bảy tool mới đã được
> thêm vào `src/extra-tools.mjs` và xác minh bằng unit test, MCP smoke test và
> live Chrome smoke test. Tài liệu này được giữ làm design/verification record.

Tài liệu này được thiết kế chi tiết để bất kỳ AI nào ở session mới có thể đọc, nắm bắt nguồn gốc kỹ thuật từ các repo mã nguồn mở và thực thi nâng cấp trực tiếp vào dự án `Chrome for AI` (`grok-browser-mcp`).

---

## 1. Mục Tiêu & Bối Cảnh (Goal Description)

### 1.1 Hiện trạng của Chrome for AI:
- **Repository gốc**: [https://github.com/Pelag-Michael/Chrome-for-AI](https://github.com/Pelag-Michael/Chrome-for-AI) (Local: `C:\Users\haivo\Documents\Agent antigrav\desktop shit\grok-browser-mcp`)
- Là một MCP server chuẩn (`StdioServerTransport`), bọc `@playwright/mcp` nhưng chạy trên lõi stealth **Patchright** và sử dụng **Google Chrome thật** (thay vì Chromium bundle).
- Giữ profile người dùng (`~/.chrome-for-ai/profile`), không bị Cloudflare / DataDome chặn cơ bản.
- Đã có 7 tool stealth/captcha: `stealth_status`, `stealth_audit`, `stealth_check`, `captcha_detect`, `challenge_wait`, `human_wait`, `human_scroll`.

### 1.2 Điểm nghẽn cần giải quyết:
1. **AI dễ bấm trượt / tốn token sinh selector:** AI phải tự mò selector CSS/XPath phức tạp hoặc tọa độ pixel, dễ lỗi khi DOM thay đổi hoặc bị iframe/shadow DOM cản trở.
2. **Context DOM quá lớn:** Gửi toàn bộ HTML/DOM làm ngốn hàng chục ngàn token mỗi lượt duyệt web.
3. **Kẹt khi gặp modal/banner che khuất:** AI click vào nút nhưng không ăn do bị Cookie Consent hoặc Pop-up che mà không biết lý do.
4. **Đọc tài liệu web cồng kềnh:** Đọc một trang tài liệu phải mở browser render đầy đủ thay vì lấy markdown trực tiếp hoặc `llms.txt`.

### 1.3 Mục tiêu nâng cấp:
Tích hợp các cơ chế tinh hoa từ các dự án mã nguồn mở hàng đầu thế giới mà không làm thay đổi kiến trúc Stealth Chrome cốt lõi:
- **`vercel-labs/agent-browser`**: Accessibility Element Ref IDs (`@e1`, `@e2`), Early Click Obstruction Check, Smart Read (`llms.txt` + Markdown extraction).
- **`browser-use/browser-use`**: Viewport DOM Pruning (giảm 85% token), Set-of-Marks Annotated Screenshot (vẽ nhãn số cho Vision Model).
- **`lightpanda-io/browser`**: Token-free Action Recording & Replay.

---

## 2. Danh Sách Đầy Đủ Các Repo Tham Khảo & Nguồn Kỹ Thuật (Sources & Repositories)

Dưới đây là toàn bộ link repository và giá trị kỹ thuật tương ứng:

| STT | Repository & Link GitHub | Vai trò & Giá trị kỹ thuật chắt lọc |
|---|---|---|
| 1 | [**Pelag-Michael/Chrome-for-AI**](https://github.com/Pelag-Michael/Chrome-for-AI)<br>*(Thư mục local: `grok-browser-mcp`)* | **Codebase nền tảng:** MCP Server wrapper, Patchright stealth CDP, quản lý Chrome profile bền, 7 công cụ audit fingerprint & captcha. |
| 2 | [**vercel-labs/agent-browser**](https://github.com/vercel-labs/agent-browser) | **Kỹ thuật chắt lọc:**<br>1. Accessibility Ref IDs (`@e1`, `@e2`) tương tác trực tiếp.<br>2. Early Obstruction Check (`document.elementFromPoint`) phát hiện banner/modal che khuất.<br>3. Smart Read tool tự động tìm `llms.txt` hoặc parse Markdown sạch. |
| 3 | [**browser-use/browser-use**](https://github.com/browser-use/browser-use) | **Kỹ thuật chắt lọc:**<br>1. Viewport-aware DOM Pruning (loại bỏ node vô hình, script, style, SVG rác $\to$ giảm 80-90% token).<br>2. Set-of-Marks (vẽ bounding box và nhãn số lên screenshot cho Vision Model). |
| 4 | [**lightpanda-io/browser**](https://github.com/lightpanda-io/browser) | **Kỹ thuật chắt lọc:**<br>1. Ý tưởng PandaScript: Ghi lại các bước tương tác thành script để replay không tốn token LLM.<br>*(Lưu ý: Không dùng engine Zig của Lightpanda để bảo toàn khả năng stealth của Chrome thật).* |
| 5 | [**pipecat-ai/pipecat**](https://github.com/pipecat-ai/pipecat) | **Kỹ thuật tham chiếu:** Cơ chế phân định SystemFrames / Control fast-path bypass để hủy tác vụ tức thời khi ngắt lời. |
| 6 | [**microsoft/playwright-mcp**](https://github.com/microsoft/playwright-mcp) | **Thư viện nền tảng:** Gói `@playwright/mcp@0.0.78` cung cấp các tool trình duyệt chuẩn của Microsoft. |
| 7 | [**Kaliiiiiiiiii-Vinyzu/patchright**](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright) | **Stealth engine:** Lõi vá CDP (`Runtime.enable`, `--disable-blink-features=AutomationControlled`, xóa `navigator.webdriver`). |
| 8 | [**ariya/phantomjs**](https://github.com/ariya/phantomjs) | **Tài liệu lịch sử:** Đã archived từ 2018; bài học không nên tự chế engine WebKit mà nên dùng Chrome thật. |

---

## 3. Kiến Trúc Các Tool Mới Sẽ Triển Khai

```
AI Agent (Grok / Claude / Codex / Antigravity)
       │  Gọi MCP Tool
       ▼
Chrome for AI MCP Server (src/extra-tools.mjs)
 ├─ 1. Tầng Tương Tác & Định Danh Ref (từ vercel-labs/agent-browser)
 │     ├─ browser_snapshot_refs (Lọc Viewport + Gán @e1, @e2)
 │     └─ browser_click_ref / browser_fill_ref (Thao tác qua @e1 + Check vật cản)
 │
 ├─ 2. Tầng Hỗ Trợ Vision (từ browser-use/browser-use)
 │     └─ browser_annotated_screenshot (Vẽ nhãn số Set-of-Marks lên ảnh)
 │
 ├─ 3. Tầng Đọc Nội Dung Tinh Gọn (từ vercel-labs/agent-browser)
 │     └─ browser_smart_read (Tự tìm llms.txt & parse Markdown sạch)
 │
 └─ 4. Tầng Tự Động Hóa Replay (từ lightpanda-io/browser & browser-use)
       └─ browser_record_step / browser_replay_flow (Chạy lại flow không tốn token)
       │
       ▼ (browser_evaluate / CDP)
Google Chrome Thật (Patchright Stealth CDP)
```

---

## 4. Chi Tiết Các Thay Đổi Mã Nguồn (Proposed Changes)

Vị trí làm việc: `C:\Users\haivo\Documents\Agent antigrav\desktop shit\grok-browser-mcp`

### 4.1 Cập nhật `src/extra-tools.mjs`

Thêm các đoạn mã JavaScript inject vào trình duyệt và định nghĩa 7 MCP tools mới:

1. **`SNAPSHOT_REFS_JS` (Thuật toán Viewport Pruning & Gán Ref ID từ `agent-browser` + `browser-use`)**:
   - Quét tất cả interactive elements (`button`, `a`, `input`, `textarea`, `select`, `[role=button]`, `[role=link]`, `[tabindex]`, `[onclick]`).
   - Kiểm tra `getBoundingClientRect()`: Bỏ qua element có `width === 0`, `height === 0`, hoặc nằm hoàn toàn ngoài viewport.
   - Gán thuộc tính DOM tạm thời: `el.setAttribute("data-ai-ref", "e" + index)`.
   - Trả về danh sách JSON tinh gọn:
     ```json
     [
       { "ref": "@e1", "tag": "button", "role": "button", "text": "Đăng nhập", "rect": { "x": 100, "y": 200, "w": 80, "h": 32 } },
       { "ref": "@e2", "tag": "input", "type": "email", "placeholder": "Email của bạn", "rect": { "x": 100, "y": 150, "w": 250, "h": 36 } }
     ]
     ```

2. **`CLICK_REF_JS` (Thực thi Click kèm Kiểm tra Vật Cản / Obstruction Detection từ `agent-browser`)**:
   - Tìm element theo `[data-ai-ref="eX"]`.
   - Tính tâm điểm: `cx = rect.left + rect.width / 2`, `cy = rect.top + rect.height / 2`.
   - Gọi `topEl = document.elementFromPoint(cx, cy)`.
   - Nếu `topEl !== el` và không phải là con của `el` $\to$ Cảnh báo ngay:
     `{ status: "obstructed", coveringElement: topEl.outerHTML.slice(0, 150), message: "Nút bị che bởi modal/banner. Hãy tắt banner trước." }`.
   - Nếu không bị che $\to$ Thực hiện `el.scrollIntoView({ block: 'center' })` và kích hoạt chuỗi sự kiện `pointerdown -> mousedown -> click`.

3. **`ANNOTATED_SCREENSHOT_JS` (Vẽ nhãn Set-of-Marks từ `browser-use`)**:
   - Tạo một container `<div id="__ai_mark_overlay__">` đặt cố định trên trang.
   - Với mỗi `@eX`, vẽ 1 hộp viền đỏ/cam mỏng và 1 nhãn số nhỏ (badge) ở góc trên bên trái.
   - Gọi chụp screenshot.
   - Xóa bỏ overlay ngay sau khi chụp để không làm bẩn DOM.

4. **`SMART_READ_JS` (Trích xuất Markdown / Tìm `llms.txt` từ `agent-browser`)**:
   - Nếu URL được truyền vào: thử fetch `URL/llms.txt` hoặc `URL.md`.
   - Nếu đọc trang hiện tại: clone `document.body`, loại bỏ `<script>`, `<style>`, `<nav>`, `<footer>`, `<svg>`, `<noscript>`, `<header>`, sau đó trích xuất các thẻ tiêu đề `h1-h6`, `p`, `li`, `table`, `pre/code` thành định dạng Markdown chuẩn.

5. **`FLOW_RECORDER` (Kịch bản Replay từ `lightpanda` & `browser-use`)**:
   - Lưu trữ mảng `recordedSteps: Array<{action, ref, text, url}>` trong bộ nhớ của server wrapper.
   - Tool `browser_record_step`: Thêm bước.
   - Tool `browser_replay_flow`: Chạy tuần tự các bước mà không cần chờ LLM reasoning.

---

### 4.2 Cập nhật danh sách Schema Tool trong `src/extra-tools.mjs`

Khai báo định nghĩa schema MCP chuẩn cho:
- `browser_snapshot_refs`: Trả về danh sách ref ID rút gọn các phần tử tương tác trên màn hình.
- `browser_click_ref`: Click bằng ref `@e1` kèm kiểm tra vật cản.
- `browser_fill_ref`: Điền form bằng ref `@e2` và chuỗi `text`.
- `browser_smart_read`: Đọc nội dung bài viết dạng Markdown sạch hoặc tìm `llms.txt`.
- `browser_annotated_screenshot`: Chụp ảnh màn hình có vẽ nhãn số `@e1`, `@e2`.
- `browser_replay_flow`: Thực thi lại flow kịch bản.

---

### 4.3 Cập nhật `README.md` và `docs/architecture/ARCHITECTURE.md` của Chrome for AI

Ghi rõ các tính năng mới, hướng dẫn sử dụng cho Agent và ghi nhận đầy đủ nguồn tham khảo từ các repo [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser), [browser-use/browser-use](https://github.com/browser-use/browser-use), [lightpanda-io/browser](https://github.com/lightpanda-io/browser).

---

## 5. Kế Hoạch Kiểm Thử (Verification Plan)

### 5.1 Kiểm thử tự động (Automated Unit Tests)
Chạy bộ test không cần mở trình duyệt thật trong `grok-browser-mcp/test/`:
```bash
npm test
```
- Bổ sung `test/refs.test.mjs`: Test logic parse ref ID, test định dạng Markdown, test validation schema của các extra tools mới.

### 5.2 Kiểm thử tích hợp (Smoke Test & Live Handshake)
```bash
node scripts/doctor.mjs
node scripts/smoke.mjs
npm run live-smoke
```
- `scripts/smoke.mjs` kiểm tra server khởi tạo thành công, danh sách tools xuất ra đầy đủ bao gồm cả các tool official của Playwright MCP và toàn bộ extra tools mới.

---

## 6. Hướng Dẫn Dành Cho AI Session Mới Khi Bắt Đầu Triển Khai

> [!IMPORTANT]
> **QUY TRÌNH BẢO TRÌ CHO AI SESSION TIẾP THEO:**
> 1. Giữ tương thích giữa `@playwright/mcp` và minor version của Patchright.
> 2. Sau mọi thay đổi tool, chạy `npm test`, `npm run smoke`, `npm run live-smoke` và `node scripts/doctor.mjs`.
> 3. Ref chỉ bền trong DOM hiện tại; refresh bằng `browser_snapshot_refs` sau navigation/thay đổi DOM lớn.
> 4. Flow chứa dữ liệu fill chỉ nằm trong RAM; không thêm persistence mặc định cho secret.
