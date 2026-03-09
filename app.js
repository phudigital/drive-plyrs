/**
 * Drive Players - JavaScript
 * Version: 2.6.0
 * Video playback powered by Plyr.io
 */

const SIDEBAR_KEY = 'dp_sidebar_open';
let plyrInstance   = null;
let _fallbackLevel = 0; // 0=plyr direct, 1=iframe embed, 2=proxy
let _fallbackTimer = null;
let _currentFileId = null;
document.addEventListener('DOMContentLoaded', () => {
    initPlyrPlayer();
    initSidebarToggle();
    initFilterSearch();
    initKeyboardShortcuts();
    scrollToActiveVideo();
});

/* ==========================================================================
   Plyr Player Initialization
   ========================================================================== */


function initPlyrPlayer() {
    const videoEl = document.getElementById('plyr-player');
    if (!videoEl) return;

    _fallbackLevel = 0;

    // Cache the file ID from the source URL
    const srcUrl = videoEl.querySelector('source')?.src || '';
    const m = srcUrl.match(/files\/([^?]+)/);
    _currentFileId = m ? m[1] : null;

    plyrInstance = new Plyr(videoEl, {
        controls: [
            'play-large',   // The large play button in the center
            'restart',      // Restart playback
            'rewind',       // Rewind by the seek time (default 10 seconds)
            'play',         // Play/pause playback
            'fast-forward', // Fast forward by the seek time (default 10 seconds)
            'progress',     // The progress bar and scrubber
            'current-time', // The current time of playback
            'duration',     // The full duration of the media
            'mute',         // Toggle mute
            'volume',       // Volume control
            'settings',     // Settings menu
            'pip',          // Picture-in-picture
            'airplay',      // Airplay (for Apple devices)
            'fullscreen',   // Toggle fullscreen
        ],
        settings: ['quality', 'speed', 'loop'],
        speed: {
            selected: 1,
            options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
        },
        keyboard: {
            focused: true,
            global: true,
        },
        tooltips: {
            controls: true,
            seek: true,
        },
        invertTime: false,
        seekTime: 10,
        i18n: {
            restart: 'Phát lại',
            rewind: 'Tua lại {seektime}s',
            play: 'Phát',
            pause: 'Tạm dừng',
            fastForward: 'Tiến {seektime}s',
            seek: 'Tua',
            seekLabel: '{currentTime} / {duration}',
            played: 'Đã phát',
            buffered: 'Đã tải',
            currentTime: 'Thời gian hiện tại',
            duration: 'Thời lượng',
            volume: 'Âm lượng',
            mute: 'Tắt tiếng',
            unmute: 'Bật tiếng',
            enableCaptions: 'Bật phụ đề',
            disableCaptions: 'Tắt phụ đề',
            enterFullscreen: 'Toàn màn hình',
            exitFullscreen: 'Thoát toàn màn hình',
            frameTitle: 'Trình phát video: {title}',
            captions: 'Phụ đề',
            settings: 'Cài đặt',
            pip: 'Hình trong hình',
            menuBack: 'Quay lại',
            speed: 'Tốc độ',
            normal: 'Bình thường',
            quality: 'Chất lượng',
            loop: 'Lặp lại',
            start: 'Bắt đầu',
            end: 'Kết thúc',
            all: 'Tất cả',
            reset: 'Đặt lại',
            disabled: 'Tắt',
            enabled: 'Bật',
            advertisement: 'Quảng cáo',
            qualityBadge: {
                2160: '4K',
                1440: 'HD',
                1080: 'HD',
                720: 'HD',
                576: 'SD',
                480: 'SD',
            },
        },
    });

    // --- Error-based fallback ---
    plyrInstance.on('error', () => fallbackToIframe());
    videoEl.addEventListener('error', () => fallbackToIframe());

    // --- Success: cancel timeout ---
    const cancelFallbackTimer = () => {
        if (_fallbackTimer) {
            clearTimeout(_fallbackTimer);
            _fallbackTimer = null;
        }
    };

    plyrInstance.on('loadedmetadata', cancelFallbackTimer);
    plyrInstance.on('loadeddata', cancelFallbackTimer);
    plyrInstance.on('playing', cancelFallbackTimer);

    // --- Timeout → auto iframe fallback ---
    _fallbackTimer = setTimeout(() => {
        const nativeVideo = plyrInstance?.media;
        if (nativeVideo && nativeVideo.readyState < 2 && _fallbackLevel === 0) {
            console.warn('[DrivePlayers] Timeout — falling back to iframe');
            fallbackToIframe();
        }
    }, 8000);
}

