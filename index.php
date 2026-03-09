<?php
/**
 * Drive Players - Google Drive Video Player
 * Version: 2.2.0
 *
 * A simple video player that loads video list from Google Drive folder
 * Uses Google Drive API v3 with API Key (no OAuth login required)
 * Supports nested subfolder navigation with breadcrumb trail
 * Video playback powered by Plyr.io
 */

define('APP_VERSION', '2.3.0');

session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/drive-api.php';

// -------------------------------------------------------
// Handle POST: new drive URL submitted
// -------------------------------------------------------
if (isset($_POST['drive_url']) && !empty(trim($_POST['drive_url']))) {
    $folderId = extractFolderId($_POST['drive_url']);
    if ($folderId) {
        // Reset everything and start fresh
        $_SESSION['root_folder_id']   = $folderId;
        $_SESSION['drive_url']        = trim($_POST['drive_url']);
        $_SESSION['breadcrumb']       = [['id' => $folderId, 'name' => 'Root']];
        $_SESSION['folder_id']        = $folderId;
        header('Location: index.php');
        exit;
    }
}

// -------------------------------------------------------
// Navigate into a subfolder
// -------------------------------------------------------
if (isset($_GET['folder']) && !empty($_GET['folder'])) {
    $newFolderId   = $_GET['folder'];
    $newFolderName = $_GET['fname'] ?? 'Thư mục';

    // Init breadcrumb if missing
    if (!isset($_SESSION['breadcrumb'])) {
        $_SESSION['breadcrumb'] = [['id' => $newFolderId, 'name' => 'Root']];
    }

    // Check if navigating back to an existing crumb
    $existingIndex = null;
    foreach ($_SESSION['breadcrumb'] as $i => $crumb) {
        if ($crumb['id'] === $newFolderId) {
            $existingIndex = $i;
            break;
        }
    }
    if ($existingIndex !== null) {
        // Trim breadcrumb back to that point
        $_SESSION['breadcrumb'] = array_slice($_SESSION['breadcrumb'], 0, $existingIndex + 1);
    } else {
        // Push new crumb
        $_SESSION['breadcrumb'][] = ['id' => $newFolderId, 'name' => $newFolderName];
    }
    $_SESSION['folder_id'] = $newFolderId;

    header('Location: index.php');
    exit;
}

