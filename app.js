/**
 * Drive Players - JavaScript
 * Version: 2.8.1
 * Video playback powered by Plyr.io
 */

const SIDEBAR_KEY = 'dp_sidebar_open';
const PHONE_SIDEBAR_QUERY = window.matchMedia('(max-width: 768px)');
let plyrInstance   = null;
let _fallbackLevel = 0; // 0=plyr direct, 1=iframe embed, 2=proxy
let _fallbackTimer = null;
let _currentFileId = null;
let sidebarController = null;
let currentPlaybackMode = 'direct';

function isPhoneViewport() {
    return PHONE_SIDEBAR_QUERY.matches;
}

function getPlyrControls() {
    if (isPhoneViewport()) {
        return [
            'play-large',
            'play',
            'progress',
            'fullscreen',
        ];
    }

    return [
        'play-large',
        'restart',
        'rewind',
        'play',
        'fast-forward',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'settings',
        'pip',
        'airplay',
        'fullscreen',
    ];
}

function getPlyrSettings() {
    return isPhoneViewport()
        ? ['speed']
        : ['quality', 'speed', 'loop'];
}

document.addEventListener('DOMContentLoaded', () => {
    initPlyrPlayer();
    initPlaybackModeToggle();
    initSidebarToggle();
    initFilterSearch();
    initKeyboardShortcuts();
    scrollToActiveVideo();
    preloadNextVideoIfSmall();
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
    currentPlaybackMode = 'direct';

    plyrInstance = new Plyr(videoEl, {
        controls: getPlyrControls(),
        settings: getPlyrSettings(),
        speed: {
            selected: 1,
            options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4],
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
    updatePlaybackModeBadge('Phát trực tiếp', '46, 204, 113', 'direct');

    // --- Timeout fallback: 5s — nếu không load được, chuyển sang chế độ nhúng ---
    _fallbackTimer = setTimeout(() => {
        const nativeVideo = plyrInstance?.media;
        if (nativeVideo && nativeVideo.readyState < 2 && _fallbackLevel === 0) {
            console.warn('[DrivePlayers] Timeout 5s — falling back to iframe');
            fallbackToIframe();
        }
    }, 5000);
}

function getPlaybackContext() {
    const container = document.getElementById('video-container');
    if (!container) return null;

    const fileId = container.dataset.fileId || _currentFileId || getFileIdFromPlayer();
    const mimeType = container.dataset.mimeType || 'video/mp4';
    const poster = container.dataset.poster || '';
    const apiKey = container.dataset.apiKey || '';

    if (!fileId) return null;

    return { container, fileId, mimeType, poster, apiKey };
}

function buildDirectVideoMarkup({ fileId, mimeType, poster, apiKey }) {
    const sourceUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`;

    return `
        <video
            id="plyr-player"
            playsinline
            controls
            crossorigin
            ${poster ? `data-poster="${poster}"` : ''}
        >
            <source
                src="${sourceUrl}"
                type="${mimeType}"
            />
        </video>
    `;
}

function switchToDirectPlayback() {
    const context = getPlaybackContext();
    if (!context) return;

    _fallbackLevel = 0;
    currentPlaybackMode = 'direct';

    if (_fallbackTimer) {
        clearTimeout(_fallbackTimer);
        _fallbackTimer = null;
    }

    if (plyrInstance) {
        try { plyrInstance.destroy(); } catch (e) {}
        plyrInstance = null;
    }

    context.container.innerHTML = buildDirectVideoMarkup(context);
    initPlyrPlayer();
    showToast('▶️ Đã chuyển sang Phát 1');
}

function initPlaybackModeToggle() {
    document.querySelectorAll('.playback-switch-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const mode = button.dataset.playbackMode;
            if (!mode || mode === currentPlaybackMode) return;

            if (mode === 'direct') {
                switchToDirectPlayback();
                return;
            }

            if (mode === 'embed') {
                fallbackToIframe(true);
                return;
            }

            if (mode === 'cache') {
                await fallbackToProxy(true);
            }
        });
    });
}

/** Fallback helper: extract file ID from current Plyr source URL */
function getFileIdFromPlayer() {
    const videoEl = plyrInstance?.media || document.getElementById('plyr-player');
    if (!videoEl) return null;
    const src = (videoEl.querySelector?.('source') || videoEl).getAttribute?.('src') || '';
    return src.match(/files\/([^?]+)/)?.[1] || null;
}

/**
 * Level 1: Switch to Google Drive embed iframe
 * → Iframe is a reliable fallback that handles auth + CORS natively.
 * → NO auto-escalation to cache (too slow via VPS). Cache is manual only.
 */
function fallbackToIframe(force = false) {
    if (!force && _fallbackLevel >= 1) return;
    _fallbackLevel = 1;
    currentPlaybackMode = 'embed';

    if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }

    const context = getPlaybackContext();
    if (!context) return;
    const { fileId, container } = context;

    if (plyrInstance) {
        try { plyrInstance.destroy(); } catch (e) {}
        plyrInstance = null;
    }

    updatePlaybackModeBadge('Chế độ Nhúng', '230, 126, 34', 'embed');

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
            <span>⚠️ Chế độ nhúng (Drive Embed).</span>
            <a class="btn-open-drive" href="https://drive.google.com/file/d/${fileId}/view" target="_blank" rel="noopener">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                Mở Google Drive
            </a>
        </div>
    `;

    if (force) {
        showToast('🎬 Đã chuyển sang Phát 2');
    } else {
        showToast('⚠️ Chuyển sang chế độ nhúng Google Drive');
    }
}

/**
 * Level 2 → Level 3: Download proxy stream to Browser Cache / RAM then play
 */
async function fallbackToProxy(force = false) {
    if (!force && _fallbackLevel >= 2) return;
    _fallbackLevel = 2;
    currentPlaybackMode = 'cache';

    if (_fallbackTimer) {
        clearInterval(_fallbackTimer);
        _fallbackTimer = null;
    }

    const context = getPlaybackContext();
    if (!context) return;
    const { fileId, container } = context;

    updatePlaybackModeBadge('Tải Cache...', '52, 152, 219', 'cache');

    const proxyUrl = `proxy.php?id=${encodeURIComponent(fileId)}`;

    // Initial Loading UI
    container.innerHTML = `
        <div class="cache-download-ui" id="cache-dl-ui">
            <svg class="cache-dl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            <div class="cache-dl-title">Đang tải video vào Cache...</div>
            <div class="cache-dl-desc" id="cache-dl-desc">Đang kết nối tốc độ cao từ Google CDN...</div>
            
            <div class="cache-dl-progress-box">
                <div class="cache-dl-progress-bar" id="cache-dl-bar"></div>
            </div>
            
            <div class="cache-dl-stats">
                <span id="cache-dl-percent">0%</span> • 
                <span id="cache-dl-loaded">0.0 MB</span> / <span id="cache-dl-total">??? MB</span>
            </div>
        </div>
    `;

    // Try fetching directly from Google Drive CDN first (much faster, bypasses VPS bottleneck)
    // Fall back to proxy.php only if CORS blocks the direct request
    const currentVideoEl = document.getElementById('plyr-player');
    const currentSrc = (currentVideoEl?.querySelector?.('source') || currentVideoEl)?.getAttribute?.('src') || '';
    const keyMatch = currentSrc.match(/key=([^&]+)/);
    const apiKey = keyMatch ? decodeURIComponent(keyMatch[1]) : '';

    const directUrl = apiKey
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`
        : null;

    let fetchUrl = proxyUrl;
    let usingDirect = false;

    if (directUrl) {
        try {
            // HEAD request to test CORS + reachability without downloading data
            const test = await fetch(directUrl, { method: 'HEAD', mode: 'cors' });
            if (test.ok || test.status === 206) {
                fetchUrl = directUrl;
                usingDirect = true;
                console.log('[DrivePlayers] Cache: dùng Google Drive CDN trực tiếp (tốc độ cao)');
                const desc = document.getElementById('cache-dl-desc');
                if (desc) desc.textContent = '⚡ Đang tải từ Google CDN (tốc độ tối đa)...';
            }
        } catch (corsErr) {
            console.warn('[DrivePlayers] Cache: Google CDN bị CORS, chuyển sang proxy.php');
            const desc = document.getElementById('cache-dl-desc');
            if (desc) desc.textContent = '🔄 Chuyển sang proxy server...';
        }
    }

    try {
        const response = await fetch(fetchUrl, usingDirect ? { mode: 'cors' } : {});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentLength = response.headers.get('content-length');
        if (!contentLength) {
            const blob = await response.blob();
            playBlobVideo(blob, container, fileId);
            return;
        }

        const totalBytes = parseInt(contentLength, 10);
        let loadedBytes = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            loadedBytes += value.length;

            const percent = Math.round((loadedBytes / totalBytes) * 100);
            
            // Update UI
            const bar = document.getElementById('cache-dl-bar');
            const pct = document.getElementById('cache-dl-percent');
            const ld  = document.getElementById('cache-dl-loaded');
            const tot = document.getElementById('cache-dl-total');
            
            if (bar) bar.style.width = percent + '%';
            if (pct) pct.textContent = percent + '%';
            if (ld)  ld.textContent  = (loadedBytes / 1048576).toFixed(1) + ' MB';
            if (tot) tot.textContent = (totalBytes / 1048576).toFixed(1) + ' MB';
        }

        const blob = new Blob(chunks, { type: 'video/mp4' });
        playBlobVideo(blob, container, fileId);

    } catch (error) {
        // If direct URL failed mid-download, try proxy as last resort
        if (usingDirect) {
            console.warn('[DrivePlayers] Cache direct failed mid-download, retrying via proxy...');
            usingDirect = false;
            fetchUrl = proxyUrl;
            const desc = document.getElementById('cache-dl-desc');
            if (desc) desc.textContent = '🔄 Thử lại qua proxy server...';
            try {
                const r2 = await fetch(proxyUrl);
                if (!r2.ok) throw new Error(`Proxy HTTP ${r2.status}`);
                const blob = await r2.blob();
                playBlobVideo(blob, container, fileId);
                return;
            } catch (e2) {
                console.error('Cache download failed even with proxy retry:', e2);
            }
        }
        console.error('Cache download failed:', error);
        container.innerHTML = `
            <div class="fallback-notice">
                <span>❌ Lỗi tải cache: ${error.message}</span>
                <a class="btn-open-drive" href="https://drive.google.com/file/d/${fileId}/view" target="_blank" rel="noopener">Mở Drive</a>
            </div>
        `;
    }
}

/**
 * Initialize player from a Blob object
 */
function playBlobVideo(blob, container, fileId) {
    const objectUrl = URL.createObjectURL(blob);
    
    container.innerHTML = `
        <video
            id="plyr-player-proxy"
            controls
            playsinline
            style="width:100%;aspect-ratio:16/9;background:#000;display:block"
        >
            <source src="${objectUrl}" type="video/mp4">
        </video>
        <div class="fallback-notice" id="fallback-notice">
            <span>⚡ Đang phát siêu tốc từ bộ nhớ Cache cục bộ.</span>
        </div>
    `;

    updatePlaybackModeBadge('Phát từ Cache', '155, 89, 182');

    try {
        const proxyVideo = document.getElementById('plyr-player-proxy');
        if (proxyVideo && window.Plyr) {
            plyrInstance = new Plyr(proxyVideo, {
                controls: getPlyrControls(),
                settings: isPhoneViewport() ? ['speed'] : ['speed', 'loop'],
                speed: {
                    selected: 1,
                    options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4],
                },
                keyboard: {
                    focused: true,
                    global: true,
                },
            });
        }
    } catch (e) {}

    currentPlaybackMode = 'cache';
    updatePlaybackModeBadge('Phát từ Cache', '155, 89, 182', 'cache');
    showToast('⚡ Phát từ Local Cache thành công!');
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
    const mobileTrigger = document.getElementById('mobile-sheet-trigger');
    const mobileBackdrop = document.getElementById('mobile-sheet-backdrop');
    const mobileHandle = document.getElementById('mobile-sheet-handle');
    const filterInput = document.getElementById('filter-input');
    const layout     = document.getElementById('player-layout');

    if (!layout) return;

    // Restore saved state (default: open)
    const savedOpen = localStorage.getItem(SIDEBAR_KEY);
    let isDesktopSidebarOpen = savedOpen === null ? true : savedOpen === '1';
    let isMobileSheetOpen = false;

    function isPhoneLayout() {
        return PHONE_SIDEBAR_QUERY.matches;
    }

    function syncMobileTrigger() {
        if (mobileTrigger) {
            mobileTrigger.setAttribute('aria-expanded', isMobileSheetOpen ? 'true' : 'false');
        }
    }

    function syncToggleButton() {
        if (!toggleBtn) return;
        if (isPhoneLayout()) {
            toggleBtn.setAttribute('aria-label', isMobileSheetOpen ? 'Đóng danh sách' : 'Mở danh sách');
            toggleBtn.setAttribute('title', isMobileSheetOpen ? 'Đóng danh sách (b)' : 'Mở danh sách (b)');
            return;
        }

        updateToggleIcon(toggleBtn, isDesktopSidebarOpen);
    }

    function syncMobileSheetPresentation() {
        if (mobileBackdrop) {
            mobileBackdrop.hidden = !isMobileSheetOpen;
        }

        if (isPhoneLayout()) {
            layout.classList.toggle('sidebar-closed', !isMobileSheetOpen);
            document.body.classList.toggle('sidebar-is-closed', !isMobileSheetOpen);
        }
    }

    function applyDesktopSidebarState() {
        if (isPhoneLayout()) {
            syncMobileSheetPresentation();
        } else if (isDesktopSidebarOpen) {
            layout.classList.remove('sidebar-closed');
            document.body.classList.remove('sidebar-is-closed');
        } else {
            layout.classList.add('sidebar-closed');
            document.body.classList.add('sidebar-is-closed');
        }

        syncToggleButton();
    }

    function focusMobileSheetTarget() {
        if (filterInput) {
            filterInput.focus();
            return;
        }

        toggleBtn?.focus();
    }

    function openMobileSheet() {
        if (!isPhoneLayout() || isMobileSheetOpen) return;

        isMobileSheetOpen = true;
        document.body.classList.add('mobile-sheet-open', 'mobile-sheet-lock');
        layout.classList.add('mobile-sheet-open');
        syncMobileSheetPresentation();
        syncMobileTrigger();
        syncToggleButton();
        focusMobileSheetTarget();
    }

    function closeMobileSheet(options = {}) {
        const { returnFocus = false } = options;
        const hadMobileSheetState = isMobileSheetOpen
            || document.body.classList.contains('mobile-sheet-open')
            || document.body.classList.contains('mobile-sheet-lock')
            || layout.classList.contains('mobile-sheet-open');

        if (!hadMobileSheetState) return;

        isMobileSheetOpen = false;
        document.body.classList.remove('mobile-sheet-open', 'mobile-sheet-lock');
        layout.classList.remove('mobile-sheet-open');
        syncMobileSheetPresentation();
        syncMobileTrigger();
        syncToggleButton();

        if (returnFocus) {
            mobileTrigger?.focus();
        }
    }

    function clearMobileSheetState() {
        if (!isMobileSheetOpen
            && !document.body.classList.contains('mobile-sheet-open')
            && !document.body.classList.contains('mobile-sheet-lock')
            && !layout.classList.contains('mobile-sheet-open')) {
            syncMobileTrigger();
            return;
        }

        isMobileSheetOpen = false;
        document.body.classList.remove('mobile-sheet-open', 'mobile-sheet-lock');
        layout.classList.remove('mobile-sheet-open');
        syncMobileSheetPresentation();
        syncMobileTrigger();
        syncToggleButton();
    }

    function closeMobileSheetFromControl(event) {
        if (!isPhoneLayout()) return;

        const isKeyboardActivation = event instanceof KeyboardEvent
            || event?.detail === 0;

        closeMobileSheet({ returnFocus: isKeyboardActivation });
    }

    function openDesktopSidebar() {
        if (isPhoneLayout()) return;

        isDesktopSidebarOpen = true;
        layout.classList.remove('sidebar-closed');
        document.body.classList.remove('sidebar-is-closed');
        localStorage.setItem(SIDEBAR_KEY, '1');
        syncToggleButton();
    }

    function closeDesktopSidebar() {
        if (isPhoneLayout()) return;

        isDesktopSidebarOpen = false;
        layout.classList.add('sidebar-closed');
        document.body.classList.add('sidebar-is-closed');
        localStorage.setItem(SIDEBAR_KEY, '0');
        syncToggleButton();
    }

    function toggleDesktopSidebar() {
        isDesktopSidebarOpen ? closeDesktopSidebar() : openDesktopSidebar();
    }

    function toggleSidebar() {
        if (isPhoneLayout()) {
            isMobileSheetOpen ? closeMobileSheet() : openMobileSheet();
            return;
        }

        toggleDesktopSidebar();
    }

    function handleBreakpointChange() {
        if (isPhoneLayout()) {
            clearMobileSheetState();
            syncMobileSheetPresentation();
        } else {
            clearMobileSheetState();
            applyDesktopSidebarState();
        }

        syncToggleButton();
    }

    applyDesktopSidebarState();
    clearMobileSheetState();
    syncMobileSheetPresentation();

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (event) => {
            if (isPhoneLayout()) {
                closeMobileSheetFromControl(event);
                return;
            }

            toggleDesktopSidebar();
        });
    }

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            if (isPhoneLayout()) return;
            openDesktopSidebar();
        });
    }

    if (mobileTrigger) {
        mobileTrigger.addEventListener('click', () => {
            if (!isPhoneLayout()) return;
            openMobileSheet();
        });
    }

    if (mobileBackdrop) {
        mobileBackdrop.addEventListener('click', () => {
            if (!isPhoneLayout()) return;
            closeMobileSheet();
        });
    }

    if (mobileHandle) {
        mobileHandle.addEventListener('click', closeMobileSheetFromControl);
    }

    if (typeof PHONE_SIDEBAR_QUERY.addEventListener === 'function') {
        PHONE_SIDEBAR_QUERY.addEventListener('change', handleBreakpointChange);
    } else if (typeof PHONE_SIDEBAR_QUERY.addListener === 'function') {
        PHONE_SIDEBAR_QUERY.addListener(handleBreakpointChange);
    }

    sidebarController = {
        closeMobileSheet,
        isPhoneLayout,
        isMobileSheetOpen: () => isMobileSheetOpen,
        toggleSidebar,
    };
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
        const divider = document.getElementById('list-divider');

        let visibleVideos  = 0;
        let visibleFolders = 0;

        // Handle root-level video items (not inside collapse-folder)
        document.querySelectorAll('#video-list > .video-item').forEach((item) => {
            const name = item.dataset.videoName || '';
            const matches = !query || name.includes(query);
            item.style.display = matches ? '' : 'none';
            if (matches) visibleVideos++;
        });

        // Handle collapsible folder groups
        document.querySelectorAll('.collapse-folder').forEach((folder) => {
            const folderName = folder.dataset.videoName || '';
            const folderMatches = !query || folderName.includes(query);

            // Check videos inside the folder
            const innerVideos = folder.querySelectorAll('.video-item');
            let anyVideoMatch = false;
            innerVideos.forEach((item) => {
                const name = item.dataset.videoName || '';
                const matches = !query || name.includes(query);
                item.style.display = matches ? '' : 'none';
                if (matches) anyVideoMatch = true;
            });

            // Show folder if its name matches OR any inner video matches
            const showFolder = folderMatches || anyVideoMatch;
            folder.style.display = showFolder ? '' : 'none';

            // If searching by folder name, show all its videos
            if (folderMatches && query) {
                innerVideos.forEach((item) => item.style.display = '');
            }

            // Auto-expand when filtering
            if (query && showFolder) {
                folder.classList.add('open');
            }

            if (showFolder) visibleFolders++;
        });

        // Hide divider when searching hides one group entirely
        if (divider) {
            divider.style.display = (visibleFolders === 0 || visibleVideos === 0) ? 'none' : '';
        }
    });
}

/* ==========================================================================
   Collapse Folder Toggle
   ========================================================================== */

function toggleCollapseFolder(headerBtn) {
    const folder = headerBtn.closest('.collapse-folder');
    if (!folder) return;

    const isOpen = folder.classList.toggle('open');
    headerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

/* ==========================================================================
   Keyboard Shortcuts
   ========================================================================== */

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (sidebarController?.isMobileSheetOpen()) {
                e.preventDefault();
                sidebarController.closeMobileSheet({ returnFocus: true });
                return;
            }

            document.activeElement?.blur();
            return;
        }

        if (isInputFocused()) return;

        // '/' — focus sidebar search
        if (e.key === '/') {
            e.preventDefault();
            if (sidebarController?.isPhoneLayout() && !sidebarController.isMobileSheetOpen()) {
                sidebarController.toggleSidebar();
            }
            const input = document.getElementById('filter-input') || document.getElementById('landing-drive-input');
            if (input) input.focus();
        }

        // '>' (Shift + .) — increase speed
        if (e.key === '>') {
            if (plyrInstance) {
                const nextOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
                const currentIndex = nextOptions.indexOf(plyrInstance.speed);
                if (currentIndex !== -1 && currentIndex < nextOptions.length - 1) {
                    plyrInstance.speed = nextOptions[currentIndex + 1];
                    showToast(`Tốc độ: ${plyrInstance.speed}x`);
                }
            }
        }

        // '<' (Shift + ,) — decrease speed
        if (e.key === '<') {
            if (plyrInstance) {
                const nextOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
                const currentIndex = nextOptions.indexOf(plyrInstance.speed);
                if (currentIndex !== -1 && currentIndex > 0) {
                    plyrInstance.speed = nextOptions[currentIndex - 1];
                    showToast(`Tốc độ: ${plyrInstance.speed}x`);
                }
            }
        }

        // 'b' — toggle sidebar
        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            sidebarController?.toggleSidebar();
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
            if (PHONE_SIDEBAR_QUERY.matches) {
                const sidebar = document.getElementById('sidebar');
                const listContainer = activeItem.closest('#video-list')
                    || activeItem.closest('.sidebar-content')
                    || sidebar;

                if (sidebar && listContainer) {
                    const containerRect = listContainer.getBoundingClientRect();
                    const itemRect = activeItem.getBoundingClientRect();
                    const offsetTop = itemRect.top - containerRect.top + listContainer.scrollTop;
                    const targetTop = offsetTop - ((listContainer.clientHeight - activeItem.offsetHeight) / 2);

                    listContainer.scrollTo({
                        top: Math.max(0, targetTop),
                        behavior: 'smooth',
                    });
                    return;
                }
            }

            activeItem.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
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

function setActivePlaybackMode(modeKey) {
    currentPlaybackMode = modeKey;
    document.querySelectorAll('.playback-switch-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.playbackMode === modeKey);
    });
}

function updatePlaybackModeBadge(modeText, rgbColor, modeKey = null) {
    const badge = document.getElementById('playback-mode-badge');
    if (!badge) return;
    badge.textContent = modeText;
    badge.style.background = `rgba(${rgbColor}, 0.15)`;
    badge.style.color = `rgb(${rgbColor})`;
    badge.style.border = `1px solid rgba(${rgbColor}, 0.25)`;
    if (modeKey) {
        setActivePlaybackMode(modeKey);
    }
}

/* ==========================================================================
   Smart Preload Next Video
   ========================================================================== */

function preloadNextVideoIfSmall() {
    // 200MB in bytes = 200 * 1024 * 1024
    const MAX_PRELOAD_SIZE = 209715200; 
    
    // Find the currently active video in the sidebar list
    const activeItem = document.querySelector('.video-item.active');
    if (!activeItem) return;

    // Find all video items to locate the next one
    const allItems = Array.from(document.querySelectorAll('.video-item'));
    const currentIndex = allItems.indexOf(activeItem);
    
    // Check if there is a next video
    if (currentIndex === -1 || currentIndex >= allItems.length - 1) return;
    
    const nextItem = allItems[currentIndex + 1];
    
    // Get size and file ID
    const rawSize = parseInt(nextItem.dataset.rawSize || '0', 10);
    const nextFileId = nextItem.dataset.videoId;
    
    if (!nextFileId) return;

    // Condition: Size > 0 AND Size <= 200MB
    if (rawSize > 0 && rawSize <= MAX_PRELOAD_SIZE) {
        console.log(`[DrivePlayers] Preloading next video (Size: ${(rawSize / 1024 / 1024).toFixed(1)} MB)...`);
        
        // We use an invisible native <video> tag with preload="auto" to trigger browser caching
        // Ensure we retrieve the API KEY from the existing source
        const currentVideoEl = document.getElementById('plyr-player');
        if (!currentVideoEl) return;
        
        const currentSrc = (currentVideoEl.querySelector?.('source') || currentVideoEl).getAttribute?.('src') || '';
        const match = currentSrc.match(/key=([^&]+)/);
        const apiKey = match ? match[1] : '';
        
        if (!apiKey) return;
        
        const preloadUrl = `https://www.googleapis.com/drive/v3/files/${nextFileId}?alt=media&key=${apiKey}`;
        
        const preloader = document.createElement('video');
        preloader.preload = 'auto'; // Try to download metadata and some chunks
        preloader.muted = true;
        preloader.style.display = 'none';
        preloader.src = preloadUrl;
        
        document.body.appendChild(preloader);
    } else {
        console.log(`[DrivePlayers] Skip preloading next video (Size: ${(rawSize / 1024 / 1024).toFixed(1)} MB - exceeds 200MB limit or unknown)`);
    }
}