/** Fallback helper: extract file ID from current Plyr source URL */
function getFileIdFromPlayer() {
    const videoEl = plyrInstance?.media || document.getElementById('plyr-player');
    if (!videoEl) return null;
    const src = (videoEl.querySelector?.('source') || videoEl).getAttribute?.('src') || '';
    return src.match(/files\/([^?]+)/)?.[1] || null;
}

/**
 * Level 1 → Level 2: Switch to Google Drive embed iframe
 */
function fallbackToIframe() {
    if (_fallbackLevel >= 1) return;
    _fallbackLevel = 1;

    if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }

    const fileId = _currentFileId || getFileIdFromPlayer();
    const container = document.getElementById('video-container');
    if (!container || !fileId) return;

    if (plyrInstance) {
        try { plyrInstance.destroy(); } catch (e) {}
        plyrInstance = null;
    }

    container.innerHTML = `
        <div style="position:relative;width:100%;aspect-ratio:16/9">
            <iframe
                id="video-player-iframe"
                src="https://drive.google.com/file/d/${fileId}/preview"
                frameborder="0"
                allowfullscreen
                allow="autoplay; encrypted-media; fullscreen"
                class="video-iframe"
            ></iframe>
        </div>
        <div class="fallback-notice" id="fallback-notice">
            <span>⚠️ Đang dùng chế độ nhúng. Video không load?</span>
            <button class="btn-try-proxy" id="btn-try-proxy" onclick="fallbackToProxy()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Thử Proxy
            </button>
            <a class="btn-open-drive" href="https://drive.google.com/file/d/${fileId}/view" target="_blank" rel="noopener">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                Mở Google Drive
            </a>
        </div>
    `;

    showToast('⚠️ Đã chuyển sang chế độ nhúng (embedded)');
}

/**
 * Level 2 → Level 3: Proxy stream through our PHP server
 */
function fallbackToProxy() {
    if (_fallbackLevel >= 2) return;
    _fallbackLevel = 2;

    const fileId = _currentFileId;
    const container = document.getElementById('video-container');
    if (!container || !fileId) return;

    const proxyUrl = `proxy.php?id=${encodeURIComponent(fileId)}`;

    container.innerHTML = `
        <video
            id="plyr-player-proxy"
            controls
            playsinline
            style="width:100%;aspect-ratio:16/9;background:#000;display:block"
        >
            <source src="${proxyUrl}" type="video/mp4">
        </video>
        <div class="fallback-notice" id="fallback-notice">
            <span>🔄 Đang dùng proxy stream. Nếu vẫn lỗi:</span>
            <a class="btn-open-drive" href="https://drive.google.com/file/d/${fileId}/view" target="_blank" rel="noopener">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                Mở trong Google Drive
            </a>
            <a class="btn-open-drive" href="proxy.php?id=${encodeURIComponent(fileId)}" download>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Tải xuống
            </a>
        </div>
    `;

    // Try to init Plyr on the proxy video
    try {
        const proxyVideo = document.getElementById('plyr-player-proxy');
        if (proxyVideo && window.Plyr) {
            plyrInstance = new Plyr(proxyVideo, {
                controls: ['play-large','play','progress','current-time','duration','mute','volume','fullscreen'],
            });
        }
    } catch (e) {}

    showToast('🔄 Đang stream qua proxy server...');
}

/* ==========================================================================
   Sidebar Toggle
   ========================================================================== */

