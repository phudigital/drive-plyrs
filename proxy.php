<?php
/**
 * Drive Players - Video Proxy Stream
 * Version: 2.9.1
 *
 * Streams a Google Drive video through this server.
 * This bypasses CORS and client-side blocks on the Drive API.
 *
 * Usage: proxy.php?id=GOOGLE_DRIVE_FILE_ID
 *
 * IMPORTANT: Only works if the file is publicly shared (Anyone with the link).
 * The proxy will forward Range requests so seeking works correctly.
 */

require_once __DIR__ . '/config.php';

// -------------------------------------------------------
// Input validation
// -------------------------------------------------------
$fileId = isset($_GET['id']) ? trim($_GET['id']) : '';

if (!preg_match('/^[a-zA-Z0-9_-]{10,}$/', $fileId)) {
    http_response_code(400);
    exit('Invalid file ID');
}

$apiKey = defined('GOOGLE_API_KEY') ? GOOGLE_API_KEY : '';
if (empty($apiKey)) {
    http_response_code(503);
    exit('API key not configured');
}

// -------------------------------------------------------
// Build the Google Drive streaming URL
// -------------------------------------------------------
$driveUrl = "https://www.googleapis.com/drive/v3/files/{$fileId}?alt=media&key=" . urlencode($apiKey);

// -------------------------------------------------------
// Forward Range header for seekable streaming
// -------------------------------------------------------
$requestHeaders = [];
if (isset($_SERVER['HTTP_RANGE'])) {
    $requestHeaders[] = 'Range: ' . $_SERVER['HTTP_RANGE'];
}
$requestHeaders[] = 'Accept: */*';

// -------------------------------------------------------
// Open a cURL stream to Google Drive
// -------------------------------------------------------
$ch = curl_init($driveUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_HEADER         => false,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER     => $requestHeaders,
    CURLOPT_BUFFERSIZE     => 131072, // 128 KB chunks
    CURLOPT_HEADERFUNCTION => function($ch, $headerLine) {
        // Forward specific response headers from Google to the browser
        $header = trim($headerLine);
        if (empty($header)) return strlen($headerLine);

        $lower = strtolower($header);

        // Forward content-type, content-length, content-range, accept-ranges
        $forwardPrefixes = ['content-type:', 'content-length:', 'content-range:', 'accept-ranges:'];
        foreach ($forwardPrefixes as $prefix) {
            if (str_starts_with($lower, $prefix)) {
                header($header, true);
                break;
            }
        }

        // Forward 206 Partial Content status
        if (str_starts_with($lower, 'http/') && str_contains($lower, ' 206 ')) {
            http_response_code(206);
        }

        return strlen($headerLine);
    },
    CURLOPT_WRITEFUNCTION  => function($ch, $data) {
        echo $data;
        // Flush output to browser in chunks
        if (ob_get_level()) ob_flush();
        flush();
        return strlen($data);
    },
]);

// -------------------------------------------------------
// Set response headers
// -------------------------------------------------------
header('Access-Control-Allow-Origin: *');
header('Access-Control-Expose-Headers: Content-Length, Content-Type, Content-Range, Accept-Ranges');
header('Cache-Control: no-store');
header('X-Proxy: DrivePlayers');

// Default content type (will be overridden by cURL headerFunction if Drive sends one)
header('Content-Type: video/mp4');

// -------------------------------------------------------
// Send the stream
// -------------------------------------------------------
$result  = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// If Google returns an error, show it
if ($result === false || ($httpCode !== 200 && $httpCode !== 206)) {
    if ($httpCode === 403) {
        http_response_code(403);
        exit('Access denied: File may not be publicly shared or API quota exceeded');
    } elseif ($httpCode === 404) {
        http_response_code(404);
        exit('File not found');
    } elseif ($httpCode === 429) {
        http_response_code(429);
        exit('Rate limited by Google Drive API');
    } else {
        http_response_code(502);
        exit("Google Drive returned HTTP {$httpCode}");
    }
}
