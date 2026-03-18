<?php
/**
 * Drive API Helper - Fetch files from Google Drive folder
 * Uses Google Drive API v3 with API key (no OAuth needed)
 * 
 * To get an API key:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a project (or select existing)
 * 3. Enable "Google Drive API" 
 * 4. Go to Credentials → Create Credentials → API Key
 * 5. Copy the key to config.php
 */

require_once __DIR__ . '/config.php';

/**
 * Fetch videos for each immediate subfolder of the current folder.
 */
function fetchSubfolderVideoGroupsFromDriveAPI($subfolders) {
    $groupedVideos = [];

    foreach ($subfolders as $subfolder) {
        $subfolderId = $subfolder['id'] ?? '';
        if ($subfolderId === '') {
            continue;
        }

        $result = fetchVideosFromDriveAPI($subfolderId);
        $groupedVideos[$subfolderId] = $result['success'] ? $result['videos'] : [];
    }

    return $groupedVideos;
}

/**
 * Fetch video files from a Google Drive folder using the API
 */
function fetchVideosFromDriveAPI($folderId) {
    $apiKey = defined('GOOGLE_API_KEY') ? GOOGLE_API_KEY : '';
    
    if (empty($apiKey)) {
        return [
            'success' => false,
            'error' => 'Chưa cấu hình Google API Key. Vui lòng xem hướng dẫn trong file config.php',
            'videos' => []
        ];
    }
    
    $videos = [];
    $pageToken = '';
    
    // Video MIME types
    $mimeQuery = implode(' or ', [
        "mimeType='video/mp4'",
        "mimeType='video/x-msvideo'",
        "mimeType='video/x-matroska'",
        "mimeType='video/quicktime'",
        "mimeType='video/webm'",
        "mimeType='video/x-m4v'",
    ]);
    
    $query = "'{$folderId}' in parents and ({$mimeQuery}) and trashed=false";
    
    do {
        $params = http_build_query([
            'q' => $query,
            'key' => $apiKey,
            'fields' => 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,videoMediaMetadata)',
            'pageSize' => 100,
            'orderBy' => 'name',
            'pageToken' => $pageToken,
            'supportsAllDrives' => 'true',
            'includeItemsFromAllDrives' => 'true',
        ]);
        
        $url = "https://www.googleapis.com/drive/v3/files?" . $params;
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
            ],
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMessage = $errorData['error']['message'] ?? 'Lỗi không xác định';
            
            if ($httpCode === 403) {
                $errorMessage = 'API Key không có quyền truy cập. Hãy đảm bảo đã bật Google Drive API và thư mục được chia sẻ công khai.';
            } elseif ($httpCode === 404) {
                $errorMessage = 'Không tìm thấy thư mục. Hãy kiểm tra lại link Google Drive.';
            }
            
            return [
                'success' => false,
                'error' => $errorMessage,
                'videos' => []
            ];
        }
        
        $data = json_decode($response, true);
        
        if (!$data || !isset($data['files'])) {
            return [
                'success' => false,
                'error' => 'Không thể đọc dữ liệu từ Google Drive API',
                'videos' => []
            ];
        }
        
        foreach ($data['files'] as $file) {
            $duration = '';
            if (isset($file['videoMediaMetadata']['durationMillis'])) {
                $totalSeconds = (int) round((float) $file['videoMediaMetadata']['durationMillis'] / 1000);
                $hours   = intdiv($totalSeconds, 3600);
                $minutes = intdiv($totalSeconds % 3600, 60);
                $seconds = $totalSeconds % 60;

                if ($hours > 0) {
                    $duration = sprintf('%d:%02d:%02d', $hours, $minutes, $seconds);
                } else {
                    $duration = sprintf('%d:%02d', $minutes, $seconds);
                }
            }
            
            $resolution = '';
            if (isset($file['videoMediaMetadata']['width']) && isset($file['videoMediaMetadata']['height'])) {
                $height = $file['videoMediaMetadata']['height'];
                if ($height >= 2160) $resolution = '4K';
                elseif ($height >= 1440) $resolution = '1440p';
                elseif ($height >= 1080) $resolution = '1080p';
                elseif ($height >= 720) $resolution = '720p';
                elseif ($height >= 480) $resolution = '480p';
                else $resolution = $height . 'p';
            }
            
            $fileSize = '';
            $rawSize = 0;
            if (isset($file['size'])) {
                $bytes = intval($file['size']);
                $rawSize = $bytes;
                if ($bytes >= 1073741824) {
                    $fileSize = round($bytes / 1073741824, 1) . ' GB';
                } elseif ($bytes >= 1048576) {
                    $fileSize = round($bytes / 1048576, 1) . ' MB';
                } else {
                    $fileSize = round($bytes / 1024) . ' KB';
                }
            }
            
            $videos[] = [
                'id' => $file['id'],
                'name' => $file['name'],
                'mimeType' => $file['mimeType'],
                'size' => $fileSize,
                'rawSize' => $rawSize,
                'duration' => $duration,
                'resolution' => $resolution,
                'thumbnail' => $file['thumbnailLink'] ?? "https://drive.google.com/thumbnail?id=" . $file['id'] . "&sz=w320",
                'embed' => "https://drive.google.com/file/d/" . $file['id'] . "/preview",
                'download' => "https://drive.google.com/uc?id=" . $file['id'] . "&export=download",
                'createdTime' => $file['createdTime'] ?? '',
                'modifiedTime' => $file['modifiedTime'] ?? '',
            ];
        }
        
        $pageToken = $data['nextPageToken'] ?? '';
        
    } while (!empty($pageToken));
    
    // Empty video list is OK — folder may contain only subfolders
    
    return [
        'success' => true,
        'videos' => $videos,
        'error' => ''
    ];
}

/**
 * Fetch subfolders from a Google Drive folder
 */
function fetchSubfoldersFromDriveAPI($folderId) {
    $apiKey = defined('GOOGLE_API_KEY') ? GOOGLE_API_KEY : '';
    if (empty($apiKey)) return [];

    $query = "'{$folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false";

    $params = http_build_query([
        'q'                         => $query,
        'key'                       => $apiKey,
        'fields'                    => 'files(id,name)',
        'pageSize'                  => 200,
        'orderBy'                   => 'name',
        'supportsAllDrives'         => 'true',
        'includeItemsFromAllDrives' => 'true',
    ]);

    $url = "https://www.googleapis.com/drive/v3/files?" . $params;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) return [];

    $data = json_decode($response, true);
    return $data['files'] ?? [];
}

/**
 * Fetch the display name of a single folder by ID
 */
function fetchFolderName($folderId) {
    $apiKey = defined('GOOGLE_API_KEY') ? GOOGLE_API_KEY : '';
    if (empty($apiKey) || empty($folderId)) return null;

    $params = http_build_query([
        'key'                       => $apiKey,
        'fields'                    => 'name',
        'supportsAllDrives'         => 'true',
        'includeItemsFromAllDrives' => 'true',
    ]);

    $url = "https://www.googleapis.com/drive/v3/files/" . urlencode($folderId) . "?" . $params;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) return null;

    $data = json_decode($response, true);
    return $data['name'] ?? null;
}
