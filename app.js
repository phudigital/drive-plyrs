/**
 * Drive Players - JavaScript
 * Version: 2.2.0
 * Video playback powered by Plyr.io
 */

const SIDEBAR_KEY = 'dp_sidebar_open';
let plyrInstance = null;

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

let _fallbackTriggered = false;
let _fallbackTimer = null;

function initPlyrPlayer() {
    const videoEl = document.getElementById('plyr-player');
    if (!videoEl) return;

    _fallbackTriggered = false;

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
    plyrInstance.on('error', () => triggerFallback());
    videoEl.addEventListener('error', () => triggerFallback());

    // --- Success: cancel timeout when video loads properly ---
    const cancelFallbackTimer = () => {
        if (_fallbackTimer) {
            clearTimeout(_fallbackTimer);
            _fallbackTimer = null;
        }
    };

    plyrInstance.on('loadedmetadata', cancelFallbackTimer);
    plyrInstance.on('loadeddata', cancelFallbackTimer);
    plyrInstance.on('playing', cancelFallbackTimer);

    // --- Timeout fallback ---
    // If video metadata hasn't loaded within 8 seconds, the direct
    // streaming URL is likely blocked by Google Drive (CORS / large file /
    // restricted sharing). Switch to iframe embed automatically.
    _fallbackTimer = setTimeout(() => {
        const nativeVideo = plyrInstance?.media;
        if (nativeVideo && nativeVideo.readyState < 2 && !_fallbackTriggered) {
            console.warn('[DrivePlayers] Video metadata timeout — falling back to iframe embed');
            triggerFallback();
        }
    }, 8000);
}

/**
 * Extract Google Drive file ID from the current video source URL
 */
function getFileIdFromPlayer() {
    // Try Plyr's media element first, then raw DOM
    const videoEl = plyrInstance?.media || document.getElementById('plyr-player');
    if (!videoEl) return null;

    const source = videoEl.querySelector?.('source') || videoEl;
    const srcUrl = source.getAttribute?.('src') || '';
    const match = srcUrl.match(/files\/([^?]+)/);
    return match ? match[1] : null;
}

/**
 * Fallback: when direct streaming fails (e.g. CORS, large files),
 * switch to the Google Drive preview iframe.
 * Prevents double-triggering.
 */
function triggerFallback() {
    if (_fallbackTriggered) return;
    _fallbackTriggered = true;

    // Cancel any pending timeout
    if (_fallbackTimer) {
        clearTimeout(_fallbackTimer);
        _fallbackTimer = null;
    }

    const container = document.getElementById('video-container');
    const fileId = getFileIdFromPlayer();
    if (!container || !fileId) return;

    // Destroy Plyr instance
    if (plyrInstance) {
        try { plyrInstance.destroy(); } catch (e) { /* ignore */ }
        plyrInstance = null;
    }

    // Replace with iframe fallback
    container.innerHTML = `
        <iframe
            id="video-player-iframe"
            src="https://drive.google.com/file/d/${fileId}/preview"
            frameborder="0"
            allowfullscreen
            allow="autoplay; encrypted-media; fullscreen"
            class="video-iframe"
        ></iframe>
    `;

    showToast('⚠️ Đã chuyển sang chế độ xem nhúng (embedded)');
}

/* ==========================================================================
   Sidebar Toggle
   ========================================================================== */

function initSidebarToggle() {
    const menuBtn      = document.getElementById('menu-toggle');
    const layout       = document.getElementById('player-layout');
    const sidebar      = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

    if (!menuBtn) return;

    // Restore saved state (default: open)
    const savedOpen = localStorage.getItem(SIDEBAR_KEY);
    const isOpen    = savedOpen === null ? true : savedOpen === '1';

    if (layout && !isOpen) {
        layout.classList.add('sidebar-closed');
        document.body.classList.add('sidebar-is-closed');
    }

    updateToggleIcon(menuBtn, isOpen);

    // Main toggle handler
    function toggle() {
        if (!layout) return;
        const closing = !layout.classList.contains('sidebar-closed');
        layout.classList.toggle('sidebar-closed', closing);
        document.body.classList.toggle('sidebar-is-closed', closing);
        localStorage.setItem(SIDEBAR_KEY, closing ? '0' : '1');
        updateToggleIcon(menuBtn, !closing);
    }

    menuBtn.addEventListener('click', toggle);

    // Extra button inside sidebar header (if present)
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggle);
    }
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
            document.getElementById('menu-toggle')?.click();
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
