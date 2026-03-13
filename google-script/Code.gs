/**
 * Drive Players — Google Apps Script Backend
 * Version: 3.0.0
 *
 * Xem video từ Google Drive với giao diện premium.
 * Deploy: Web app → Execute as: Me → Anyone can access
 *
 * ƯU ĐIỂM so với bản PHP:
 *  - Không cần API Key → dùng OAuth token của người deploy
 *  - Hosting miễn phí trên Google Cloud
 *  - Mỗi user có lịch sử xem riêng (PropertiesService)
 *  - Không cần proxy server
 */

const APP_VERSION = '3.0.0';
const HISTORY_MAX = 50;

/* ======================================================================
   WEB APP ENTRY
   ====================================================================== */

/**
 * Serve the web application
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.appVersion = APP_VERSION;

  return template.evaluate()
    .setTitle('DrivePlayers — Xem video Google Drive')
    .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include helper for HTML template partials
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ======================================================================
   DRIVE API FUNCTIONS
   ====================================================================== */

/**
 * Extract folder ID from various Google Drive URL formats
 */
function extractFolderId(url) {
  url = (url || '').trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
  var m = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

/**
 * Fetch videos and subfolders from a Google Drive folder.
 * Uses Drive API v3 via UrlFetchApp with the script's OAuth token.
 */
function getFilesInFolder(folderId) {
  try {
    var token = ScriptApp.getOAuthToken();

    // Fetch ALL items in the folder (paginated)
    var allFiles = [];
    var pageToken = '';

    do {
      var params = {
        q: "'" + folderId + "' in parents and trashed=false",
        fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,videoMediaMetadata)',
        pageSize: 200,
        orderBy: 'name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      };
      if (pageToken) params.pageToken = pageToken;

      var qs = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');

      var resp = UrlFetchApp.fetch(
        'https://www.googleapis.com/drive/v3/files?' + qs,
        {
          headers: { Authorization: 'Bearer ' + token },
          muteHttpExceptions: true
        }
      );

      if (resp.getResponseCode() !== 200) {
        var errBody = JSON.parse(resp.getContentText());
        return {
          success: false,
          error: errBody.error ? errBody.error.message : 'HTTP ' + resp.getResponseCode(),
          videos: [],
          subfolders: [],
          folderName: ''
        };
      }

      var data = JSON.parse(resp.getContentText());
      allFiles = allFiles.concat(data.files || []);
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    // — Separate into videos and subfolders ——
    var videoMimes = [
      'video/mp4', 'video/x-msvideo', 'video/x-matroska',
      'video/quicktime', 'video/webm', 'video/x-m4v'
    ];
    var videos = [];
    var subfolders = [];

    allFiles.forEach(function (f) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        subfolders.push({ id: f.id, name: f.name });
      } else if (videoMimes.indexOf(f.mimeType) !== -1) {
        videos.push(formatVideoMeta_(f));
      }
    });

    // Folder display name
    var folderName = getFolderName(folderId) || 'Thư mục';

    return {
      success: true,
      videos: videos,
      subfolders: subfolders,
      folderName: folderName
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      videos: [],
      subfolders: [],
      folderName: ''
    };
  }
}

/**
 * Fetch videos in each subfolder (for collapsible sidebar display).
 * @param {string[]} subfolderIds
 * @return {Object} Map of subfolderId → video[]
 */
function getSubfolderVideos(subfolderIds) {
  var result = {};
  (subfolderIds || []).forEach(function (sfId) {
    var data = getFilesInFolder(sfId);
    if (data.success && data.videos.length > 0) {
      result[sfId] = data.videos;
    }
  });
  return result;
}

/**
 * Get folder display name by ID
 */
function getFolderName(folderId) {
  try {
    var token = ScriptApp.getOAuthToken();
    var url = 'https://www.googleapis.com/drive/v3/files/' +
              encodeURIComponent(folderId) +
              '?fields=name&supportsAllDrives=true';
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      return JSON.parse(resp.getContentText()).name;
    }
  } catch (e) {}
  return null;
}

/* ======================================================================
   WATCH HISTORY  (PropertiesService — per-user)
   ====================================================================== */

/**
 * Save a video to the user's watch history.
 * @param {Object} item  { video_id, video_name, duration, resolution, size, folder_id, folder_name }
 */