function initSidebarToggle() {
    // Primary close button: inside sidebar header
    const toggleBtn  = document.getElementById('sidebar-toggle-btn')
                    || document.getElementById('menu-toggle');
    // Open button: floating pill shown when sidebar is closed
    const openBtn    = document.getElementById('sidebar-open-btn');
    const layout     = document.getElementById('player-layout');

    if (!layout) return;

    // Restore saved state (default: open)
    const savedOpen = localStorage.getItem(SIDEBAR_KEY);
    const isOpen    = savedOpen === null ? true : savedOpen === '1';

    if (!isOpen) {
        layout.classList.add('sidebar-closed');
        document.body.classList.add('sidebar-is-closed');
    }

    if (toggleBtn) updateToggleIcon(toggleBtn, isOpen);

    function open() {
        layout.classList.remove('sidebar-closed');
        document.body.classList.remove('sidebar-is-closed');
        localStorage.setItem(SIDEBAR_KEY, '1');
        if (toggleBtn) updateToggleIcon(toggleBtn, true);
    }

    function close() {
        layout.classList.add('sidebar-closed');
        document.body.classList.add('sidebar-is-closed');
        localStorage.setItem(SIDEBAR_KEY, '0');
        if (toggleBtn) updateToggleIcon(toggleBtn, false);
    }

    function toggle() {
        layout.classList.contains('sidebar-closed') ? open() : close();
    }

    if (toggleBtn) toggleBtn.addEventListener('click', toggle);
    if (openBtn)   openBtn.addEventListener('click', open);
}

/**
 * Swap hamburger ↔ arrow icon based on sidebar state
 */
function updateToggleIcon(btn, sidebarOpen) {
    btn.setAttribute('aria-label', sidebarOpen ? 'Đóng danh sách' : 'Mở danh sách');
    btn.setAttribute('title',      sidebarOpen ? 'Đóng danh sách (b)' : 'Mở danh sách (b)');
}

/* ==========================================================================
   Filter / Search
   ========================================================================== */

function initFilterSearch() {
    const filterInput = document.getElementById('filter-input');
    if (!filterInput) return;

    filterInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = document.querySelectorAll('.video-item, .folder-item');
        const divider = document.getElementById('list-divider');

        let visibleVideos   = 0;
        let visibleFolders  = 0;

        items.forEach((item) => {
            const name    = item.dataset.videoName || '';
            const matches = !query || name.includes(query);
            item.style.display = matches ? '' : 'none';
            if (matches) {
                item.classList.contains('folder-item') ? visibleFolders++ : visibleVideos++;
            }
        });

        // Hide divider when searching hides one group entirely
        if (divider) {
            divider.style.display = (visibleFolders === 0 || visibleVideos === 0) ? 'none' : '';
        }
    });
}

/* ==========================================================================
   Keyboard Shortcuts
   ========================================================================== */

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (isInputFocused()) return;

        // '/' — focus sidebar search
        if (e.key === '/') {
            e.preventDefault();
            const input = document.getElementById('filter-input') || document.getElementById('landing-drive-input');
            if (input) input.focus();
        }

        // 'b' — toggle sidebar
        if (e.key === 'b' || e.key === 'B') {
            const btn = document.getElementById('sidebar-toggle-btn')
                     || document.getElementById('menu-toggle');
            btn?.click();
        }

        // 'Escape' — blur active input
        if (e.key === 'Escape') {
            document.activeElement?.blur();
        }
    });
}

/* ==========================================================================
   Scroll to active video
   ========================================================================== */

function scrollToActiveVideo() {
    const activeItem = document.querySelector('.video-item.active');
    if (activeItem) {
        setTimeout(() => {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 350);
    }
}

/* ==========================================================================
   Copy Link
   ========================================================================== */

function copyVideoLink(videoId) {
    const url = `https://drive.google.com/file/d/${videoId}/view`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(url)
            .then(() => showToast('✅ Đã copy link video!'))
            .catch(() => fallbackCopy(url));
    } else {
        fallbackCopy(url);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast('✅ Đã copy link video!');
    } catch {
        showToast('Không thể copy link');
    }
    document.body.removeChild(ta);
}

/* ==========================================================================
   Toast
   ========================================================================== */

function showToast(message, duration = 3000) {
    const toast   = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.classList.add('show');

    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ==========================================================================
   Utility
   ========================================================================== */

function isInputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}
