# 🎬 Drive Players

Trình xem video từ Google Drive với giao diện đẹp như YouTube. Chỉ cần dán link Google Drive folder là xem được!

## ✨ Tính năng

- 🎥 **Xem video trực tiếp** từ Google Drive folder
- 📂 **Duyệt thư mục con** trong Drive folder
- 🔍 **Tìm kiếm/lọc video** trong danh sách
- 📊 **Hiển thị metadata**: độ phân giải, thời lượng, dung lượng file
- 📱 **Responsive** - hoạt động tốt trên mobile
- 🌙 **Dark theme** đẹp mắt kiểu YouTube
- ⬇️ **Tải xuống** video trực tiếp
- 🎛️ **3 chế độ phát**: Phát 1, Phát 2 và Local Cache
- ⌨️ **Keyboard shortcuts** (nhấn `/` để tìm kiếm)
- 💾 **Cache tự động** - tải nhanh hơn lần sau
- 🔒 **Không cần đăng nhập** - chỉ cần Google API Key miễn phí

## 🚀 Cài đặt

### Yêu cầu
- PHP 7.4+ với curl extension
- Google API Key (miễn phí)

### Bước 1: Lấy Google API Key

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo Project mới (hoặc chọn project có sẵn)
3. Vào menu **APIs & Services** → **Library**
4. Tìm **"Google Drive API"** → Click **"Enable"**
5. Vào **APIs & Services** → **Credentials**
6. Click **"Create Credentials"** → **"API Key"**
7. Copy API Key

### Bước 2: Cấu hình

Mở file `config.php` và dán API Key:

```php
define('GOOGLE_API_KEY', 'YOUR_API_KEY_HERE');
```

### Bước 3: Chạy

**Option A - PHP Built-in Server (dev):**
```bash
php -S localhost:8080
```

**Option B - Deploy lên hosting:**
Upload toàn bộ thư mục lên hosting PHP.

## 📖 Sử dụng

1. Mở thư mục video trên Google Drive
2. Đảm bảo thư mục đã được **chia sẻ** (Anyone with the link)  
3. Copy link thư mục (dạng: `https://drive.google.com/drive/folders/...`)
4. Dán link vào ô input và nhấn **Xem Video**
5. Thưởng thức! 🎉

## 📁 Cấu trúc file

```
drive-plyrs/
├── index.php        # Trang chính - Player & UI
├── drive-api.php    # Google Drive API integration
├── config.php       # Cấu hình (API Key)
├── style.css        # Giao diện CSS
├── app.js           # JavaScript interactions
├── .htaccess        # Apache security config
├── .gitignore       # Git ignore rules
├── cache/           # Thư mục cache (tự tạo)
└── README.md        # Tài liệu này
```

## ⚙️ Cấu hình

| Tham số | Mặc định | Mô tả |
|---------|----------|-------|
| `GOOGLE_API_KEY` | `''` | Google API Key (bắt buộc) |
| `VIDEOS_PER_PAGE` | `0` | Số video/trang (0 = tất cả) |
| `CACHE_DURATION` | `300` | Thời gian cache (giây) |

## 🔗 Truy cập nhanh

Bạn có thể truy cập trực tiếp bằng URL:
```
http://your-site.com/index.php?folder=FOLDER_ID
```

## 📝 Version

- **2.9.3** - Tối ưu thêm Local Cache cho folder Tam quốc diễn nghĩa
  - Chặn sớm trường hợp Google trả HTML warning thay vì video bytes
  - `proxy.php` báo lỗi rõ ràng nếu không lấy được token tải thật
  - `app.js` kiểm tra `content-type` trước khi dựng blob player

- **2.9.2** - Sửa toàn bộ luồng phát từ Local Cache
  - Cache mode chuyển sang nguồn tải công khai ổn định của Google Drive
  - Tăng độ ổn định khi tải file lớn và phát từ blob local
  - Giảm phụ thuộc vào `alt=media` vốn dễ trả lỗi `403`

- **1.1.0** - Thêm điều hướng thư mục con
  - **Breadcrumb navigation** - hiển thị đường dẫn thư mục, click để quay lại
  - **Thư mục con hiển thị trong sidebar** - xen kẽ cùng video list
  - **Nút Back** trong header sidebar để quay lại thư mục cha
  - Hỗ trợ folder chỉ chứa subfolders (không có video)
  - Tên thư mục gốc tự động lấy từ Drive API

- **1.0.0** - Phiên bản đầu tiên
  - Xem video từ Google Drive folder
  - Giao diện YouTube-like với dark theme
  - Hiển thị metadata (resolution, duration, size)
  - Tìm kiếm/lọc video
  - Cache danh sách video
  - Responsive design
