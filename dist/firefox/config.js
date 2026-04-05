// Centralized Detection Rules - Shared between background.js and content.js
const DETECTION_RULES = {
    extensions: {
        manifests: ['.m3u8', '.mpd', '.f4m', '.m3u'],
        videos: ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv'],
        segments: ['.ts', '.m4s', '.aac', '.m4a'],
        subtitles: ['.vtt', '.srt']
    },
    contentTypes: {
        'application/vnd.apple.mpegurl': 'manifests',
        'application/x-mpegurl': 'manifests',
        'application/dash+xml': 'manifests',
        'video/mp4': 'videos',
        'video/webm': 'videos',
        'video/mp2t': 'segments',
        'text/vtt': 'subtitles',
        'application/x-subrip': 'subtitles'
    }
};

// Regex patterns for different detection scenarios
const DETECTION_PATTERNS = {
    // Hidden streams in JS/source code (aggressive URL extraction)
    hiddenStreamRegex: /(https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4|webm|mkv|ts)(?:\?[^\s"'<>\\]*)?)/ig,

    // Page scan for downloadable media files (links, anchors)
    pageScanExtensions: /\.(mp4|mkv|avi|webm|m3u8|ts|mp3|flac|wav|ogg|jpg|jpeg|png|gif|pdf|zip|rar|7z|iso)(?:\?|$)/i,

    // Network interception for media detection (XHR/Fetch)
    networkMediaExtensions: /\.(mp4|webm|mkv|avi|mov|flv|m3u8|mpd|ts|m4s|aac|m4a|vtt|srt)(?:\?|$)/i,

    // URL extension extraction for display
    urlExtensionRegex: /\.(mp4|m3u8|ts|webm|flv|mkv|mp3|flac|wav|jpg|png|gif|pdf|zip|rar)(?:\?|$)/i
};

// Helper: Detect media type from URL
function detectMediaType(url) {
    if (!url) return null;

    const lowerUrl = url.toLowerCase().split('?')[0];

    for (const [group, exts] of Object.entries(DETECTION_RULES.extensions)) {
        if (exts.some(ext => lowerUrl.endsWith(ext))) {
            return group;
        }
    }

    return null;
}

// Helper: Detect media type from Content-Type header
function detectTypeFromContentType(contentType) {
    if (!contentType) return null;

    const ct = contentType.toLowerCase();

    for (const [mime, group] of Object.entries(DETECTION_RULES.contentTypes)) {
        if (ct.includes(mime)) {
            return group;
        }
    }

    return null;
}

// Helper: Extract file extension from URL
function extractExtension(url) {
    const match = url.match(DETECTION_PATTERNS.urlExtensionRegex);
    return match ? match[1].toLowerCase() : null;
}
