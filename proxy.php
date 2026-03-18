<?php
/**
 * Drive Players - Video Proxy Stream
 * Version: 2.9.2
 *
 * Streams a Google Drive video through this server.
 * This bypasses CORS and client-side blocks on the Drive API.
 *
 * Usage: proxy.php?id=GOOGLE_DRIVE_FILE_ID
 *
 * IMPORTANT: Only works if the file is publicly shared (Anyone with the link).
 * The proxy will forward Range requests so seeking works correctly.
 */

// -------------------------------------------------------
// Input validation
// -------------------------------------------------------
$fileId = isset($_GET['id']) ? trim($_GET['id']) : '';

if (!preg_match('/^[a-zA-Z0-9_-]{10,}$/', $fileId)) {
    http_response_code(400);
    exit('Invalid file ID');
}

// -------------------------------------------------------
// Build the Google Drive public download URL
// -------------------------------------------------------
$driveUrl = "https://drive.usercontent.google.com/download?id={$fileId}&export=download";
$cookieFile = tempnam(sys_get_temp_dir(), 'dp-cookie-');
if ($cookieFile === false) {
    http_response_code(500);
    exit('Cannot create temp cookie file');
}

// -------------------------------------------------------
// Probe the public download page to extract confirm tokens for large files
// -------------------------------------------------------
$probe = curl_init($driveUrl);
curl_setopt_array($probe, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER         => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_COOKIEJAR      => $cookieFile,
    CURLOPT_COOKIEFILE     => $cookieFile,
    CURLOPT_USERAGENT      => 'Mozilla/5.0 (DrivePlayers Proxy)',
    CURLOPT_HTTPHEADER     => [
        'Accept: */*',
        'Range: bytes=0-0',
    ],
]);

$probeResponse = curl_exec($probe);
$probeCode = curl_getinfo($probe, CURLINFO_HTTP_CODE);
$probeHeaderSize = curl_getinfo($probe, CURLINFO_HEADER_SIZE);
$probeError = curl_error($probe);
curl_close($probe);

if ($probeResponse === false || $probeCode < 200 || $probeCode >= 400) {
    @unlink($cookieFile);
    http_response_code(502);
    exit($probeError ? "Probe failed: {$probeError}" : "Google Drive probe returned HTTP {$probeCode}");
}

$probeHeaders = substr($probeResponse, 0, $probeHeaderSize);
$probeBody = substr($probeResponse, $probeHeaderSize);

if (preg_match('/content-type:\s*text\/html/i', $probeHeaders)) {
    $confirm = null;
    $uuid = null;

    if (preg_match('/name="confirm"\s+value="([^"]+)"/i', $probeBody, $confirmMatch)) {
        $confirm = $confirmMatch[1];
    }
    if (preg_match('/name="uuid"\s+value="([^"]+)"/i', $probeBody, $uuidMatch)) {
        $uuid = $uuidMatch[1];
    }

    if ($confirm) {
        $driveUrl .= '&confirm=' . rawurlencode($confirm);
    }
    if ($uuid) {
        $driveUrl .= '&uuid=' . rawurlencode($uuid);
    }
}

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
    CURLOPT_COOKIEJAR      => $cookieFile,
    CURLOPT_COOKIEFILE     => $cookieFile,
    CURLOPT_USERAGENT      => 'Mozilla/5.0 (DrivePlayers Proxy)',
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
@unlink($cookieFile);

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
