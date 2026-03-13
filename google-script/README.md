# 🎬 Drive Players — Google Apps Script Edition

> **Version 3.0.0** · Xem video Google Drive không cần hosting, không cần API Key

## 📋 Tổng quan

Phiên bản **Google Apps Script** của Drive Players cho phép bạn deploy ứng dụng xem video Google Drive **miễn phí** trên Google Cloud — không cần hosting riêng, không cần API Key.

### ✨ Ưu điểm so với bản PHP

| So sánh | PHP (bản gốc) | Google Apps Script |
|---------|---------------|-------------------|
| **API Key** | Cần tạo API Key | ❌ Không cần — dùng OAuth tự động |
| **Hosting** | Cần VPS/Hosting riêng | ✅ Miễn phí trên Google Cloud |
| **Proxy** | Cần `proxy.php` bypass CORS | ❌ Không cần — dùng iframe embed |
| **Lịch sử xem** | Theo IP (file JSON) | ✅ Theo tài khoản Google (mỗi user riêng) |
| **Deploy** | Upload FTP/SSH | ✅ Click deploy từ GAS Editor |
| **SSL** | Tự cấu hình | ✅ Tự động HTTPS |
| **Cache** | File JSON trên server | Client-side (trình duyệt) |

### 🎨 Giao diện

- Giữ nguyên 100% giao diện **premium dark theme** từ bản gốc
- Font **Inter**, accent **coral-red** (#ff4444)
- Responsive cho mobile
- Micro-animations, glassmorphism effects

---

## 🚀 Hướng dẫn Deploy (3 bước)

### Bước 1: Tạo Google Apps Script Project

1. Truy cập **[script.google.com](https://script.google.com)**
2. Click **"Dự án mới"** (New project)
3. Đặt tên project: `DrivePlayers`

### Bước 2: Copy code vào project

Bạn cần tạo **5 file** trong GAS Editor:

#### 📄 File 1: `Code.gs` (đã có sẵn, xóa code mặc định)
- Xóa code mặc định `myFunction()`
- Copy toàn bộ nội dung từ file [`Code.gs`](./Code.gs) vào

#### 📄 File 2: `Index.html`
- Click **`+`** → **HTML** → Đặt tên `Index`
- Copy toàn bộ nội dung từ file [`Index.html`](./Index.html) vào

#### 📄 File 3: `Style.html`
- Click **`+`** → **HTML** → Đặt tên `Style`
- Copy toàn bộ nội dung từ file [`Style.html`](./Style.html) vào

#### 📄 File 4: `Script.html`
- Click **`+`** → **HTML** → Đặt tên `Script`
- Copy toàn bộ nội dung từ file [`Script.html`](./Script.html) vào

#### 📄 File 5: `appsscript.json`
- Vào **Project Settings** (biểu tượng ⚙️) → Bật **"Show 'appsscript.json' manifest file in editor"**
- Mở file `appsscript.json` trong editor
- Thay toàn bộ nội dung bằng file [`appsscript.json`](./appsscript.json)

### Bước 3: Deploy Web App

1. Click **"Triển khai"** (Deploy) → **"Triển khai mới"** (New deployment)
2. Click ⚙️ → Chọn **"Ứng dụng web"** (Web app)
3. Cấu hình:
   - **Mô tả**: `DrivePlayers v3.0.0`
   - **Thực thi với tư cách**: `Tôi` (Me)
   - **Ai có quyền truy cập**: `Bất kỳ ai` (Anyone)
4. Click **"Triển khai"** (Deploy)
5. **Cho phép quyền truy cập** khi được hỏi (Google Drive readonly)
6. Copy **URL** của web app → Đây là link truy cập!

---

## 📁 Cấu trúc file

```
google-script/
├── Code.gs           ← Backend: Drive API, history, routing
├── Index.html        ← HTML template chính (SPA)
├── Style.html        ← CSS premium dark theme
├── Script.html       ← JavaScript frontend (google.script.run)
├── appsscript.json   ← Manifest (OAuth scopes, timezone)
└── README.md         ← File này
```

## 🔧 Khác biệt kỹ thuật

### Server-side (Code.gs)
- **`doGet(e)`** — Serve HTML page
- **`getFilesInFolder(folderId)`** — Liệt kê video + subfolders (Drive API v3 qua `UrlFetchApp`)
- **`getSubfolderVideos(sfIds)`** — Fetch video của các subfolder
- **`getFolderName(folderId)`** — Lấy tên thư mục
- **`saveHistory() / loadHistory() / clearHistory()`** — Quản lý lịch sử xem (PropertiesService)
- **`extractFolderId(url)`** — Parse Google Drive URL

### Client-side (Script.html)
- **SPA Architecture** — Không reload trang, chuyển view bằng JavaScript
- **`google.script.run`** — Gọi server-side functions
- **iframe embed** — Phát video qua `https://drive.google.com/file/d/{id}/preview`
- **localStorage** — Lưu trạng thái sidebar

### OAuth Scopes
- `drive.readonly` — Đọc file/folder từ Drive
- `script.external_request` — Gọi Drive API v3 qua UrlFetchApp
- `userinfo.email` — Để PropertiesService nhận diện user

---

## ⚠️ Lưu ý quan trọng

1. **Thư mục Drive phải được chia sẻ công khai** ("Anyone with the link") để iframe embed hoạt động
2. **Lần deploy đầu tiên** cần cấp quyền truy cập Drive — chọn "Cho phép" (Allow)
3. **Mỗi lần cập nhật code**, cần vào Deploy → Manage deployments → Edit → New version → Deploy
4. **Giới hạn GAS**: Mỗi script có giới hạn 6 phút thực thi cho mỗi request. Thư mục quá lớn (>1000 video) có thể timeout
5. **Video playback**: Sử dụng iframe embed của Google Drive (không dùng Plyr.io vì CORS). Chất lượng phát phụ thuộc vào Google Drive Player

---

## 🆕 Changelog

### v3.0.0 (2026-03-13)
- 🎉 **Phiên bản Google Apps Script đầu tiên**
- ✅ Không cần API Key — sử dụng OAuth token
- ✅ Hosting miễn phí trên Google Cloud
- ✅ Lịch sử xem theo tài khoản Google
- ✅ Giao diện premium dark theme giữ nguyên
- ✅ SPA architecture — không reload trang
- ✅ Collapsible subfolder navigation
- ✅ Keyboard shortcuts (/, b, Escape)
- ✅ Search/filter videos
- ✅ Responsive mobile design
