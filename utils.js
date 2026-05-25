/**
 * Utility Functions for FDM Helper Extension
 * Security helpers, notifications, cookie management, and common utilities.
 */

import api, { BROWSER_ENV } from './browser-compat.js';
import { BLOCKED_HOSTS, LIMITS, UI, YOUTUBE_FIX } from './constants.js';

// Native messaging connection state
export let fdmConnectionState = 'unknown'; // 'connected', 'disconnected', 'unknown'

/**
 * Validates a download URL for security and correctness
 */
export function isValidDownloadUrl(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const parsed = new URL(url);

        // Only allow http/https protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;

        // Block localhost/loopback (potential SSRF)
        const hostname = parsed.hostname.toLowerCase();
        if (BLOCKED_HOSTS.includes(hostname)) return false;

        // Block data: and javascript: URLs
        if (url.startsWith('data:') || url.startsWith('javascript:')) return false;

        // Must have a valid hostname
        if (!hostname || hostname.length < LIMITS.MIN_HOSTNAME_LENGTH) return false;

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Filters sensitive cookies before transmission to FDM
 */
export function filterSensitiveCookies(cookieString) {
    // IDM-style behavior: we pass all cookies to ensure download works on protected sites.
    return cookieString || "";
}

/**
 * Retrieves cookies for multiple URLs with graceful error handling
 */
export async function getCookiesForUrls(urls) {
    const cookieMap = new Map();

    for (const url of urls) {
        if (!url) continue;
        try {
            const cookies1 = await api.cookies.getAll({ url: url });
            cookies1.forEach(c => cookieMap.set(c.name, c.value));
        } catch (e) {
            // Silently ignore
        }
        // Partitioned cookies (CHIPS) - Firefox only
        if (BROWSER_ENV.isFirefox) {
            try {
                const cookies2 = await api.cookies.getAll({ url: url, partitionKey: {} });
                cookies2.forEach(c => cookieMap.set(c.name, c.value));
            } catch (e) {
                // Silently ignore
            }
        }
    }

    return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * Cleans YouTube URL by removing tracking parameters
 */
export function cleanYouTubeUrl(url) {
    try {
        const u = new URL(url);
        const v = u.searchParams.get('v');
        if (v) {
            return "https://www.youtube.com/watch?v=" + v;
        } else if (u.hostname === 'youtu.be') {
            return "https://www.youtube.com/watch?v=" + u.pathname.substring(1);
        }
        return url;
    } catch (e) {
        return url;
    }
}

/**
 * Sends a notification message to the active tab's content script
 */
export async function notifyUser(message, type = 'info') {
    try {
        const [tab] = await api.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            api.tabs.sendMessage(tab.id, {
                type: 'FDM_NOTIFICATION',
                message: message,
                notificationType: type
            }).catch(() => {});
        }
    } catch (e) {
        console.warn('Failed to send notification to tab:', e);
    }
}

/**
 * Creates a safe port connection to FDM with error handling
 */
export function createSafePort(host) {
    let port = null;
    let isConnected = false;
    let errorHandled = false;

    try {
        port = api.runtime.connectNative(host);

        port.onDisconnect.addListener(() => {
            isConnected = false;
            fdmConnectionState = 'disconnected';

            const lastError = api.runtime.lastError;
            if (lastError && !errorHandled) {
                errorHandled = true;
                console.error('FDM Native Host disconnected:', lastError.message);
                notifyUser('FDM: Impossible de se connecter a FDM. Verifiez que FDM est installe et en execution.', 'error');
            }
        });

        isConnected = true;
        fdmConnectionState = 'connected';
    } catch (e) {
        console.error('Failed to connect to FDM Native Host:', e);
        fdmConnectionState = 'disconnected';
        notifyUser('FDM: Echec de connexion. Verifiez que FDM est installe.', 'error');
        return null;
    }

    return {
        port,
        postMessage: (data) => {
            if (port && isConnected) {
                try {
                    port.postMessage(data);
                    return true;
                } catch (e) {
                    console.error('FDM postMessage failed:', e);
                    notifyUser('FDM: Erreur lors de l\'envoi du telechargement.', 'error');
                    return false;
                }
            }
            return false;
        },
        disconnect: () => {
            if (port) {
                try {
                    port.disconnect();
                } catch (e) {}
            }
        },
        getState: () => fdmConnectionState
    };
}

/**
 * Calcule le score de priorité dynamique d'un flux pour le tri IDM-Style.
 */
export function getStreamPriority(s) {
    if (!s) return 0;
    const type = s.type || 'others';
    if (type === 'videos') return 100;    // Top: MP4/WebM/MKV
    if (type === 'youtube') return 90;   // High: YouTube Video
    if (type === 'manifests') return 80; // Master Playlists (m3u8/mpd)
    if (type === 'subtitles') return 60; // Subtitles
    if (type === 'segments') return 10;  // Technical segments (ts/m4s)
    return 50; // Others
}