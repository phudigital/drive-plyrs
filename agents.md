# 🎬 Drive Players: Project Summary & Vibe Coding Guide

## 📱 Project Overview
**Drive Players** is a high-performance web application designed to browse and play videos directly from Google Drive folders. It features a premium, YouTube-like interface with a focuses on smooth user experience, fast navigation, and clear metadata display.

## 🛠️ Technology Stack
- **Backend**: PHP 7.4+ (No frameworks, pure PHP).
- **Frontend**: Vanilla JavaScript + CSS.
- **Video Engine**: [Plyr.io](https://plyr.io/) for cross-browser stability.
- **Data Source**: Google Drive API v3 (Public API Key based).
- **Storage**: Sessions for watch history, JSON files for folder/video list caching.

## 🏗️ Core Architecture
1. **`index.php`**: The orchestrator. Handles session management, request routing, navigation logic (breadcrumbs/subfolders), and renders the main UI.
2. **`proxy.php`**: A critical component for binary streaming. It proxies video data from Google Drive to bypass CORS limitations and handle `Range` headers for seekable playback.
3. **`drive-api.php`**: Contains the logic for interacting with Google Drive API v3 (fetching file/folder lists, metadata, and names).
4. **`config.php`**: Centralized configuration for `GOOGLE_API_KEY`, `CACHE_DURATION`, and `VIDEOS_PER_PAGE`.
5. **`history.php`**: Manages the "Recently Watched" list using PHP sessions.
6. **`app.js`**: Frontend interactivity, including sidebar toggling (hotkey `b`), search filtering (hotkey `/`), and Plyr initialization.
7. **`style.css`**: Defines the project's visual identity—a sleek, modern dark theme with vibrant accents.

## ✨ Key Features
- **Direct Playback**: Streams video files from Drive folders via a local proxy.
- **Dynamic Navigation**: Supports nested subfolders with a clear breadcrumb trail.
- **Smart Sidebar**: Houses a searchable list of videos and subfolders, which can be toggled for a full-player experience.
- **Rich Metadata**: Automatically displays video resolution (HD/4K), duration, file size, and extension.
- **Zero Login**: Does not require OAuth; works with any publicly shared (Anyone with the link) folder.
- **Watch History**: Remembers your recently viewed videos across sessions.
- **Keyboard Shortcuts**: `/` for search, `b` for sidebar, `space` for play/pause.

## 🎨 Design Aesthetics & "Vibe"
- **Typography**: Uses **Inter** for a clean, professional look.
- **Color Palette**: Dark mode background (`#0f0f0f`), dark-gray surfaces (`#1e1e1e`), and vibrant coral-red accents (`#ff6b6b`).
- **Layout**: YouTube-inspired desktop layout with a persistent (but hideable) sidebar and a prominent primary player.
- **Interactive Elements**: Subtle micro-animations, smooth transitions, and hover effects for a premium feel.

## 🚀 Coding Standards for This Project
1. **Premium First**: Every UI change must feel polished and modern. Avoid generic colors or layouts.
2. **Performance**: Keep scripts and styles lean. Use the built-in cache system aggressively to minimize Drive API hits.
3. **Responsive Design**: Ensure everything works perfectly on mobile devices (sidebar should adapt/hide correctly).
4. **Clean Code**: Document functions clearly and use descriptive variable names.
5. **SEO Optimized**: Maintain proper heading hierarchy and semantic HTML tags.
6. **Version Control**: Tự động commit và push Github khi cập nhật phiên bản mới của ứng dụng.
7. **Version Is Mandatory**: Mỗi thay đổi quan trọng bắt buộc phải cập nhật version hiển thị trên trang chủ. Mỗi lần cập nhật version bắt buộc phải tạo commit riêng và push lên Github.

---
*Created for effective Vibe Coding and rapid project scaling.*