// -------------------------------------------------------
// Clear session (go back to home / URL input)
// -------------------------------------------------------
if (isset($_GET['clear'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

// -------------------------------------------------------
// Resolve current state
// -------------------------------------------------------
$folderId    = $_SESSION['folder_id']    ?? null;
$driveUrl    = $_SESSION['drive_url']    ?? '';
$breadcrumb  = $_SESSION['breadcrumb']  ?? [];
$rootId      = $_SESSION['root_folder_id'] ?? $folderId;
$videos      = [];
$subfolders  = [];
$error       = '';
$currentVideo = null;
$hasApiKey   = defined('GOOGLE_API_KEY') && !empty(GOOGLE_API_KEY);

if ($folderId && $hasApiKey) {
    $cacheFile = getCacheFile($folderId);
    $cached    = loadCache($cacheFile);

    if ($cached !== false) {
        $videos     = $cached['videos'];
        $subfolders = $cached['subfolders'] ?? [];
    } else {
        $result = fetchVideosFromDriveAPI($folderId);
        if ($result['success']) {
            $videos     = $result['videos'];
            $subfolders = fetchSubfoldersFromDriveAPI($folderId);
            saveCache($cacheFile, ['videos' => $videos, 'subfolders' => $subfolders]);
        } else {
            $error = $result['error'];
        }
    }

    // If root folder name is still "Root", try to update it
    if (!empty($breadcrumb) && $breadcrumb[0]['name'] === 'Root') {
        $rootName = fetchFolderName($rootId);
        if ($rootName) {
            $_SESSION['breadcrumb'][0]['name'] = $rootName;
            $breadcrumb[0]['name'] = $rootName;
        }
    }
} elseif ($folderId && !$hasApiKey) {
    $error = 'Chưa cấu hình Google API Key. Vui lòng mở file config.php và nhập API Key của bạn.';
}

// Select current video
$currentVideoId = $_GET['v'] ?? null;
if ($currentVideoId) {
    foreach ($videos as $v) {
        if ($v['id'] === $currentVideoId) {
            $currentVideo = $v;
            break;
        }
    }
}
if (!$currentVideo && !empty($videos)) {
    $currentVideo = $videos[0];
}

// Current folder label
$currentFolderName = !empty($breadcrumb) ? end($breadcrumb)['name'] : 'Drive Players';

// -------------------------------------------------------
// Helper functions
// -------------------------------------------------------
function extractFolderId($url) {
    $url = trim($url);
    if (preg_match('/^[a-zA-Z0-9_-]{20,}$/', $url)) return $url;
    if (preg_match('/folders\/([a-zA-Z0-9_-]+)/', $url, $m)) return $m[1];
    if (preg_match('/[?&]id=([a-zA-Z0-9_-]+)/', $url, $m)) return $m[1];
    return null;
}

function getCacheFile($folderId) {
    if (!defined('CACHE_DIR') || !defined('CACHE_DURATION') || CACHE_DURATION <= 0) return null;
    if (!is_dir(CACHE_DIR)) @mkdir(CACHE_DIR, 0755, true);
    return CACHE_DIR . '/' . md5($folderId) . '.json';
}

function loadCache($cacheFile) {
    if (!$cacheFile || !file_exists($cacheFile)) return false;
    if (time() - filemtime($cacheFile) > CACHE_DURATION) { @unlink($cacheFile); return false; }
    $data = @file_get_contents($cacheFile);
    return $data ? json_decode($data, true) : false;
}

function saveCache($cacheFile, $data) {
    if (!$cacheFile) return;
    @file_put_contents($cacheFile, json_encode($data, JSON_UNESCAPED_UNICODE));
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $currentVideo ? htmlspecialchars(pathinfo($currentVideo['name'], PATHINFO_FILENAME)) . ' - ' : ''; ?>DrivePlayers - Xem video Google Drive không giới hạn</title>
    <meta name="description" content="DrivePlayers là trình phát video mã nguồn mở, hỗ trợ xem trực tiếp video từ Google Drive với giao diện chuyên nghiệp, tốc độ cao, hỗ trợ phụ đề, picture-in-picture và shortcut bàn phím.">
    <meta name="keywords" content="từ khoá Google Drive Player, video player Google Drive, trình xem video Drive, Plyr Google Drive, API Drive Video">
    <meta name="robots" content="index, follow">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://drive-player.example.com">
    <meta property="og:title" content="<?php echo $currentVideo ? htmlspecialchars(pathinfo($currentVideo['name'], PATHINFO_FILENAME)) . ' - ' : ''; ?>DrivePlayers - Xem video Google Drive cực mượt">
    <meta property="og:description" content="Trình phát video mượt mà, hỗ trợ giao diện bóng bẩy như YouTube dành riêng cho thư mục Google Drive của bạn.">
    <meta property="og:image" content="assets/og-image.png">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:title" content="DrivePlayers - Xem video Google Drive cực mượt">
    <meta property="twitter:description" content="Trình phát video mượt mà, hỗ trợ giao diện bóng bẩy như YouTube dành riêng cho thư mục Google Drive của bạn.">
    <meta property="twitter:image" content="assets/og-image.png">

    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
    <link rel="stylesheet" href="style.css?v=<?php echo APP_VERSION; ?>">
</head>
<body>
    <!-- ===== HEADER ===== -->
    <header class="header" id="main-header">
        <div class="header-left">
            <button class="menu-toggle" id="menu-toggle" aria-label="Toggle sidebar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <a href="index.php?clear=1" class="logo" id="logo-link">
                <div class="logo-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M5 3l14 9-14 9V3z" fill="url(#grad1)"/>
                        <defs>
                            <linearGradient id="grad1" x1="5" y1="3" x2="19" y2="12">
                                <stop offset="0%" style="stop-color:#ff6b6b"/>
                                <stop offset="100%" style="stop-color:#ee5a24"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <span class="logo-text">Drive<span class="logo-accent">Players</span></span>
                <span class="logo-version">v<?php echo APP_VERSION; ?></span>
            </a>
        </div>

        <form class="search-bar" id="search-form" method="POST" action="index.php">
            <div class="search-input-wrapper">
                <input
                    type="text"
                    name="drive_url"
                    id="drive-url-input"
                    class="search-input"
                    placeholder="Dán link Google Drive folder tại đây..."
                    value="<?php echo htmlspecialchars($driveUrl); ?>"
                    autocomplete="off"
                >
                <button type="submit" class="search-btn" id="search-btn" aria-label="Load videos">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                </button>
            </div>
        </form>

        <div class="header-right">
            <?php if (!empty($videos) || !empty($subfolders)): ?>
            <span class="video-count" id="video-count">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <?php echo count($videos); ?> video<?php if (!empty($subfolders)): ?> · <?php echo count($subfolders); ?> thư mục<?php endif; ?>
            </span>
            <?php endif; ?>
        </div>
    </header>

    <main class="main-content <?php echo $folderId ? 'has-videos' : ''; ?>" id="main-content">

        <?php if (!$folderId): ?>
        <!-- ============================= LANDING ============================= -->
        <section class="landing" id="landing-section">
            <div class="landing-content">
                <div class="landing-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                        <path d="M5 3l14 9-14 9V3z" fill="url(#grad2)" opacity="0.9"/>
                        <defs>
                            <linearGradient id="grad2" x1="5" y1="3" x2="19" y2="12">
                                <stop offset="0%" style="stop-color:#ff6b6b"/>
                                <stop offset="100%" style="stop-color:#ee5a24"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <h1 class="landing-title">Drive<span class="text-accent">Players</span></h1>
                <span class="landing-version">v<?php echo APP_VERSION; ?></span>
                <p class="landing-subtitle">Xem video từ Google Drive với giao diện đẹp như YouTube</p>

                <?php if (!$hasApiKey): ?>
                <div class="api-key-notice" id="api-key-notice">
                    <div class="notice-icon">🔑</div>
                    <div class="notice-content">
                        <strong>Cần cấu hình API Key</strong>
                        <p>Mở file <code>config.php</code> và nhập Google API Key của bạn. API Key miễn phí, xem hướng dẫn trong file.</p>
                    </div>
                </div>
                <?php endif; ?>

                <form class="landing-form" id="landing-form" method="POST" action="index.php">
                    <div class="landing-input-group">
                        <input
                            type="text"
                            name="drive_url"
                            id="landing-drive-input"
                            class="landing-input"
                            placeholder="Dán link Google Drive folder..."
                            required
                            autocomplete="off"
                        >
                        <button type="submit" class="landing-submit" id="landing-submit-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                            <span>Xem Video</span>
                        </button>
                    </div>
                </form>

                <div class="landing-hints">
                    <div class="hint-card" id="hint-1">
                        <div class="hint-icon">📁</div>
                        <div class="hint-text">
                            <strong>Bước 1</strong>
                            <span>Mở thư mục video trên Google Drive</span>
                        </div>
                    </div>
                    <div class="hint-card" id="hint-2">
                        <div class="hint-icon">🔗</div>
                        <div class="hint-text">
                            <strong>Bước 2</strong>
                            <span>Copy link chia sẻ thư mục</span>
                        </div>
                    </div>
                    <div class="hint-card" id="hint-3">
                        <div class="hint-icon">▶️</div>
                        <div class="hint-text">
                            <strong>Bước 3</strong>
                            <span>Dán link và bắt đầu xem!</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <?php elseif ($error): ?>
        <!-- ============================= ERROR ============================= -->
        <section class="error-section" id="error-section">
            <div class="error-content">
                <div class="error-icon">⚠️</div>
                <h2>Không thể tải danh sách</h2>
                <p class="error-message"><?php echo htmlspecialchars($error); ?></p>
                <div class="error-actions">
                    <a href="index.php?clear=1" class="btn-retry" id="btn-retry">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="1 4 1 10 7 10"></polyline>
                            <path d="M3.51 15a9 9 0 102.13-9.36L1 10"></path>
                        </svg>
                        Thử lại
                    </a>
                </div>
            </div>
        </section>

        <?php else: ?>
        <!-- ============================= PLAYER LAYOUT ============================= -->
        <div class="player-layout" id="player-layout">

            <!-- ---- Main Player ---- -->
            <div class="player-main" id="player-main">

                <!-- Breadcrumb -->
                <?php if (!empty($breadcrumb)): ?>
                <nav class="breadcrumb" id="breadcrumb" aria-label="Breadcrumb">
                    <a href="index.php?clear=1" class="bc-home" title="Trang chủ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    </a>
                    <?php foreach ($breadcrumb as $i => $crumb):
                        $isLast = ($i === count($breadcrumb) - 1);
                    ?>
                    <span class="bc-sep">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>
                    <?php if ($isLast): ?>
                        <span class="bc-current"><?php echo htmlspecialchars($crumb['name']); ?></span>
                    <?php else: ?>
                        <a href="?folder=<?php echo urlencode($crumb['id']); ?>&fname=<?php echo urlencode($crumb['name']); ?>" class="bc-link">
                            <?php echo htmlspecialchars($crumb['name']); ?>
                        </a>
                    <?php endif; ?>
                    <?php endforeach; ?>
                </nav>
                <?php endif; ?>

                <!-- Video Player -->
                <div class="video-container" id="video-container">
                    <?php if ($currentVideo): ?>
                    <video
                        id="plyr-player"
                        playsinline
                        controls
                        crossorigin
                        data-poster="<?php echo htmlspecialchars($currentVideo['thumbnail']); ?>"
                    >
                        <source
                            src="https://www.googleapis.com/drive/v3/files/<?php echo urlencode($currentVideo['id']); ?>?alt=media&key=<?php echo urlencode(GOOGLE_API_KEY); ?>"
                            type="<?php echo htmlspecialchars($currentVideo['mimeType']); ?>"
                        />
                    </video>
                    <?php elseif (empty($videos) && !empty($subfolders)): ?>
                    <!-- Folder-only view: no videos here -->
                    <div class="folder-only-placeholder">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"></path></svg>
                        <p>Thư mục này không chứa video trực tiếp.<br>Chọn thư mục con bên dưới để xem video.</p>
                    </div>
                    <?php endif; ?>
                </div>

                <?php if ($currentVideo): ?>
                <!-- Video Info -->
                <div class="video-info" id="video-info">
                    <h1 class="video-title" id="video-title"><?php echo htmlspecialchars(pathinfo($currentVideo['name'], PATHINFO_FILENAME)); ?></h1>
                    <div class="video-meta">
                        <?php if ($currentVideo['resolution']): ?>
                        <span class="meta-badge quality"><?php echo $currentVideo['resolution']; ?></span>
                        <?php endif; ?>
                        <?php if ($currentVideo['duration']): ?>
                        <span class="meta-badge duration">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            <?php echo $currentVideo['duration']; ?>
                        </span>
                        <?php endif; ?>
                        <?php if ($currentVideo['size']): ?>
                        <span class="meta-badge size"><?php echo $currentVideo['size']; ?></span>
                        <?php endif; ?>
                        <span class="meta-badge ext"><?php echo strtoupper(pathinfo($currentVideo['name'], PATHINFO_EXTENSION)); ?></span>
                    </div>
                    <div class="video-actions">
                        <a href="<?php echo $currentVideo['download']; ?>" class="btn-action" id="btn-download" target="_blank" rel="noopener">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            <span>Tải xuống</span>
                        </a>
                        <button class="btn-action" id="btn-copy-link" onclick="copyVideoLink('<?php echo $currentVideo['id']; ?>')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>
                            <span>Copy Link</span>
                        </button>
                        <a href="https://drive.google.com/file/d/<?php echo $currentVideo['id']; ?>/view" class="btn-action" id="btn-open-drive" target="_blank" rel="noopener">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                            <span>Mở Drive</span>
                        </a>
                    </div>
                </div>
                <?php endif; ?>
            </div>

            <!-- ========================================================= -->
            <!-- SIDEBAR                                                    -->
            <!-- ========================================================= -->
            <aside class="sidebar" id="sidebar">
                <!-- Sidebar header -->
                <div class="sidebar-header">
                    <?php if (count($breadcrumb) > 1):
                        $parentCrumb = $breadcrumb[count($breadcrumb) - 2];
                    ?>
                    <a href="?folder=<?php echo urlencode($parentCrumb['id']); ?>&fname=<?php echo urlencode($parentCrumb['name']); ?>"
                       class="sidebar-back" id="sidebar-back" title="Quay lại">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </a>
                    <?php endif; ?>
                    <div class="sidebar-title-wrap">
                        <h2 class="sidebar-title">
                            <?php if (!empty($subfolders) && empty($videos)): ?>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"></path></svg>
                            <?php else: ?>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            <?php endif; ?>
                            <span class="sidebar-folder-name"><?php echo htmlspecialchars($currentFolderName); ?></span>
                        </h2>
                        <span class="sidebar-count">
                            <?php
                                $parts = [];
                                if (!empty($videos)) $parts[] = count($videos) . ' video';
                                if (!empty($subfolders)) $parts[] = count($subfolders) . ' thư mục';
                                echo implode(' · ', $parts) ?: 'Trống';
                            ?>
                        </span>
                    </div>
                </div>

                <!-- Filter -->
                <?php if (!empty($videos) || !empty($subfolders)): ?>
                <div class="sidebar-search">
                    <input
                        type="text"
                        id="filter-input"
                        class="filter-input"
                        placeholder="Tìm kiếm... (nhấn /)"
                        autocomplete="off"
                    >
                </div>
                <?php endif; ?>

                <!-- Combined list: subfolders then videos -->
                <div class="video-list" id="video-list">

                    <!-- Subfolder items -->
                    <?php foreach ($subfolders as $idx => $folder): ?>
                    <a
                        href="?folder=<?php echo urlencode($folder['id']); ?>&fname=<?php echo urlencode($folder['name']); ?>"
                        class="folder-item"
                        id="folder-item-<?php echo $idx; ?>"
                        data-video-name="<?php echo htmlspecialchars(strtolower($folder['name'])); ?>"
                    >
                        <div class="folder-item-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" fill="rgba(255,107,107,0.12)" stroke="#ff6b6b"></path>
                            </svg>
                        </div>
                        <div class="folder-item-info">
                            <span class="folder-item-name"><?php echo htmlspecialchars($folder['name']); ?></span>
                            <span class="folder-item-type">Thư mục</span>
                        </div>
                        <div class="folder-item-arrow">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </a>
                    <?php endforeach; ?>

                    <!-- Divider between folders and videos -->
                    <?php if (!empty($subfolders) && !empty($videos)): ?>
                    <div class="list-divider" id="list-divider">
                        <span>Video trong thư mục này</span>
                    </div>
                    <?php endif; ?>

                    <!-- Video items -->
                    <?php foreach ($videos as $index => $video):
                        $isActive = $currentVideo && $currentVideo['id'] === $video['id'];
                    ?>
                    <a
                        href="?v=<?php echo urlencode($video['id']); ?>"
                        class="video-item <?php echo $isActive ? 'active' : ''; ?>"
                        id="video-item-<?php echo $index; ?>"
                        data-video-id="<?php echo htmlspecialchars($video['id']); ?>"
                        data-video-name="<?php echo htmlspecialchars(strtolower($video['name'])); ?>"
                    >
                        <div class="video-item-index">
                            <?php if ($isActive): ?>
                                <div class="playing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            <?php else: ?>
                                <?php echo $index + 1; ?>
                            <?php endif; ?>
                        </div>
                        <div class="video-item-thumb">
                            <img
                                src="<?php echo htmlspecialchars($video['thumbnail']); ?>"
                                alt="<?php echo htmlspecialchars($video['name']); ?>"
                                loading="lazy"
                                onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%2290%22><rect fill=%22%23282828%22 width=%22160%22 height=%2290%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23666%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22>🎬</text></svg>'"
                            >
                            <?php if ($video['duration']): ?>
                            <span class="thumb-duration"><?php echo $video['duration']; ?></span>
                            <?php endif; ?>
                            <div class="thumb-play-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>
                        <div class="video-item-info">
                            <h3 class="video-item-title"><?php echo htmlspecialchars(pathinfo($video['name'], PATHINFO_FILENAME)); ?></h3>
                            <div class="video-item-meta">
                                <?php if ($video['resolution']): ?>
                                <span class="item-resolution"><?php echo $video['resolution']; ?></span>
                                <?php endif; ?>
                                <?php if ($video['size']): ?>
                                <span class="item-size"><?php echo $video['size']; ?></span>
                                <?php endif; ?>
                            </div>
                        </div>
                    </a>
                    <?php endforeach; ?>

                    <?php if (empty($videos) && empty($subfolders)): ?>
                    <div class="empty-folder">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"></path></svg>
                        <p>Thư mục trống</p>
                    </div>
                    <?php endif; ?>
                </div>
            </aside>
        </div>
        <?php endif; ?>
    </main>

    <!-- Toast -->
    <div class="toast" id="toast"><span id="toast-message"></span></div>

    <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
    <script src="app.js?v=<?php echo APP_VERSION; ?>"></script>
</body>
</html>