function saveHistory(item) {
  var props = PropertiesService.getUserProperties();
  var history = JSON.parse(props.getProperty('watch_history') || '[]');

  // Remove duplicate
  history = history.filter(function (h) { return h.video_id !== item.video_id; });

  item.time = new Date().getTime();
  history.unshift(item);
  history = history.slice(0, HISTORY_MAX);

  props.setProperty('watch_history', JSON.stringify(history));
}

/**
 * Load the user's watch history (with relative time strings).
 */
function loadHistory() {
  var props = PropertiesService.getUserProperties();
  var history = JSON.parse(props.getProperty('watch_history') || '[]');

  var now = new Date().getTime();
  history.forEach(function (item) {
    var diff = Math.floor((now - item.time) / 1000);
    if (diff < 60)         item.timeAgo = 'Vừa xong';
    else if (diff < 3600)  item.timeAgo = Math.floor(diff / 60)    + ' phút trước';
    else if (diff < 86400) item.timeAgo = Math.floor(diff / 3600)  + ' giờ trước';
    else                   item.timeAgo = Math.floor(diff / 86400) + ' ngày trước';
  });

  return history;
}

/**
 * Clear the user's entire watch history.
 */
function clearHistory() {
  PropertiesService.getUserProperties().deleteProperty('watch_history');
}

/* ======================================================================
   INTERNAL HELPERS
   ====================================================================== */

/**
 * Format raw Drive API file object into our standard video metadata shape.
 */
function formatVideoMeta_(file) {
  // Duration
  var duration = '';
  if (file.videoMediaMetadata && file.videoMediaMetadata.durationMillis) {
    var total = Math.round(parseInt(file.videoMediaMetadata.durationMillis, 10) / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    duration = h > 0 ? h + ':' + pad_(m) + ':' + pad_(s)
                      : m + ':' + pad_(s);
  }

  // Resolution
  var resolution = '';
  if (file.videoMediaMetadata && file.videoMediaMetadata.height) {
    var ht = parseInt(file.videoMediaMetadata.height, 10);
    if      (ht >= 2160) resolution = '4K';
    else if (ht >= 1440) resolution = '1440p';
    else if (ht >= 1080) resolution = '1080p';
    else if (ht >= 720)  resolution = '720p';
    else if (ht >= 480)  resolution = '480p';
    else                  resolution = ht + 'p';
  }

  // File size
  var fileSize = '';
  var rawSize  = 0;
  if (file.size) {
    var bytes = parseInt(file.size, 10);
    rawSize = bytes;
    if      (bytes >= 1073741824) fileSize = (bytes / 1073741824).toFixed(1) + ' GB';
    else if (bytes >= 1048576)    fileSize = (bytes / 1048576).toFixed(1)    + ' MB';
    else                          fileSize = Math.round(bytes / 1024)        + ' KB';
  }

  // Extension
  var ext = '';
  var dotIdx = file.name.lastIndexOf('.');
  if (dotIdx !== -1) ext = file.name.substring(dotIdx + 1).toUpperCase();

  // Display name (without extension)
  var displayName = dotIdx !== -1 ? file.name.substring(0, dotIdx) : file.name;

  return {
    id:           file.id,
    name:         file.name,
    displayName:  displayName,
    mimeType:     file.mimeType,
    size:         fileSize,
    rawSize:      rawSize,
    duration:     duration,
    resolution:   resolution,
    ext:          ext,
    thumbnail:    file.thumbnailLink || 'https://drive.google.com/thumbnail?id=' + file.id + '&sz=w320',
    embed:        'https://drive.google.com/file/d/' + file.id + '/preview',
    download:     'https://drive.google.com/uc?id=' + file.id + '&export=download',
    driveLink:    'https://drive.google.com/file/d/' + file.id + '/view',
    modifiedTime: file.modifiedTime || ''
  };
}

function pad_(n) {
  return n < 10 ? '0' + n : '' + n;
}

/**
 * Ensure Drive OAuth scope is requested.
 * This function is never called but its reference to DriveApp
 * forces the OAuth consent screen to include Drive scope.
 */
function ensureDriveScope_() {
  DriveApp.getRootFolder();
}
