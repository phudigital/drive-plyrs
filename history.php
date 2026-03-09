<?php
/**
 * Drive Players - Watch History Manager
 * Lưu lịch sử xem video theo IP (hash SHA-256), cache 48 giờ
 */

define('HISTORY_DIR',      CACHE_DIR . '/history');
define('HISTORY_TTL',      48 * 3600); // 48 giờ
define('HISTORY_MAX',      50);         // Tối đa 50 mục mỗi IP

/**
 * Lấy IP hash (ẩn danh) của người dùng
 */
function getIpHash(): string {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP']      // Cloudflare
       ?? $_SERVER['HTTP_X_FORWARDED_FOR']
       ?? $_SERVER['REMOTE_ADDR']
       ?? 'unknown';

    // Chỉ lấy IP đầu tiên nếu danh sách
    $ip = trim(explode(',', $ip)[0]);

    // Băm SHA-256 — không lưu IP thật
    return hash('sha256', $ip . 'dp-salt-2024');
}

/**
 * Lấy đường dẫn file history của IP hiện tại
 */
function getHistoryFile(): string {
    if (!is_dir(HISTORY_DIR)) {
        @mkdir(HISTORY_DIR, 0755, true);
    }
    return HISTORY_DIR . '/' . getIpHash() . '.json';
}

/**
 * Đọc lịch sử xem (lọc bỏ entries đã hết hạn)
 */
function loadHistory(): array {
    $file = getHistoryFile();
    if (!file_exists($file)) return [];

    $data = @json_decode(file_get_contents($file), true);
    if (!is_array($data)) return [];

    $now = time();
    // Lọc bỏ entries quá 48h
    $data = array_filter($data, fn($item) => isset($item['time']) && ($now - $item['time']) < HISTORY_TTL);

    return array_values($data);
}

/**
 * Lưu một mục vào lịch sử xem
 */
function saveHistory(array $video, string $folderId, string $folderName): void {
    $history = loadHistory();
    $now     = time();

    // Xoá entry cũ của cùng video nếu đã có
    $history = array_filter($history, fn($item) => $item['video_id'] !== $video['id']);
    $history = array_values($history);

    // Thêm vào đầu
    array_unshift($history, [
        'video_id'    => $video['id'],
        'video_name'  => $video['name'],
        'duration'    => $video['duration']    ?? '',
        'resolution'  => $video['resolution']  ?? '',
        'size'        => $video['size']        ?? '',
        'folder_id'   => $folderId,
        'folder_name' => $folderName,
        'time'        => $now,
    ]);

    // Giới hạn số lượng history
    $history = array_slice($history, 0, HISTORY_MAX);

    @file_put_contents(getHistoryFile(), json_encode($history, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

/**
 * Format thời gian tương đối (vd: "2 giờ trước")
 */
function timeAgo(int $timestamp): string {
    $diff = time() - $timestamp;
    if ($diff < 60)        return 'Vừa xong';
    if ($diff < 3600)      return intdiv($diff, 60) . ' phút trước';
    if ($diff < 86400)     return intdiv($diff, 3600) . ' giờ trước';
    return intdiv($diff, 86400) . ' ngày trước';
}

/**
 * Xoá toàn bộ lịch sử của IP hiện tại
 */
function clearHistory(): void {
    $file = getHistoryFile();
    if (file_exists($file)) @unlink($file);
}
