// Centralized Constants - Shared between background.js and content.js

// Storage Limits
const MAX_DOWNLOAD_HISTORY = 500;
const MAX_CATCH_LOG = 100;

// Timing Constants (milliseconds)
const TIMING = {
    PERSIST_DEBOUNCE_MS: 500,
    NATIVE_PORT_DISCONNECT_MS: 1000,
    NOTIFICATION_DISMISS_MS: 4000,
    NOTIFICATION_FADE_MS: 300,
    BUTTON_HIDE_DELAY_MS: 400,
    SUCCESS_FEEDBACK_MS: 1200,
    MUTATION_DEBOUNCE_MS: 500,
    INITIAL_SCAN_DELAY_MS: 1000,
    STATUS_AUTOHIDE_MS: 2000,
    COPIED_FEEDBACK_MS: 1500,
    SCAN_ERROR_RESET_MS: 2000,
    DOWNLOAD_SENT_CLOSE_MS: 1500
};

// Size and Length Limits
const LIMITS = {
    MIN_HOSTNAME_LENGTH: 3,
    MIN_NAME_LENGTH: 2,
    MAX_TITLE_LENGTH: 50,
    MAX_FILENAME_RANDOM_SUFFIX: 1000,
    BUTTON_POSITION_OFFSET: 15,
    MUTATION_OBSERVER_MAX_DEPTH: 5
};

// UI Constants
const UI = {
    BADGE_COLOR: "#FF0000",
    Z_INDEX_BUTTON: 2147483647,
    Z_INDEX_DROPDOWN: 2147483648,
    NOTIFICATION_COLORS: {
        success: { bg: '#10b981', border: '#059669', icon: '✓' },
        error: { bg: '#ef4444', border: '#dc2626', icon: '✕' },
        warning: { bg: '#f59e0b', border: '#d97706', icon: '⚠' },
        info: { bg: '#3b82f6', border: '#2563eb', icon: 'ℹ' }
    }
};

// Security
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

// YouTube
const YOUTUBE_FIX = {
    CLEAR_REFERER: "", // Fix 413 error on YouTube
    DOMAINS: ['youtube.com', 'youtu.be'],
    WATCH_PATTERN: /youtube\.com\/watch|youtu\.be\//i
};
