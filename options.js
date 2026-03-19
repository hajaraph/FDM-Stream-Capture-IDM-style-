const defaultSettings = {
    showButton: true,
    minSizeEnabled: true,
    minSizeMB: 1,
    detectSubtitles: true,
    scanHiddenStreams: true,
    smartNaming: true
};

let statusTimeout = null;

function saveOptions() {
    const settings = {
        showButton: document.getElementById('showButton').checked,
        minSizeEnabled: document.getElementById('minSizeEnabled').checked,
        minSizeMB: parseInt(document.getElementById('minSizeMB').value, 10) || 1,
        detectSubtitles: document.getElementById('detectSubtitles').checked,
        scanHiddenStreams: document.getElementById('scanHiddenStreams').checked,
        smartNaming: document.getElementById('smartNaming').checked
    };

    browser.storage.local.set({ extensionSettings: settings }).then(() => {
        const status = document.getElementById('status');
        status.style.display = 'block';

        if (statusTimeout) {
            clearTimeout(statusTimeout);
        }

        statusTimeout = setTimeout(() => {
            status.style.display = 'none';
        }, 2000);
    });
}

function restoreOptions() {
    // Translate the page
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const messageKey = el.getAttribute('data-i18n');
        const message = browser.i18n.getMessage(messageKey);
        if (message) {
            el.textContent = message;
        }
    });

    browser.storage.local.get('extensionSettings').then(data => {
        const settings = { ...defaultSettings, ...(data.extensionSettings || {}) };

        document.getElementById('showButton').checked = settings.showButton;
        document.getElementById('minSizeEnabled').checked = settings.minSizeEnabled;
        document.getElementById('minSizeMB').value = settings.minSizeMB;
        document.getElementById('detectSubtitles').checked = settings.detectSubtitles;
        document.getElementById('scanHiddenStreams').checked = settings.scanHiddenStreams;
        document.getElementById('smartNaming').checked = settings.smartNaming;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);

// Save automatically on change
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', saveOptions);
});
